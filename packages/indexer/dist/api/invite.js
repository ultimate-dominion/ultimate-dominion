import { Router } from 'express';
import { sql } from '../db/connection.js';
import { generateInviteCode } from '../queue/milestoneWatcher.js';
export function createInviteRouter() {
    const router = Router();
    /**
     * GET /codes/:wallet
     * All invite codes for this wallet (used + unused).
     * Auto-seeds 3 starter codes on first access.
     */
    router.get('/codes/:wallet', async (req, res) => {
        try {
            const { wallet } = req.params;
            const w = wallet.toLowerCase();
            let rows = await sql `
        SELECT code, milestone, created_at, used_by, used_at
        FROM queue.invite_codes
        WHERE creator_wallet = ${w}
        ORDER BY created_at DESC
      `;
            // Auto-seed 3 starter codes on first access
            if (rows.length === 0) {
                try {
                    await Promise.all([
                        generateInviteCode(w, 'starter_1'),
                        generateInviteCode(w, 'starter_2'),
                        generateInviteCode(w, 'starter_3'),
                    ]);
                    console.log(`[invite] Auto-seeded 3 starter codes for ${w}`);
                    rows = await sql `
            SELECT code, milestone, created_at, used_by, used_at
            FROM queue.invite_codes
            WHERE creator_wallet = ${w}
            ORDER BY created_at DESC
          `;
                }
                catch (seedErr) {
                    console.error('[invite] Auto-seed error:', seedErr);
                }
            }
            res.json({
                codes: rows.map((r) => ({
                    code: r.code,
                    milestone: r.milestone,
                    createdAt: r.created_at,
                    usedBy: r.used_by,
                    usedAt: r.used_at,
                })),
            });
        }
        catch (err) {
            console.error('[invite] Codes error:', err);
            res.status(500).json({ error: 'Failed to get codes' });
        }
    });
    /**
     * GET /validate/:code
     * Check if a code is valid and unredeemed.
     */
    router.get('/validate/:code', async (req, res) => {
        try {
            const { code } = req.params;
            const rows = await sql `
        SELECT code, creator_wallet, used_by
        FROM queue.invite_codes
        WHERE code = ${code.toUpperCase()}
      `;
            if (rows.length === 0) {
                return res.json({ valid: false, reason: 'Code not found' });
            }
            if (rows[0].used_by) {
                return res.json({ valid: false, reason: 'Code already used' });
            }
            res.json({ valid: true, creatorWallet: rows[0].creator_wallet });
        }
        catch (err) {
            console.error('[invite] Validate error:', err);
            res.status(500).json({ error: 'Failed to validate code' });
        }
    });
    /**
     * GET /stats/:wallet
     * Referral stats: how many sent, activated, bonus codes earned.
     */
    router.get('/stats/:wallet', async (req, res) => {
        try {
            const { wallet } = req.params;
            const w = wallet.toLowerCase();
            const codesRows = await sql `
        SELECT
          COUNT(*) as total_codes,
          COUNT(*) FILTER (WHERE used_by IS NOT NULL) as codes_used
        FROM queue.invite_codes
        WHERE creator_wallet = ${w}
      `;
            const activationsRows = await sql `
        SELECT COUNT(*) as activated
        FROM queue.referral_activations ra
        JOIN queue.invite_codes ic ON ra.invite_code = ic.code
        WHERE ic.creator_wallet = ${w} AND ra.activated_at IS NOT NULL
      `;
            const bonusRows = await sql `
        SELECT COUNT(*) as bonus_codes
        FROM queue.invite_codes
        WHERE creator_wallet = ${w} AND milestone = 'activation_bonus'
      `;
            res.json({
                totalCodes: Number(codesRows[0].total_codes),
                codesUsed: Number(codesRows[0].codes_used),
                activated: Number(activationsRows[0].activated),
                bonusCodes: Number(bonusRows[0].bonus_codes),
            });
        }
        catch (err) {
            console.error('[invite] Stats error:', err);
            res.status(500).json({ error: 'Failed to get stats' });
        }
    });
    return router;
}
//# sourceMappingURL=invite.js.map