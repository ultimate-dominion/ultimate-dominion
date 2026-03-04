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
async function hasCodeForMilestone(wallet: string, milestone: string): Promise<boolean> {
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
const LEVEL_MILESTONES = [3, 10, 20];

/** Level at which an invitee is considered "activated" (earns bonus code for referrer) */
const ACTIVATION_LEVEL = 5;

/** Track previous level values per character to detect level-ups */
const previousLevels = new Map<string, number>();

/**
 * Start watching for level milestones in the Stats table.
 * Called once at startup. Hooks into periodic polling of the Stats table
 * to detect level changes and generate invite codes.
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

        // Skip if level didn't change or it's the initial scan
        if (level <= prevLevel || prevLevel === 0) continue;

        // Check level milestones for invite code generation
        for (const milestone of LEVEL_MILESTONES) {
          if (prevLevel < milestone && level >= milestone) {
            const milestoneKey = `level_${milestone}`;
            const alreadyHas = await hasCodeForMilestone(owner, milestoneKey);
            if (!alreadyHas) {
              await generateInviteCode(owner, milestoneKey);
            }
          }
        }

        // Check invitee activation (Level 5) for bonus referrer code
        if (prevLevel < ACTIVATION_LEVEL && level >= ACTIVATION_LEVEL) {
          await checkAndActivateReferral(owner);
        }
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
async function checkAndActivateReferral(inviteeWallet: string) {
  try {
    // Find if this wallet was invited
    const activations = await sql`
      UPDATE queue.referral_activations
      SET activated_at = NOW()
      WHERE invitee_wallet = ${inviteeWallet} AND activated_at IS NULL
      RETURNING invite_code
    `;

    if (activations.length === 0) return;

    const inviteCode = activations[0].invite_code as string;

    // Find the referrer
    const codeRows = await sql`
      SELECT creator_wallet FROM queue.invite_codes WHERE code = ${inviteCode}
    `;
    if (codeRows.length === 0) return;

    const referrerWallet = codeRows[0].creator_wallet as string;

    // Generate bonus code for referrer
    await generateInviteCode(referrerWallet, 'activation_bonus');
    console.log(`[milestone] Invitee ${inviteeWallet} activated, bonus code for ${referrerWallet}`);
  } catch (err) {
    console.error('[milestone] Activation check error:', err);
  }
}
