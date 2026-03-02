import { Router } from 'express';
import type { SyncHandle } from '../sync/startSync.js';
import { sql, mudSchema } from '../db/connection.js';
import { serializeRow, camelToSnake } from '../naming.js';

export function createCharacterRouter(syncHandle: SyncHandle): Router {
  const router = Router();

  /**
   * GET /:ownerAddress
   * Returns full character data: character + stats + equipment + gold + encounter + effects
   */
  router.get('/:ownerAddress', async (req, res) => {
    try {
      const owner = req.params.ownerAddress.toLowerCase();
      const t = (name: string) => resolveTable(syncHandle, name);

      // 1. Find character by owner
      const charOwnerTable = t('CharacterOwner');
      if (!charOwnerTable) return res.status(503).json({ error: 'Tables not yet synced' });

      const ownerRows = await sql.unsafe(
        `SELECT * FROM "${mudSchema}"."${charOwnerTable}" WHERE "owner" = $1`,
        [hexToBuffer(owner)]
      );

      if (ownerRows.length === 0) {
        return res.json({ character: null });
      }

      const charOwner = serializeRow(ownerRows[0] as Record<string, unknown>);
      const characterId = charOwner.characterId as string;

      // 2. Parallel queries for all character data
      const [
        characterRows,
        statsRows,
        equipmentRows,
        escrowRows,
        encounterRows,
        effectsRows,
        sessionRows,
        classMultRows,
      ] = await Promise.all([
        queryByKey(t('Characters'), 'characterId', characterId),
        queryByKey(t('Stats'), 'entityId', characterId),
        queryByKey(t('CharacterEquipment'), 'characterId', characterId),
        queryByKey(t('AdventureEscrow'), 'characterId', characterId),
        queryByKey(t('EncounterEntity'), 'encounterEntityId', characterId),
        queryByKey(t('WorldStatusEffects'), 'entityId', characterId),
        queryByKey(t('SessionTimer'), 'characterId', characterId),
        queryByKey(t('ClassMultipliers'), 'entityId', characterId),
      ]);

      const character = characterRows[0] || null;
      const stats = statsRows[0] || null;
      const equipment = equipmentRows[0] || null;
      const escrow = escrowRows[0] || null;
      const encounter = encounterRows[0] || null;
      const effects = effectsRows[0] || null;
      const session = sessionRows[0] || null;
      const classMultipliers = classMultRows[0] || null;

      res.json({
        character,
        stats,
        equipment,
        escrow,
        encounter,
        effects,
        session,
        classMultipliers,
        block: syncHandle.latestBlockNumber,
      });
    } catch (err) {
      console.error('[api/character] Error:', err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}

function resolveTable(syncHandle: SyncHandle, logicalName: string): string | null {
  return syncHandle.tableNameMap.get(logicalName) || null;
}

async function queryByKey(tableName: string | null, keyCol: string, keyValue: string) {
  if (!tableName) return [];
  try {
    // Convert camelCase column name to snake_case for Postgres
    const pgCol = camelToSnake(keyCol);
    const rows = await sql.unsafe(
      `SELECT * FROM "${mudSchema}"."${tableName}" WHERE "${pgCol}" = $1`,
      [hexToBuffer(keyValue)]
    );
    return rows.map((r) => serializeRow(r as Record<string, unknown>));
  } catch {
    return [];
  }
}

function hexToBuffer(hex: string): Buffer {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  return Buffer.from(clean, 'hex');
}
