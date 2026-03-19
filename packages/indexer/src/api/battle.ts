import { Router } from 'express';
import type { SyncHandle } from '../sync/startSync.js';
import { sql, mudSchema } from '../db/connection.js';
import { serializeRow } from '../naming.js';

export function createBattleRouter(syncHandle: SyncHandle): Router {
  const router = Router();

  /**
   * GET /:characterId
   * Returns active encounter + outcomes for a character.
   */
  router.get('/:characterId', async (req, res) => {
    try {
      const characterId = req.params.characterId;
      const t = (name: string) => syncHandle.tableNameMap.get(name);

      const encounterEntityTable = t('EncounterEntity');
      if (!encounterEntityTable) return res.status(503).json({ error: 'Tables not yet synced' });

      // Find character's encounter entity
      const encounterEntityRows = await sql.unsafe(
        `SELECT * FROM "${mudSchema}"."${encounterEntityTable}" WHERE "encounter_entity_id" = $1`,
        [hexToBuffer(characterId)]
      );

      if (encounterEntityRows.length === 0) {
        return res.json({ encounter: null, outcomes: [], combatOutcome: null });
      }

      const encounterEntity = serializeRow(encounterEntityRows[0] as Record<string, unknown>);
      const encounterId = encounterEntity.encounterId as string;

      // If no active encounter (encounterId is zero bytes)
      if (!encounterId || encounterId === '0x' + '0'.repeat(64)) {
        return res.json({ encounter: null, encounterEntity, outcomes: [], combatOutcome: null });
      }

      // Fetch encounter details and outcomes in parallel
      const encounterTable = t('CombatEncounter');
      const outcomeTable = t('ActionOutcome');
      const combatOutcomeTable = t('CombatOutcome');

      const [encounterRows, outcomeRows, combatOutcomeRows] = await Promise.all([
        encounterTable
          ? sql.unsafe(
              `SELECT * FROM "${mudSchema}"."${encounterTable}" WHERE "encounter_id" = $1`,
              [hexToBuffer(encounterId)]
            )
          : [],
        outcomeTable
          ? sql.unsafe(
              `SELECT * FROM "${mudSchema}"."${outcomeTable}" WHERE "encounter_id" = $1 ORDER BY "current_turn", "attack_number"`,
              [hexToBuffer(encounterId)]
            )
          : [],
        combatOutcomeTable
          ? sql.unsafe(
              `SELECT * FROM "${mudSchema}"."${combatOutcomeTable}" WHERE "encounter_id" = $1`,
              [hexToBuffer(encounterId)]
            )
          : [],
      ]);

      res.json({
        encounter: encounterRows[0] ? serializeRow(encounterRows[0] as Record<string, unknown>) : null,
        encounterEntity,
        outcomes: (outcomeRows as Record<string, unknown>[]).map((r) => serializeRow(r)),
        combatOutcome: combatOutcomeRows[0] ? serializeRow(combatOutcomeRows[0] as Record<string, unknown>) : null,
        block: syncHandle.latestStoredBlockNumber,
      });
    } catch (err) {
      console.error('[api/battle] Error:', err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}

function hexToBuffer(hex: string): Buffer {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  return Buffer.from(clean, 'hex');
}
