import { sql, mudSchema } from '../db/connection.js';
import type { SyncHandle } from '../sync/startSync.js';
import type { Broadcaster } from '../ws/broadcaster.js';
import crypto from 'crypto';

/** Generate an 8-char uppercase alphanumeric invite code */
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
  let code = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

/** Generate an invite code for a wallet at a given milestone */
export async function generateInviteCode(wallet: string, milestone: string): Promise<string> {
  const code = generateCode();
  await sql`
    INSERT INTO queue.invite_codes (code, creator_wallet, milestone)
    VALUES (${code}, ${wallet.toLowerCase()}, ${milestone})
    ON CONFLICT DO NOTHING
  `;
  console.log(`[milestone] Generated invite code ${code} for ${wallet} (${milestone})`);
  return code;
}

/** Check if wallet already has a code for this milestone */
export async function hasCodeForMilestone(wallet: string, milestone: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM queue.invite_codes
    WHERE creator_wallet = ${wallet.toLowerCase()} AND milestone = ${milestone}
    LIMIT 1
  `;
  return rows.length > 0;
}

/**
 * Level milestone thresholds that earn invite codes.
 * Each threshold generates one invite code.
 */
export const LEVEL_MILESTONES = [3, 10, 20];

/** Level at which an invitee is considered "activated" (earns bonus code for referrer) */
export const ACTIVATION_LEVEL = 5;

/**
 * Pure function: determine which milestones were crossed between two levels.
 * Returns the milestone values that were crossed.
 */
export function detectCrossedMilestones(
  prevLevel: number,
  currentLevel: number,
  milestones: number[] = LEVEL_MILESTONES,
): number[] {
  if (currentLevel <= prevLevel) return [];
  return milestones.filter((m) => prevLevel < m && currentLevel >= m);
}

/**
 * Process a character's level change: generate milestone codes and check activation.
 * Idempotent — safe to call on startup for existing characters. The hasCodeForMilestone
 * check and the activated_at IS NULL guard prevent duplicates.
 */
export async function processCharacterLevel(
  owner: string,
  prevLevel: number,
  currentLevel: number,
): Promise<{ codesGenerated: string[]; activationChecked: boolean }> {
  const codesGenerated: string[] = [];
  let activationChecked = false;

  // Skip if level didn't increase
  if (currentLevel <= prevLevel) return { codesGenerated, activationChecked };

  // Check level milestones for invite code generation
  const crossed = detectCrossedMilestones(prevLevel, currentLevel);
  for (const milestone of crossed) {
    const milestoneKey = `level_${milestone}`;
    const alreadyHas = await hasCodeForMilestone(owner, milestoneKey);
    if (!alreadyHas) {
      const code = await generateInviteCode(owner, milestoneKey);
      codesGenerated.push(code);
    }
  }

  // Check invitee activation (Level 5) for bonus referrer code
  if (prevLevel < ACTIVATION_LEVEL && currentLevel >= ACTIVATION_LEVEL) {
    await checkAndActivateReferral(owner);
    activationChecked = true;
  }

  return { codesGenerated, activationChecked };
}

/** Track previous level values per character to detect level-ups */
const previousLevels = new Map<string, number>();

/** Exported for testing — reset the in-memory level cache */
export function _resetPreviousLevels() {
  previousLevels.clear();
}

/**
 * Start watching for level milestones in the Stats table.
 * Called once at startup. Hooks into periodic polling of the Stats table
 * to detect level changes and generate invite codes.
 *
 * On the first scan, existing characters are processed retroactively to
 * catch any missed milestones (e.g., from indexer restarts). The dedup
 * checks in hasCodeForMilestone and checkAndActivateReferral prevent
 * duplicate code generation.
 */
export function startMilestoneWatcher(syncHandle: SyncHandle, broadcaster: Broadcaster) {
  console.log('[milestone] Starting milestone watcher');

  // Poll every 15 seconds for level changes
  setInterval(async () => {
    try {
      const statsTable = syncHandle.tableNameMap.get('Stats');
      const charactersTable = syncHandle.tableNameMap.get('Characters');
      if (!statsTable || !charactersTable) return;

      // Get all characters with their levels and owner addresses
      const rows = await sql.unsafe(`
        SELECT s."__key_bytes", s."level", c."owner"
        FROM "${mudSchema}"."${statsTable}" s
        JOIN "${mudSchema}"."${charactersTable}" c
          ON s."__key_bytes" = c."__key_bytes"
        WHERE s."level" IS NOT NULL
      `);

      for (const row of rows) {
        const keyBytes = row.__key_bytes;
        const key = Buffer.isBuffer(keyBytes) ? keyBytes.toString('hex') : String(keyBytes);
        const level = Number(row.level);
        const rawOwner = row.owner;
        const owner = rawOwner
          ? (Buffer.isBuffer(rawOwner) || rawOwner instanceof Uint8Array
              ? '0x' + Buffer.from(rawOwner).toString('hex')
              : String(rawOwner)
            ).toLowerCase()
          : null;
        if (!owner || level <= 0) continue;

        const prevLevel = previousLevels.get(key) ?? 0;
        previousLevels.set(key, level);

        // Skip if level didn't change (but DO process on initial scan — prevLevel === 0
        // means first time seeing this character. The dedup checks inside
        // processCharacterLevel prevent duplicate code generation.)
        if (level <= prevLevel) continue;

        await processCharacterLevel(owner, prevLevel, level);
      }
    } catch (err) {
      console.error('[milestone] Watcher error:', err);
    }
  }, 15_000);
}

/**
 * When an invitee reaches activation level, mark their referral as activated
 * and generate a bonus invite code for the referrer.
 */
export async function checkAndActivateReferral(inviteeWallet: string): Promise<boolean> {
  try {
    // Find if this wallet was invited
    const activations = await sql`
      UPDATE queue.referral_activations
      SET activated_at = NOW()
      WHERE invitee_wallet = ${inviteeWallet} AND activated_at IS NULL
      RETURNING invite_code
    `;

    if (activations.length === 0) return false;

    const inviteCode = activations[0].invite_code as string;

    // Find the referrer
    const codeRows = await sql`
      SELECT creator_wallet FROM queue.invite_codes WHERE code = ${inviteCode}
    `;
    if (codeRows.length === 0) return false;

    const referrerWallet = codeRows[0].creator_wallet as string;

    // Generate bonus code for referrer
    await generateInviteCode(referrerWallet, 'activation_bonus');
    console.log(`[milestone] Invitee ${inviteeWallet} activated, bonus code for ${referrerWallet}`);
    return true;
  } catch (err) {
    console.error('[milestone] Activation check error:', err);
    return false;
  }
}
