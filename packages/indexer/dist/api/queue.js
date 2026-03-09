import { Router } from 'express';
import { sql, mudSchema } from '../db/connection.js';
import { getQueuePosition, getQueueStats, joinQueue, leaveQueue, markSpawned, setPlayerEmail, } from '../db/queueSchema.js';
import { verifyCaptcha } from './captcha.js';
import { getRecentEvents } from '../queue/eventFeed.js';
import { generateInviteCode } from '../queue/milestoneWatcher.js';
import { config } from '../config.js';
/** Simple rate limiter: max requests per window per IP */
const rateLimits = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 20; // 20 requests per minute
function checkRateLimit(ip) {
    const now = Date.now();
    const entry = rateLimits.get(ip);
    if (!entry || now > entry.resetAt) {
        rateLimits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
        return true;
    }
    entry.count++;
    return entry.count <= RATE_LIMIT_MAX;
}
// Clean up stale rate limit entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of rateLimits) {
        if (now > entry.resetAt)
            rateLimits.delete(ip);
    }
}, 5 * 60000);
const WALLET_RE = /^0x[0-9a-fA-F]{40}$/;
const INVITE_CODE_RE = /^[A-Z2-9]{8}$/;
function isValidWallet(w) {
    return typeof w === 'string' && WALLET_RE.test(w);
}
export function createQueueRouter(syncHandle, broadcaster) {
    const router = Router();
    /**
     * POST /join
     * Join the queue. Requires CAPTCHA token.
     * Body: { wallet, captchaToken, inviteCode? }
     */
    router.post('/join', async (req, res) => {
        try {
            const ip = req.ip || req.socket.remoteAddress || 'unknown';
            if (!checkRateLimit(ip)) {
                return res.status(429).json({ error: 'Too many requests' });
            }
            const { wallet, captchaToken, inviteCode } = req.body;
            if (!isValidWallet(wallet)) {
                return res.status(400).json({ error: 'Invalid wallet address' });
            }
            if (!captchaToken || typeof captchaToken !== 'string') {
                return res.status(400).json({ error: 'captchaToken is required' });
            }
            if (inviteCode && (typeof inviteCode !== 'string' || !INVITE_CODE_RE.test(inviteCode.toUpperCase()))) {
                return res.status(400).json({ error: 'Invalid invite code format' });
            }
            // Verify CAPTCHA
            const captchaValid = await verifyCaptcha(captchaToken, ip);
            if (!captchaValid) {
                return res.status(403).json({ error: 'CAPTCHA verification failed' });
            }
            // Determine priority
            let priority = 'normal';
            // Check for founder badge
            const hasFounderBadge = await checkFounderBadge(syncHandle, wallet);
            if (hasFounderBadge) {
                priority = 'founder';
            }
            // Check invite code
            if (inviteCode && priority !== 'founder') {
                const codeValid = await validateAndRedeemInviteCode(inviteCode, wallet.toLowerCase());
                if (codeValid) {
                    priority = 'invited';
                }
            }
            const result = await joinQueue(wallet, priority, inviteCode);
            // Seed 3 starter invite codes for first-time players
            try {
                const existingCodes = await sql `
          SELECT 1 FROM queue.invite_codes
          WHERE creator_wallet = ${wallet.toLowerCase()}
          LIMIT 1
        `;
                if (existingCodes.length === 0) {
                    await Promise.all([
                        generateInviteCode(wallet, 'starter_1'),
                        generateInviteCode(wallet, 'starter_2'),
                        generateInviteCode(wallet, 'starter_3'),
                    ]);
                    console.log(`[queue] Seeded 3 starter invite codes for ${wallet}`);
                }
            }
            catch (seedErr) {
                console.error('[queue] Starter code seed error:', seedErr);
            }
            // Broadcast updated stats
            const stats = await getQueueStats();
            const playerInfo = await getCurrentPlayerInfo(syncHandle);
            broadcaster.broadcastQueueStats({
                totalInQueue: stats.totalInQueue,
                slotsAvailable: Math.max(0, playerInfo.maxPlayers - playerInfo.currentPlayers),
                currentPlayers: playerInfo.currentPlayers,
            });
            res.json({
                position: result.position,
                totalInQueue: result.totalInQueue,
                priority,
                status: 'waiting',
            });
        }
        catch (err) {
            console.error('[queue] Join error:', err);
            res.status(500).json({ error: 'Failed to join queue' });
        }
    });
    /**
     * GET /position/:wallet
     * Get queue position and stats for a wallet.
     */
    router.get('/position/:wallet', async (req, res) => {
        try {
            const { wallet } = req.params;
            if (!isValidWallet(wallet)) {
                return res.status(400).json({ error: 'Invalid wallet address' });
            }
            const pos = await getQueuePosition(wallet);
            const playerInfo = await getCurrentPlayerInfo(syncHandle);
            const stats = await getQueueStats();
            if (!pos) {
                return res.json({
                    inQueue: false,
                    slotsAvailable: Math.max(0, playerInfo.maxPlayers - playerInfo.currentPlayers),
                    maxPlayers: playerInfo.maxPlayers,
                    currentPlayers: playerInfo.currentPlayers,
                    totalInQueue: stats.totalInQueue,
                });
            }
            const slotsAvailable = Math.max(0, playerInfo.maxPlayers - playerInfo.currentPlayers);
            const estimatedWaitMinutes = pos.position <= slotsAvailable
                ? 0
                : Math.ceil((pos.position - slotsAvailable) * 8);
            res.json({
                inQueue: true,
                position: pos.position,
                totalInQueue: pos.totalInQueue,
                slotsAvailable,
                maxPlayers: playerInfo.maxPlayers,
                currentPlayers: playerInfo.currentPlayers,
                estimatedWaitMinutes,
                priority: pos.priority,
                status: pos.status,
                readyUntil: pos.readyUntil?.toISOString() ?? null,
            });
        }
        catch (err) {
            console.error('[queue] Position error:', err);
            res.status(500).json({ error: 'Failed to get position' });
        }
    });
    /**
     * GET /stats
     * Public queue stats.
     */
    router.get('/stats', async (_req, res) => {
        try {
            const stats = await getQueueStats();
            const playerInfo = await getCurrentPlayerInfo(syncHandle);
            res.json({
                totalInQueue: stats.totalInQueue,
                slotsAvailable: Math.max(0, playerInfo.maxPlayers - playerInfo.currentPlayers),
                maxPlayers: playerInfo.maxPlayers,
                currentPlayers: playerInfo.currentPlayers,
            });
        }
        catch (err) {
            console.error('[queue] Stats error:', err);
            res.status(500).json({ error: 'Failed to get stats' });
        }
    });
    /**
     * DELETE /leave/:wallet
     * Leave the queue voluntarily.
     */
    router.delete('/leave/:wallet', async (req, res) => {
        try {
            const apiKey = req.headers['x-api-key'];
            if (!config.auth.apiKey || apiKey !== config.auth.apiKey) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const { wallet } = req.params;
            if (!isValidWallet(wallet)) {
                return res.status(400).json({ error: 'Invalid wallet address' });
            }
            const left = await leaveQueue(wallet);
            if (left) {
                const stats = await getQueueStats();
                const playerInfo = await getCurrentPlayerInfo(syncHandle);
                broadcaster.broadcastQueueStats({
                    totalInQueue: stats.totalInQueue,
                    slotsAvailable: Math.max(0, playerInfo.maxPlayers - playerInfo.currentPlayers),
                    currentPlayers: playerInfo.currentPlayers,
                });
            }
            res.json({ left });
        }
        catch (err) {
            console.error('[queue] Leave error:', err);
            res.status(500).json({ error: 'Failed to leave queue' });
        }
    });
    /**
     * POST /ready-ack/:wallet
     * Acknowledge that a slot notification was received.
     */
    router.post('/ready-ack/:wallet', async (req, res) => {
        try {
            const { wallet } = req.params;
            // Already marked ready by advanceQueue — this is just an ack
            res.json({ acknowledged: true });
        }
        catch (err) {
            console.error('[queue] Ready-ack error:', err);
            res.status(500).json({ error: 'Failed to acknowledge' });
        }
    });
    /**
     * GET /feed
     * Initial load of recent game events for the waiting room.
     */
    router.get('/feed', async (_req, res) => {
        try {
            res.json({ events: getRecentEvents() });
        }
        catch (err) {
            console.error('[queue] Feed error:', err);
            res.status(500).json({ error: 'Failed to get feed' });
        }
    });
    /**
     * POST /spawned/:wallet
     * Client reports successful on-chain spawn.
     */
    router.post('/spawned/:wallet', async (req, res) => {
        try {
            const apiKey = req.headers['x-api-key'];
            if (!config.auth.apiKey || apiKey !== config.auth.apiKey) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const { wallet } = req.params;
            if (!isValidWallet(wallet)) {
                return res.status(400).json({ error: 'Invalid wallet address' });
            }
            const spawned = await markSpawned(wallet);
            if (spawned) {
                const stats = await getQueueStats();
                const playerInfo = await getCurrentPlayerInfo(syncHandle);
                broadcaster.broadcastQueueStats({
                    totalInQueue: stats.totalInQueue,
                    slotsAvailable: Math.max(0, playerInfo.maxPlayers - playerInfo.currentPlayers),
                    currentPlayers: playerInfo.currentPlayers,
                });
            }
            res.json({ spawned });
        }
        catch (err) {
            console.error('[queue] Spawned error:', err);
            res.status(500).json({ error: 'Failed to mark spawned' });
        }
    });
    /**
     * POST /player/email
     * Store a wallet→email mapping for queue slot notifications.
     * Body: { wallet, email }
     */
    router.post('/player/email', async (req, res) => {
        try {
            const { wallet, email } = req.body;
            if (!wallet || typeof wallet !== 'string') {
                return res.status(400).json({ error: 'wallet is required' });
            }
            if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return res.status(400).json({ error: 'valid email is required' });
            }
            await setPlayerEmail(wallet, email);
            res.json({ ok: true });
        }
        catch (err) {
            console.error('[queue] Player email error:', err);
            res.status(500).json({ error: 'Failed to store email' });
        }
    });
    return router;
}
/**
 * Check if a wallet holds a Founder badge (badge token ID 50).
 * Queries the MUD Badges namespace Owners table.
 */
async function checkFounderBadge(syncHandle, wallet) {
    try {
        const ownersTable = syncHandle.tableNameMap.get('BadgesOwners');
        if (!ownersTable)
            return false;
        // Badge token ID 50 = Founder badge (from constants.sol)
        // The Owners table is keyed by token ID and stores the owner address
        const rows = await sql.unsafe(`SELECT * FROM "${mudSchema}"."${ownersTable}" WHERE "owner" = $1`, [wallet.toLowerCase()]);
        // Check if any owned badge has token ID that corresponds to BADGE_FOUNDER = 50
        // In the ERC721 Owners table, the key is the tokenId
        for (const row of rows) {
            const tokenId = row.id || row.token_id;
            if (tokenId !== undefined && Number(tokenId) === 50)
                return true;
        }
        return false;
    }
    catch (err) {
        console.error('[queue] Founder badge check error:', err);
        return false;
    }
}
/**
 * Validate and redeem an invite code. Returns true if valid and successfully redeemed.
 */
async function validateAndRedeemInviteCode(code, wallet) {
    try {
        const result = await sql `
      UPDATE queue.invite_codes
      SET used_by = ${wallet}, used_at = NOW()
      WHERE code = ${code.toUpperCase()} AND used_by IS NULL
      RETURNING code, creator_wallet
    `;
        if (result.length === 0)
            return false;
        // Create activation tracking
        await sql `
      INSERT INTO queue.referral_activations (invite_code, invitee_wallet)
      VALUES (${code.toUpperCase()}, ${wallet})
      ON CONFLICT DO NOTHING
    `;
        return true;
    }
    catch (err) {
        console.error('[queue] Invite code redeem error:', err);
        return false;
    }
}
/**
 * Get current player count and maxPlayers from MUD tables.
 */
async function getCurrentPlayerInfo(syncHandle) {
    try {
        const spawnedTable = syncHandle.tableNameMap.get('Spawned');
        const configTable = syncHandle.tableNameMap.get('UltimateDominionConfig');
        const charactersTable = syncHandle.tableNameMap.get('Characters');
        const sessionTable = syncHandle.tableNameMap.get('SessionTimer');
        // Read session timeout from on-chain SessionConfig table
        let SESSION_TIMEOUT = 300;
        const sessionConfigTable = syncHandle.tableNameMap.get('SessionConfig');
        if (sessionConfigTable) {
            const configRows = await sql.unsafe(`SELECT "session_timeout" FROM "${mudSchema}"."${sessionConfigTable}" LIMIT 1`);
            if (configRows.length > 0 && configRows[0].session_timeout !== undefined) {
                SESSION_TIMEOUT = Number(configRows[0].session_timeout);
            }
        }
        const now = Math.floor(Date.now() / 1000);
        let currentPlayers = 0;
        if (spawnedTable && charactersTable && sessionTable) {
            // Count only active player characters (not mobs, not idle beyond session timeout)
            const rows = await sql.unsafe(`SELECT COUNT(*) as count
         FROM "${mudSchema}"."${spawnedTable}" sp
         JOIN "${mudSchema}"."${charactersTable}" c
           ON sp."__key_bytes" = c."__key_bytes"
         JOIN "${mudSchema}"."${sessionTable}" st
           ON sp."__key_bytes" = st."__key_bytes"
         WHERE sp."spawned" = true
           AND st."last_action" + ${SESSION_TIMEOUT} >= ${now}`);
            currentPlayers = Number(rows[0].count);
        }
        else if (spawnedTable && charactersTable) {
            // Fallback without session timer
            const rows = await sql.unsafe(`SELECT COUNT(*) as count
         FROM "${mudSchema}"."${spawnedTable}" sp
         JOIN "${mudSchema}"."${charactersTable}" c
           ON sp."__key_bytes" = c."__key_bytes"
         WHERE sp."spawned" = true`);
            currentPlayers = Number(rows[0].count);
        }
        else if (spawnedTable) {
            const rows = await sql.unsafe(`SELECT COUNT(*) as count FROM "${mudSchema}"."${spawnedTable}" WHERE "spawned" = true`);
            currentPlayers = Number(rows[0].count);
        }
        let maxPlayers = 10; // default
        if (configTable) {
            const rows = await sql.unsafe(`SELECT "max_players" FROM "${mudSchema}"."${configTable}" LIMIT 1`);
            if (rows.length > 0 && rows[0].max_players !== undefined) {
                maxPlayers = Number(rows[0].max_players);
            }
        }
        return { currentPlayers, maxPlayers };
    }
    catch (err) {
        console.error('[queue] Player info error:', err);
        return { currentPlayers: 0, maxPlayers: 10 };
    }
}
/** Exported for use by cleanup cron */
export { getCurrentPlayerInfo };
//# sourceMappingURL=queue.js.map