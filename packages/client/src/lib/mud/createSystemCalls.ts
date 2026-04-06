/*
 * Create the system calls that the client can use to ask
 * for changes in the World state (using the System contracts).
 *
 * Reads game state from the Zustand store instead of RECS.
 */

import {
  Address,
  BaseError,
  ContractFunctionRevertedError,
  Hash,
  Hex,
  InsufficientFundsError,
  concat,
  keccak256,
  stringToHex,
  toBytes,
  zeroHash,
} from 'viem';

import { INSUFFICIENT_FUNDS_MESSAGE, reloadIfStaleChunk } from '../../utils/errors';
import { reportError } from '../../utils/errorReporter';
import {
  AdvancedClass,
  ArmorType,
  type EntityStats,
  EncounterType,
  type NewOrder,
  PowerSource,
  Race,
  StatsClasses,
} from '../../utils/types';

import { getTableValue, markEvictedRows, useGameStore, type BatchUpdate } from '../gameStore';
import { SetupNetworkResult } from './setupNetwork';

// ==================== Emergency gas funding ====================
// When a tx fails with "insufficient funds", request an emergency top-up
// from the relayer and retry once. This closes the gap between the 60s
// balance monitor cycles where a player could be stranded mid-action.

// Return value: 'funded' = ETH sent, 'has_funds' = already above threshold, false = failed
type FundingResult = 'funded' | 'has_funds' | false;
type IdentityTokenGetter = () => Promise<string | null> | string | null;

async function requestEmergencyFunding(
  address: string,
  options: {
    delegatorAddress?: string;
    getEmbeddedIdentityToken?: IdentityTokenGetter;
    worldAddress?: string;
  } = {},
): Promise<FundingResult> {
  // Read lazily so tests can override import.meta.env at runtime
  const relayerUrl = import.meta.env.VITE_RELAYER_URL as string | undefined;
  if (!relayerUrl) return false;

  const { delegatorAddress, getEmbeddedIdentityToken, worldAddress } = options;
  const isEmbeddedFunding =
    !delegatorAddress ||
    delegatorAddress.toLowerCase() === address.toLowerCase();

  const identityToken = isEmbeddedFunding
    ? await getEmbeddedIdentityToken?.() ?? null
    : null;
  if (isEmbeddedFunding && !identityToken) return false;

  try {
    const res = await fetch(`${relayerUrl}/fund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(identityToken ? { Authorization: `Bearer ${identityToken}` } : {}),
      },
      body: JSON.stringify({ address, delegatorAddress, worldAddress }),
    });
    if (!res.ok) return false;
    try {
      const body = await res.json() as { status?: string };
      if (body.status === 'funded') return 'funded';
      if (body.status === 'already_funded') return 'has_funds';
    } catch {
      // Couldn't parse body — treat 200 as funded
    }
    return 'funded';
  } catch {
    return false;
  }
}

function isInsufficientFundsError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'walk' in error) {
    const found = (error as BaseError).walk(e => e instanceof InsufficientFundsError);
    if (found) return true;
  }
  const msg = ((error as Error)?.message ?? '').toLowerCase();
  return msg.includes('insufficient funds');
}

export type SystemCalls = ReturnType<typeof createSystemCalls>;

type SystemCallReturn = Promise<{
  success: boolean;
  error?: string;
  severity?: 'error' | 'warning';
}>;

type ErrorCategory = 'REVERT' | 'FUNDS' | 'RPC' | 'GAS' | 'NONCE' | 'SPONSOR' | 'UNKNOWN';

// Map known custom error signatures to user-friendly messages.
const KNOWN_ERROR_SIGNATURES: Record<string, string> = {
  '0x9e4b2685': 'That name is already spoken for. Choose another.',
  '0x6d187b28': 'The cave does not recognize you. Try reconnecting.',
  '0x442473f8': 'Your character\'s visage is corrupted. Try again.',
  '0x261fa6d6': 'Your character is bound by an ancient seal and cannot be changed right now.',
  '0x82b42900': 'The cave wards block your path. You lack the authority for this.',
  '0x8fa2ffa1': 'You must equip a weapon or spell before entering combat.',
  '0x39f609e8': 'That ability is unknown to you.',
  '0x54962c76': 'That item is not equipped.',
  '0xbb1f5f1e': 'The cave doesn\'t understand that command.',
  '0x0f53fbcc': 'That item pulses with an unfamiliar magic.',
  '0x4a7f394f': 'That action is beyond your reach.',
  '0xd7663649': 'An unknown force resists your effort.',
  '0xecea39ab': 'The cave cannot sustain more creatures.',
  '0xdd94cf19': 'The summoning ritual is malformed.',
  '0x64b92770': 'That creature doesn\'t belong here.',
  '0x326f4b4f': 'Your legs haven\'t recovered yet. Wait a moment.',
  '0x5ffeddff': 'The cave is teeming with life. No more creatures can spawn.',
  '0x63754e43': 'Finish your current battle first!',
  '0x72af8dba': 'Your body cannot sustain that change.',
  '0x03dee4c5': 'You don\'t have enough of that item to sell.',
  '0xadee4371': 'Your target has vanished into the shadows. Try again.',
  '0xbd45e4f6': 'Your character has not yet entered the world.',
  '0xbd0f4934': 'There\'s nothing there anymore.',
  '0x1af235ec': 'That creature cannot be challenged.',
  '0xa17bea2c': 'You need a moment to catch your breath before adventuring again.',
  '0x0769bef0': 'You\'re already locked in combat!',
  '0xb4120f14': 'The cave walls block your path. You cannot go that way.',
  '0x87822d34': 'The passage ahead is sealed.',
  '0xb8a03426': 'Only adventurers may do this.',
  '0x0762d547': 'You already have a character. Refreshing...',
};

// Extract the raw 4-byte error selector from a viem error chain.
const extractRevertSelector = (error: unknown): string | null => {
  const str = String(error);
  // viem includes the selector in various formats: signature "0x...", data: "0x..."
  const match = str.match(/(?:signature|data)[:\s]+"?(0x[0-9a-f]{8})/i);
  return match ? match[1].toLowerCase() : null;
};

const classifyError = (error: unknown): { category: ErrorCategory; message: string; selector?: string } => {
  const raw = ((error as Error)?.message ?? '').toLowerCase();

  if (error && typeof error === 'object' && 'walk' in error) {
    const baseError = error as BaseError;

    const revertError = baseError.walk(
      e => e instanceof ContractFunctionRevertedError,
    );
    if (revertError instanceof ContractFunctionRevertedError) {
      const errorName = revertError.data?.errorName;
      const args = revertError.data?.args ?? [];
      // If ABI couldn't decode, try matching the raw selector against known errors
      const selector = extractRevertSelector(error);
      const knownMsg = selector ? KNOWN_ERROR_SIGNATURES[selector] : undefined;
      // "Error" is the generic ABI type for require(condition, "message") — prefer args[0] which has the actual message
      const requireMessage = errorName === 'Error' && args[0] ? (args[0] as string) : undefined;
      const reason = requireMessage ?? knownMsg ?? (errorName && errorName !== 'Error' ? errorName : undefined) ?? (args[0] as string) ?? `Unknown revert (${selector ?? 'no selector'})`;
      return { category: 'REVERT', message: reason, selector: selector ?? undefined };
    }

    const insufficientFundsError = baseError.walk(
      e => e instanceof InsufficientFundsError,
    );
    if (insufficientFundsError instanceof InsufficientFundsError) {
      return { category: 'FUNDS', message: INSUFFICIENT_FUNDS_MESSAGE };
    }
  }

  if (/gas required exceeds|out of gas|gas estimation/i.test(raw)) {
    return { category: 'GAS', message: raw };
  }
  if (/nonce/i.test(raw)) {
    return { category: 'NONCE', message: raw };
  }
  if (/sponsor|paymaster|entrypoint/i.test(raw)) {
    return { category: 'SPONSOR', message: raw };
  }
  if (/timeout|network|econnrefused|econnreset|socket hang up|fetch failed|failed to fetch|rate limit|429|502|503|504/i.test(raw)) {
    return { category: 'RPC', message: raw };
  }
  if (/execution reverted|revert/i.test(raw)) {
    return { category: 'REVERT', message: raw };
  }

  if (error instanceof Error) {
    return { category: 'UNKNOWN', message: error.message };
  }
  return { category: 'UNKNOWN', message: 'Something stirs in the darkness. Try again.' };
};

const getContractError = (error: unknown): string => {
  const { category, message } = classifyError(error);

  console.error(
    `[TX_ERROR][${category}] ${message}`,
    category === 'UNKNOWN' ? error : '',
  );

  if (category === 'FUNDS') return INSUFFICIENT_FUNDS_MESSAGE;

  // Map non-revert categories to in-world messages (never leak raw errors)
  const CATEGORY_MESSAGES: Partial<Record<ErrorCategory, string>> = {
    GAS: 'The ancient wards resist your action. Try again in a moment.',
    NONCE: 'Your actions overlapped. Try again.',
    SPONSOR: 'The cave resists your action. Try again.',
    RPC: 'The cave grows dark and the way forward is unclear. Try again in a moment.',
    UNKNOWN: 'Something stirs in the darkness. Try again.',
  };

  if (category in CATEGORY_MESSAGES) {
    reportError("contract", error, { category, systemCall: "unknown" });
    return CATEGORY_MESSAGES[category]!;
  }

  // Extract the 4-byte selector directly from the raw error — works for ALL
  // viem error types (ContractFunctionRevertedError, EstimateGasExecutionError,
  // etc.) regardless of where the selector appears in the error chain.
  const selector = extractRevertSelector(error);
  if (selector) {
    const friendly = KNOWN_ERROR_SIGNATURES[selector];
    if (friendly) return friendly;
  }

  reportError("contract", error, { category: category, systemCall: "unknown" });

  return 'Something stirs in the darkness. Try again.';
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createSystemCalls(
  {
    getEmbeddedIdentityToken,
    publicClient,
    walletClient,
    waitForTransaction,
    worldContract,
    delegatorAddress,
  }: SetupNetworkResult & {
    delegatorAddress?: Address;
    getEmbeddedIdentityToken?: IdentityTokenGetter;
  },
) {
  // Account to use for diagnostic simulations (eth_call).
  // Without this, simulate() runs with from=address(0), which causes
  // _msgSender() inside the contract to be zero — every auth check fails
  // with Unauthorized() and masks the real revert reason.
  const diagAccount = delegatorAddress ?? walletClient?.account?.address;

  // ==================== Gas retry proxy ====================
  // Wraps worldContract.write so that ANY system call that fails with
  // "insufficient funds" automatically requests emergency funding from
  // the relayer, waits for it to land, then retries once.
  const gasRetryAddress = walletClient?.account?.address;

  const waitForBalance = async (minIncrease: bigint, timeoutMs = 8000): Promise<boolean> => {
    if (!gasRetryAddress) return false;
    const start = Date.now();
    const baseline = await publicClient.getBalance({ address: gasRetryAddress });
    while (Date.now() - start < timeoutMs) {
      await new Promise(r => setTimeout(r, 1000));
      const current = await publicClient.getBalance({ address: gasRetryAddress });
      if (current > baseline + minIncrease) return true;
    }
    return false;
  };

  // Proxy worldContract.write: intercept every method call, catch
  // insufficient funds errors, request funding, wait, retry once.
  // Dedup: only one emergency funding request at a time — concurrent
  // insufficient-funds errors share the same inflight promise.
  let inflightFunding: Promise<FundingResult> | null = null;

  const proxiedWrite = new Proxy(worldContract.write, {
    get(target, prop, receiver) {
      const original = Reflect.get(target, prop, receiver);
      if (typeof original !== 'function') return original;

      return async (...args: unknown[]) => {
        try {
          return await (original as (...a: unknown[]) => Promise<unknown>)(...args);
        } catch (error) {
          if (!isInsufficientFundsError(error) || !gasRetryAddress) throw error;

          console.info(`[GAS_RETRY] Insufficient funds on ${String(prop)}, requesting emergency top-up`);

          // Dedup concurrent funding requests — share the inflight promise
          if (!inflightFunding) {
            inflightFunding = requestEmergencyFunding(gasRetryAddress, {
              delegatorAddress,
              getEmbeddedIdentityToken,
              worldAddress: worldContract.address,
            })
              .finally(() => { inflightFunding = null; });
          }
          const fundResult = await inflightFunding;

          if (!fundResult) {
            console.warn('[GAS_RETRY] Emergency funding request failed');
            throw error;
          }

          if (fundResult === 'has_funds') {
            // Relayer says we already have enough — retry immediately (balance may
            // have recovered between our failed tx and the /fund call)
            console.info('[GAS_RETRY] Relayer says balance is sufficient, retrying immediately');
            return await (original as (...a: unknown[]) => Promise<unknown>)(...args);
          }

          // fundResult === 'funded' — ETH was sent, wait for it to land
          const received = await waitForBalance(1n);
          if (!received) {
            console.warn('[GAS_RETRY] Funding did not arrive in time');
            throw error;
          }

          console.info('[GAS_RETRY] Funding received, retrying action');
          return await (original as (...a: unknown[]) => Promise<unknown>)(...args);
        }
      };
    },
  }) as typeof worldContract.write;

  // Replace worldContract.write for all system calls in this closure.
  // The original worldContract is unchanged — only our local reference is proxied.
  const wrappedWorldContract = { ...worldContract, write: proxiedWrite };

  const resultFromReceipt = (
    receipt: { status: 'reverted' | 'success' },
    failureMessage: string,
  ): { error?: string; success: boolean } => (
    receipt.status === 'success'
      ? { success: true }
      : { success: false, error: failureMessage }
  );

  // Check whether a monster is alive in the local store.
  const isMonsterAlive = (monsterId: string): boolean => {
    const ee = getTableValue('EncounterEntity', monsterId) as { died?: boolean } | undefined;
    const sp = getTableValue('Spawned', monsterId) as { spawned?: boolean } | undefined;
    return !ee?.died && sp?.spawned !== false;
  };

  // Mark a ghost monster as dead/despawned in the local store so it
  // disappears from the UI immediately (MapContext filters on these).
  const evictGhostMonster = (monsterId: string) => {
    const store = useGameStore.getState();
    store.setRow('Spawned', monsterId, { spawned: false });
    store.setRow('EncounterEntity', monsterId, {
      ...(getTableValue('EncounterEntity', monsterId) ?? {}),
      died: true,
    });
    // Protect evicted rows from being re-added by stale WS updates.
    markEvictedRows([
      { table: 'Spawned', keyBytes: monsterId },
      { table: 'EncounterEntity', keyBytes: monsterId },
    ]);
    console.warn(`[ghost] Evicted ghost monster ${monsterId.slice(0, 10)}`);
  };

  // When a ghost is detected, evict ALL monsters on the same tile to prevent
  // the player from clicking dead monsters one-by-one. The next WS update or
  // snapshot re-fetch will bring back any that are actually still alive.
  // Uses applyBatch for a single Zustand set() / React render.
  const evictAllMonstersOnTile = (ghostMonsterId: string) => {
    const pos = getTableValue('PositionV2', ghostMonsterId) as
      | { zoneId?: unknown; x?: unknown; y?: unknown } | undefined;
    if (!pos) {
      evictGhostMonster(ghostMonsterId);
      return;
    }

    const store = useGameStore.getState();
    const spawnedTable = store.tables['Spawned'] || {};
    const positionTable = store.tables['PositionV2'] || {};
    const charactersTable = store.tables['Characters'] || {};

    const gz = String(pos.zoneId);
    const gx = String(pos.x);
    const gy = String(pos.y);
    const batch: BatchUpdate[] = [];

    for (const entityId of Object.keys(spawnedTable)) {
      if (charactersTable[entityId]) continue; // skip player characters
      const ePos = positionTable[entityId] as
        | { zoneId?: unknown; x?: unknown; y?: unknown } | undefined;
      if (!ePos) continue;
      if (String(ePos.zoneId) !== gz || String(ePos.x) !== gx || String(ePos.y) !== gy) continue;

      batch.push({ type: 'set', table: 'Spawned', keyBytes: entityId, data: { spawned: false } });
      batch.push({
        type: 'set', table: 'EncounterEntity', keyBytes: entityId,
        data: { ...(getTableValue('EncounterEntity', entityId) ?? {}), died: true },
      });
    }

    if (batch.length > 0) {
      store.applyBatch(batch);
      // Protect evicted rows from being re-added by stale WS updates.
      markEvictedRows(
        batch.map(u => ({ table: u.table, keyBytes: u.keyBytes })),
      );
    }
    console.warn(`[ghost] Evicted ${batch.length / 2} monsters on tile (${gz},${gx},${gy}) after ghost ${ghostMonsterId.slice(0, 10)}`);
  };

  // ---------------------------------------------------------------------------
  // Proactive tile validation — verify monsters are alive on-chain when the
  // player lands on a tile. Prevents "No enemies here" errors by evicting
  // ghosts BEFORE the player clicks Fight.
  // ---------------------------------------------------------------------------
  const tableResourceId = (namespace: string, name: string): Hex =>
    concat([
      stringToHex('tb', { size: 2 }),
      stringToHex(namespace, { size: 14 }),
      stringToHex(name, { size: 16 }),
    ]);

  const SPAWNED_TABLE_ID = '0x74625544000000000000000000000000537061776e6564000000000000000000' as const;
  const ENCOUNTER_ENTITY_TABLE_ID = '0x74625544000000000000000000000000456e636f756e746572456e7469747900' as const;
  // PositionV2 (zoneId: uint256, x: uint16, y: uint16) — the table the combat system uses.
  // The old "Position" table has stale data for pre-migration monsters.
  const POSITION_TABLE_ID = '0x74625544000000000000000000000000506f736974696f6e5632000000000000' as const;
  const GET_RECORD_ABI = [
    {
      type: 'function' as const,
      name: 'getRecord' as const,
      stateMutability: 'view' as const,
      inputs: [
        { name: 'tableId', type: 'bytes32' as const },
        { name: 'keyTuple', type: 'bytes32[]' as const },
      ],
      outputs: [
        { name: 'staticData', type: 'bytes' as const },
        { name: 'encodedLengths', type: 'bytes32' as const },
        { name: 'dynamicData', type: 'bytes' as const },
      ],
    },
  ] as const;

  type RawStoreRecord = readonly [Hex, Hex, Hex];

  const readStoreRecord = async (
    tableId: Hex,
    entityId: `0x${string}`,
    label: string,
  ): Promise<RawStoreRecord | null> => {
    try {
      return await publicClient.readContract({
        address: worldContract.address,
        abi: GET_RECORD_ABI,
        functionName: 'getRecord',
        args: [tableId, [entityId]],
      }) as RawStoreRecord;
    } catch (error) {
      console.warn(`[store] Failed reading ${label} for ${entityId.slice(0, 10)}`, error);
      return null;
    }
  };

  const syncMonsterPositionFromChain = async (
    monsterId: string,
  ): Promise<{ x: number; y: number } | null> => {
    try {
      const record = await readStoreRecord(POSITION_TABLE_ID, monsterId as `0x${string}`, 'PositionV2');
      if (!record) return null;
      const staticData = record[0] ?? '0x';
      // PositionV2 schema: uint256 zoneId (32 bytes = 64 hex) + uint16 x (2 bytes = 4 hex) + uint16 y (2 bytes = 4 hex)
      // Total static data: 36 bytes = 72 hex chars + '0x' prefix = 74 chars
      // If record is empty or too short, monster has no PositionV2 data.
      if (staticData === '0x' || staticData.length < 74) return null;
      const x = parseInt(staticData.slice(66, 70), 16);
      const y = parseInt(staticData.slice(70, 74), 16);
      const position = { x, y };
      // Sync to both Position and PositionV2 tables in the store
      const currentPosition = getTableValue('PositionV2', monsterId) as
        | { x?: number; y?: number }
        | undefined;
      if (Number(currentPosition?.x) !== position.x || Number(currentPosition?.y) !== position.y) {
        useGameStore.getState().setRow('PositionV2', monsterId, position);
      }
      return position;
    } catch (error) {
      console.warn(`[position] Failed to sync monster ${monsterId.slice(0, 10)} from chain`, error);
      return null;
    }
  };

  const decodeSpawnedRecord = (record: RawStoreRecord | null): boolean | null => {
    if (!record) return null;
    const staticData = record[0] ?? '0x';
    if (staticData === '0x') return false;
    return staticData.length >= 4 && staticData.slice(0, 4) === '0x01';
  };

  const decodeEncounterEntityRecord = (
    record: RawStoreRecord | null,
  ): { encounterId: Hex; died: boolean } | null => {
    if (!record) return null;
    const staticData = record[0] ?? '0x';
    const encounterId = staticData.length >= 66
      ? `0x${staticData.slice(2, 66)}` as Hex
      : zeroHash;
    const died = staticData.length >= 68 && staticData.slice(66, 68) === '01';
    return { encounterId, died };
  };

  const syncMonsterSnapshot = (
    monsterId: string,
    snapshot: {
      encounter: { encounterId: Hex; died: boolean } | null;
      spawned: boolean | null;
    },
  ): void => {
    const store = useGameStore.getState();
    const currentEncounter = getTableValue('EncounterEntity', monsterId) as
      | { encounterId?: string; died?: boolean }
      | undefined;
    if (snapshot.spawned === false) {
      store.setRow('Spawned', monsterId, { spawned: false });
    }
    if (snapshot.encounter) {
      const { encounterId, died } = snapshot.encounter;
      if ((currentEncounter?.encounterId ?? zeroHash) !== encounterId || Boolean(currentEncounter?.died) !== died) {
        store.setRow('EncounterEntity', monsterId, { ...currentEncounter, encounterId, died });
      }
    }
  };

  const validateTileMonsters = async (
    monsterIds: string[],
    expectedPosition?: { x: number; y: number },
  ): Promise<void> => {
    if (monsterIds.length === 0) return;

    const results = await Promise.allSettled(
      monsterIds.map(async (id) => {
        // Read Spawned, EncounterEntity, AND Position concurrently so all three
        // land on the same block — prevents TOCTOU false-positive evictions.
        const [spawnedRecord, encounterRecord, chainPosition] = await Promise.all([
          readStoreRecord(SPAWNED_TABLE_ID, id as `0x${string}`, 'Spawned'),
          readStoreRecord(ENCOUNTER_ENTITY_TABLE_ID, id as `0x${string}`, 'EncounterEntity'),
          expectedPosition ? syncMonsterPositionFromChain(id) : Promise.resolve(null),
        ]);
        return {
          chainPosition,
          encounter: decodeEncounterEntityRecord(encounterRecord),
          id,
          spawned: decodeSpawnedRecord(spawnedRecord),
        };
      }),
    );

    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      const { chainPosition, encounter, id, spawned } = r.value;
      const inEncounter = Boolean(encounter && encounter.encounterId !== zeroHash);
      const positionIsCleared = chainPosition !== null && chainPosition.x === 0 && chainPosition.y === 0;
      const offTile = Boolean(
        expectedPosition && chainPosition && !positionIsCleared &&
        (chainPosition.x !== expectedPosition.x || chainPosition.y !== expectedPosition.y),
      );
      const isGhost = spawned === false || Boolean(encounter?.died) || offTile || positionIsCleared;

      if (!isGhost && !inEncounter) continue;

      if (offTile || inEncounter) {
        syncMonsterSnapshot(id, { encounter, spawned });
      } else {
        evictGhostMonster(id);
      }

      if (offTile) {
        console.warn(`[validateTile] Synced off-tile monster ${id.slice(0, 10)} to (${chainPosition?.x},${chainPosition?.y})`);
      } else if (positionIsCleared) {
        console.warn(`[validateTile] Evicted cleared-position monster ${id.slice(0, 10)}`);
      } else if (isGhost) {
        console.warn(`[validateTile] Evicted ghost monster ${id.slice(0, 10)}`);
      }
    }
  };

  // Selectors for ghost monster revert errors (InvalidCombatEntity / InvalidPvE).
  const INVALID_COMBAT_ENTITY_SELECTOR = '1af235ec';
  const INVALID_PVE_SELECTOR = 'adee4371';

  const isGhostMonsterError = (e: unknown): boolean => {
    const msg = String(e).toLowerCase();
    return msg.includes(INVALID_COMBAT_ENTITY_SELECTOR) ||
      msg.includes(INVALID_PVE_SELECTOR) ||
      msg.includes('invalidcombatentity');
  };

  // Validates character ownership by reading from the Zustand game store.
  const validateCharacterOwnership = (
    characterEntity: string,
    fnName: string,
  ): { success: false; error: string } | null => {
    const entity = characterEntity.toString();

    // Read from Zustand store instead of RECS
    const character = getTableValue('Characters', entity) as
      | { owner: string } | undefined;
    if (!character) {
      const msg = `${fnName}: entity is not a valid character`;
      console.warn(`[OWNERSHIP] ${msg}`);
      return { success: false, error: msg };
    }

    const expectedOwner = delegatorAddress ?? walletClient?.account?.address;
    if (expectedOwner && character.owner.toLowerCase() !== expectedOwner.toLowerCase()) {
      const msg = `${fnName}: not character owner`;
      console.warn(`[OWNERSHIP] ${msg}`);
      return { success: false, error: msg };
    }

    return null;
  };

  const buy = async (
    amount: bigint,
    shopId: string,
    itemIndex: string,
    characterId: string,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterId, 'buy');
    if (ownershipError) return ownershipError;

    try {
      const tx = await wrappedWorldContract.write.UD__buy([
        amount,
        shopId as `0x${string}`,
        BigInt(itemIndex),
        characterId as `0x${string}`,
      ]);

      const txResult = await waitForTransaction(tx);
      return {
        error: txResult.status === 'success' ? undefined : 'Failed to buy item.',
        success: txResult.status === 'success',
      };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const cancelOrder = async (orderHash: string): SystemCallReturn => {
    try {
      const tx = await wrappedWorldContract.write.UD__cancelOrder([orderHash as Hash]);
      const txResult = await waitForTransaction(tx);

      return {
        error: txResult.status === 'success' ? undefined : 'Failed to cancel order.',
        success: txResult.status === 'success',
      };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  // Gas limit for PvE encounter creation — skip eth_estimateGas because
  // Privy's RPC returns "execution reverted" with no selector on ghost
  // monsters, making it impossible to identify the error. Let the TX go
  // on-chain and diagnose from the receipt via eth_call simulation.
  const CREATE_ENCOUNTER_GAS_LIMIT = BigInt(10_000_000);

  const createEncounter = async (
    encounterType: EncounterType,
    group1: string[],
    group2: string[],
  ): SystemCallReturn => {
    // Pre-flight: for PvE, verify all opponents are still alive in the store.
    // If any are ghosts, evict ALL monsters on the same tile so the player
    // doesn't have to click through dead monsters one-by-one.
    if (encounterType === EncounterType.PvE) {
      const deadTargets = group2.filter(id => !isMonsterAlive(id));
      if (deadTargets.length > 0) {
        deadTargets.forEach(evictAllMonstersOnTile);
        return {
          success: false,
          error: 'No enemies here — try moving to another tile.',
          severity: 'warning',
        };
      }
    }

    try {
      // For PvE, skip gas estimation to avoid EstimateGasExecutionError on
      // ghost monsters (Privy RPC strips revert selectors from eth_estimateGas).
      const gasOverride = encounterType === EncounterType.PvE
        ? { gas: CREATE_ENCOUNTER_GAS_LIMIT }
        : {};

      console.info(`[createEncounter] DEBUG type=${encounterType} group1=[${group1.join(',')}] group2=[${group2.join(',')}]`);

      const tx = await wrappedWorldContract.write.UD__createEncounter(
        [
          encounterType,
          group1 as `0x${string}`[],
          group2 as `0x${string}`[],
        ],
        gasOverride,
      );

      const receipt = await waitForTransaction(tx);
      if (receipt.status === 'reverted' && encounterType === EncounterType.PvE) {
        // Diagnostic simulation — eth_call DOES return revert selectors
        try {
          await worldContract.simulate.UD__createEncounter([
            encounterType,
            group1 as `0x${string}`[],
            group2 as `0x${string}`[],
          ], { account: diagAccount });
        } catch (diagError) {
          if (isGhostMonsterError(diagError)) {
            group2.forEach(evictAllMonstersOnTile);
            return { success: false, error: 'No enemies here — try moving to another tile.', severity: 'warning' };
          }
          return { success: false, error: getContractError(diagError) };
        }
        return { success: false, error: 'Failed to create encounter.' };
      }

      return {
        error: receipt.status === 'reverted' ? 'Failed to create encounter.' : undefined,
        success: receipt.status !== 'reverted',
      };
    } catch (e) {
      // Stale JS chunk after deploy (e.g. viem CCIP lazy import) — reload to fix
      if (reloadIfStaleChunk(e)) {
        return { success: false, error: 'Updating game — reloading...' };
      }
      if (encounterType === EncounterType.PvE && isGhostMonsterError(e)) {
        group2.forEach(evictAllMonstersOnTile);
        return { success: false, error: 'No enemies here — try moving to another tile.', severity: 'warning' };
      }
      // Fallback: if gas estimation somehow leaks through (shouldn't with gas
      // override), try simulation to extract the real revert reason.
      if (encounterType === EncounterType.PvE) {
        try {
          await worldContract.simulate.UD__createEncounter([
            encounterType,
            group1 as `0x${string}`[],
            group2 as `0x${string}`[],
          ], { account: diagAccount });
        } catch (diagError) {
          if (isGhostMonsterError(diagError)) {
            group2.forEach(evictAllMonstersOnTile);
            return { success: false, error: 'No enemies here — try moving to another tile.', severity: 'warning' };
          }
          return { success: false, error: getContractError(diagError) };
        }
      }
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const createOrder = async (order: NewOrder): SystemCallReturn => {
    try {
      const tx = await wrappedWorldContract.write.UD__createOrder([order]);
      const txResult = await waitForTransaction(tx);

      return {
        error: txResult.status === 'success' ? undefined : 'Failed to create order.',
        success: txResult.status === 'success',
      };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const endShopEncounter = async (encounterId: string): SystemCallReturn => {
    // Check the store first — if the encounter is already ended (e.g. by moving
    // away), skip the chain call entirely to avoid noisy relayer errors.
    const encounter = getTableValue('WorldEncounter', encounterId);
    if (!encounter || BigInt(encounter.end as string | number) !== BigInt(0)) {
      return { success: true };
    }

    try {
      const tx = await wrappedWorldContract.write.UD__endShopEncounter([
        encounterId as `0x${string}`,
      ]);

      const receipt = await waitForTransaction(tx);
      return {
        error: receipt.status === 'reverted' ? 'Failed to end shop encounter.' : undefined,
        success: receipt.status !== 'reverted',
      };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const endWorldEncounter = async (encounterId: string): SystemCallReturn => {
    // Check the store first — if already ended, skip the chain call.
    const encounter = getTableValue('WorldEncounter', encounterId);
    if (!encounter || BigInt(encounter.end as string | number) !== BigInt(0)) {
      return { success: true };
    }

    try {
      const tx = await wrappedWorldContract.write.UD__endEncounter([
        encounterId as `0x${string}`,
        BigInt(0),
        false,
      ]);
      await waitForTransaction(tx);
      return { success: true };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const endTurn = async (
    encounterId: string,
    playerId: string,
    defenderId: string,
    itemId: string,
  ): SystemCallReturn => {
    // Check the store first — if the encounter already ended (defender died on
    // previous turn), skip the chain call to avoid a revert.
    const combatEncounter = getTableValue('CombatEncounter', encounterId);
    if (!combatEncounter || BigInt(combatEncounter.end as string | number) !== BigInt(0)) {
      return { success: true };
    }

    const ownershipError = validateCharacterOwnership(playerId, 'endTurn');
    if (ownershipError) return ownershipError;

    try {
      const actions = [
        {
          attackerEntityId: playerId as `0x${string}`,
          defenderEntityId: defenderId as `0x${string}`,
          itemId: BigInt(itemId),
        },
      ];

      const tx = await wrappedWorldContract.write.UD__endTurn(
        [
          encounterId as `0x${string}`,
          playerId as `0x${string}`,
          actions,
        ],
        {
          gas: BigInt('10000000'),
        },
      );

      const receipt = await waitForTransaction(tx);
      if (receipt.status !== 'success') {
        // TX reverted on-chain — simulate to extract revert reason
        console.error(`[TX_ERROR][ON_CHAIN_REVERT] endTurn reverted, tx=${tx}`);
        try {
          await publicClient.simulateContract({
            address: worldContract.address,
            abi: worldContract.abi,
            functionName: 'UD__endTurn',
            args: [
              encounterId as `0x${string}`,
              playerId as `0x${string}`,
              actions,
            ],
            account: walletClient?.account,
          });
        } catch (simErr) {
          const revertMsg = getContractError(simErr);
          return { error: revertMsg, success: false };
        }
        return { error: 'Attack reverted on-chain (unknown reason)', success: false };
      }
      return { success: true };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const enterGame = async (
    characterEntity: string,
    starterWeaponId: bigint,
    starterArmorId: bigint,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterEntity, 'enterGame');
    if (ownershipError) return ownershipError;

    try {
      const tx = await wrappedWorldContract.write.UD__enterGame([
        characterEntity as `0x${string}`,
        starterWeaponId,
        starterArmorId,
      ]);

      const receipt = await waitForTransaction(tx);
      return resultFromReceipt(receipt, 'Failed to enter game.');
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const equipItems = async (
    characterEntity: string,
    itemIds: string[],
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterEntity, 'equipItems');
    if (ownershipError) return ownershipError;

    try {
      const tx = await wrappedWorldContract.write.UD__equipItems([
        characterEntity as `0x${string}`,
        itemIds.map(itemId => BigInt(itemId)),
      ]);

      const receipt = await waitForTransaction(tx);
      return resultFromReceipt(receipt, 'Failed to equip items.');
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const fleePvp = async (characterId: string): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterId, 'fleePvp');
    if (ownershipError) return ownershipError;

    try {
      const tx = await wrappedWorldContract.write.UD__fleePvp([
        characterId as `0x${string}`,
      ]);

      const receipt = await waitForTransaction(tx);
      return { success: receipt.status === 'success' };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const fulfillOrder = async (orderHash: string): SystemCallReturn => {
    try {
      const tx = await wrappedWorldContract.write.UD__fulfillOrder([
        orderHash as Hash,
      ]);
      const txResult = await waitForTransaction(tx);

      if (txResult.status === 'reverted') {
        // Diagnostic simulation to extract real revert reason
        try {
          await worldContract.simulate.UD__fulfillOrder(
            [orderHash as Hash],
            { account: diagAccount },
          );
        } catch (diagError) {
          return { success: false, error: getContractError(diagError) };
        }
      }

      return {
        error: txResult.status === 'success' ? undefined : 'Failed to fulfill order.',
        success: txResult.status === 'success',
      };
    } catch (e) {
      // Viem masks contract reverts as InsufficientFundsError when the
      // player's ETH balance is low. Run diagnostic simulation to get
      // the real revert reason (if any) before falling back to the gas error.
      if (isInsufficientFundsError(e)) {
        try {
          await worldContract.simulate.UD__fulfillOrder(
            [orderHash as Hash],
            { account: diagAccount },
          );
          // Simulation passed — genuinely a gas issue, not a revert
        } catch (diagError) {
          // Real contract revert found — return that instead
          return { success: false, error: getContractError(diagError) };
        }
      }
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const levelCharacter = async (
    characterId: string,
    entityStats: Omit<EntityStats, 'entityClass'> & {
      class: StatsClasses;
    },
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterId, 'levelCharacter');
    if (ownershipError) return ownershipError;

    try {
      const formattedNewStats = {
        strength: BigInt(entityStats.strength),
        agility: BigInt(entityStats.agility),
        class: entityStats.class,
        intelligence: BigInt(entityStats.intelligence),
        maxHp: BigInt(entityStats.maxHp),
        currentHp: BigInt(entityStats.currentHp),
        experience: BigInt(entityStats.experience),
        level: BigInt(entityStats.level) + BigInt(1),
        powerSource: entityStats.powerSource ?? PowerSource.None,
        race: entityStats.race ?? Race.None,
        startingArmor: entityStats.startingArmor ?? ArmorType.None,
        advancedClass: entityStats.advancedClass ?? AdvancedClass.None,
        hasSelectedAdvancedClass: entityStats.hasSelectedAdvancedClass ?? false,
      };

      const tx = await wrappedWorldContract.write.UD__levelCharacter([
        characterId as `0x${string}`,
        formattedNewStats,
      ]);

      const receipt = await waitForTransaction(tx);
      return resultFromReceipt(receipt, 'Failed to level character.');
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const mintCharacter = async (
    account: Address,
    name: string,
    uri: string,
  ): SystemCallReturn => {
    try {
      const nameHex = stringToHex(name, { size: 32 });

      const tx = await wrappedWorldContract.write.UD__mintCharacter([
        account,
        nameHex,
        uri,
      ]);

      const txResult = await waitForTransaction(tx);

      return {
        error: txResult.status === 'success' ? undefined : 'Failed to mint character.',
        success: txResult.status === 'success',
      };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  let isMovePending = false;

  // Adaptive move throttle: starts at BASE_MOVE_GAP_MS, widens to
  // BACKPRESSURE_MOVE_GAP_MS after a revert (state was stale — give the
  // RPC time to catch up), then decays back after DECAY_AFTER_SUCCESSES
  // consecutive successful moves. Prevents burning relayer gas on repeated
  // reverts while keeping movement snappy when healthy.
  const BASE_MOVE_GAP_MS = 200;
  const BACKPRESSURE_MOVE_GAP_MS = 500;
  const DECAY_AFTER_SUCCESSES = 3;
  let currentMoveGapMs = BASE_MOVE_GAP_MS;
  let consecutiveSuccesses = 0;

  // Local timestamp (ms) of the last move completion (success or revert).
  let lastMoveCompletedMs = 0;

  const INVALID_MOVE_SELECTOR = '87822d34';
  const NOT_SPAWNED_SELECTOR = 'bd45e4f6';

  const isInvalidMoveError = (e: unknown): boolean => {
    const msg = String(e).toLowerCase();
    return msg.includes(INVALID_MOVE_SELECTOR) || msg.includes('invalid move') || msg.includes('invalidmove');
  };

  const isNotSpawnedError = (e: unknown): boolean => {
    const msg = String(e).toLowerCase();
    return msg.includes(NOT_SPAWNED_SELECTOR) || msg.includes('not spawned') || msg.includes('notspawned');
  };

  /**
   * Adaptive debounce between consecutive moves.
   * On-chain cooldown is 0 — this prevents queueing moves faster than the
   * pipeline can process them. Widens after reverts, decays after successes.
   */
  const waitForMoveCooldown = async () => {
    if (lastMoveCompletedMs > 0) {
      const elapsedMs = Date.now() - lastMoveCompletedMs;
      if (elapsedMs < currentMoveGapMs) {
        const delayMs = currentMoveGapMs - elapsedMs;
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  };

  const onMoveSuccess = () => {
    lastMoveCompletedMs = Date.now();
    consecutiveSuccesses++;
    if (consecutiveSuccesses >= DECAY_AFTER_SUCCESSES && currentMoveGapMs > BASE_MOVE_GAP_MS) {
      currentMoveGapMs = BASE_MOVE_GAP_MS;
      console.info(`[move] Throttle decayed to ${BASE_MOVE_GAP_MS}ms after ${consecutiveSuccesses} successes`);
    }
  };

  const onMoveRevert = () => {
    lastMoveCompletedMs = Date.now();
    consecutiveSuccesses = 0;
    if (currentMoveGapMs < BACKPRESSURE_MOVE_GAP_MS) {
      currentMoveGapMs = BACKPRESSURE_MOVE_GAP_MS;
      console.warn(`[move] Throttle widened to ${BACKPRESSURE_MOVE_GAP_MS}ms after revert`);
    }
  };

  // MoveTooFast selector — on-chain MOVE_COOLDOWN is 0 so this error can only
  // come from stale RPC state during eth_call simulation (Base L2 edge case
  // where state propagates faster than block headers). Safe to skip simulation.
  const MOVE_TOO_FAST_SELECTOR = '326f4b4f';

  const isMoveTooFastError = (e: unknown): boolean => {
    const msg = String(e).toLowerCase();
    return msg.includes(MOVE_TOO_FAST_SELECTOR) || msg.includes('movetoofast');
  };

  // Transient RPC/network errors — not the player's fault, just stale state.
  const isTransientRpcError = (e: unknown): boolean => {
    const msg = String(e).toLowerCase();
    return /failed to fetch|timeout|network|econnrefused|econnreset|socket hang up|rate limit|429|502|503|504/.test(msg);
  };

  const MOVE_STALE_STATE_WARNING = "You're moving too fast! Take a moment and try again.";

  // Gas limit for moves that skip simulation (covers spawnOnTileEnter worst case).
  // Tiles accumulate mobs across sessions; spawning into a dense tile requires
  // significantly more gas due to EntitiesAtPosition reads + multiple mob writes.
  const MOVE_GAS_LIMIT = BigInt(8_000_000);

  // On-chain retry: if the receipt reverts, diagnose then retry once.
  // Transient reverts (stale RPC, same-block timing) are common during rapid
  // movement — the diagnostic simulation confirms the move is now valid.
  const ON_CHAIN_RETRY_DELAY_MS = 500;
  const MAX_ON_CHAIN_RETRIES = 1;

  type Direction = 'up' | 'down' | 'left' | 'right';
  type MoveDiagnosticResult =
    | { result: 'pass' }
    | { result: 'timeout' }
    | { result: 'transient' }
    | { result: 'not_spawned' | 'invalid_move' | 'error'; error: unknown };

  const applyDirection = (
    position: { x: number; y: number },
    direction: Direction,
  ): { x: number; y: number } => {
    let { x, y } = position;
    switch (direction) {
      case 'up': y += 1; break;
      case 'down': y -= 1; break;
      case 'left': x -= 1; break;
      case 'right': x += 1; break;
    }
    return { x, y };
  };

  const move = async (
    characterEntity: string,
    direction: Direction,
  ): SystemCallReturn => {
    if (isMovePending) {
      console.warn('[move] Move already in progress, ignoring request');
      return { success: false, error: 'Move in progress.' };
    }

    const ownershipError = validateCharacterOwnership(characterEntity, 'move');
    if (ownershipError) return ownershipError;

    // Check store for active encounter — prevents sending a doomed tx when
    // the previous move triggered a mob spawn (receipt already applied to store
    // but React hasn't re-rendered currentBattle yet).
    const encounterState = getTableValue('EncounterEntity', characterEntity) as
      | { encounterId: string } | undefined;
    if (encounterState?.encounterId && encounterState.encounterId !== ('0x' + '0'.repeat(64))) {
      return { success: false, error: 'In encounter.' };
    }

    // Read position from the Zustand store (updated synchronously from receipts).
    // PositionV2 is canonical — the deployed contract writes (zoneId, x, y) to it.
    // Position fallback kept for any legacy state still in the store.
    const pos = (getTableValue('PositionV2', characterEntity) ?? getTableValue('Position', characterEntity)) as
      | { x: number; y: number } | undefined;
    if (!pos) {
      return { success: false, error: 'Position not found.' };
    }

    let { x, y } = applyDirection(
      { x: Number(pos.x), y: Number(pos.y) },
      direction,
    );

    isMovePending = true;
    try {
      await waitForMoveCooldown();

      let args: [`0x${string}`, number, number] = [characterEntity as `0x${string}`, x, y];
      let onChainRetries = 0;

      const diagnoseMove = async (timeoutMs: number): Promise<MoveDiagnosticResult> => {
        let timedOut = false;
        try {
          await Promise.race([
            worldContract.simulate.UD__move(args, { account: diagAccount }).then(() => undefined),
            new Promise<void>((_, reject) => setTimeout(() => {
              timedOut = true;
              reject(new Error('diag timeout'));
            }, timeoutMs)),
          ]);
          return { result: 'pass' };
        } catch (error) {
          if (timedOut) return { result: 'timeout' };
          if (isNotSpawnedError(error)) {
            return { result: 'not_spawned', error };
          }
          if (isInvalidMoveError(error)) {
            return { result: 'invalid_move', error };
          }
          if (isMoveTooFastError(error) || isTransientRpcError(error)) {
            return { result: 'transient' };
          }
          return { result: 'error', error };
        }
      };

      const handleNotSpawned = () => {
        console.warn('[move] Character is not spawned — updating store');
        useGameStore.getState().setRow('Spawned', characterEntity, { spawned: false });
        onMoveRevert();
        return { success: false as const, error: 'Session expired — respawn to continue.' };
      };

      // Always skip simulation for moves. MOVE_COOLDOWN is 0 on-chain, but
      // Base flashblocks propagate state faster than block headers — eth_call
      // simulation sees a new SessionTimer but an old block.timestamp, causing
      // MoveTooFast 100% of the time during rapid play. Client-side already
      // validates boundaries, spawned state, and encounters. Sending with a
      // generous gas limit; real errors are caught via receipt + diagnostic.
      for (let attempt = 0; attempt < 1 + MAX_ON_CHAIN_RETRIES; attempt++) {
        try {
          let tx: `0x${string}`;

          if (onChainRetries > 0) {
            console.warn(`[move] Retry ${onChainRetries} — sending with gas ${MOVE_GAS_LIMIT} (target: ${x},${y})`);
          }
          tx = await wrappedWorldContract.write.UD__move(args, { gas: MOVE_GAS_LIMIT });

          const receipt = await waitForTransaction(tx);
          if (receipt.status === 'reverted') {
            console.error(`[move] TX REVERTED — hash: ${tx}, gasUsed: ${receipt.gasUsed}, block: ${receipt.blockNumber} (target: ${x},${y})`);

            // Fast diagnostic: race the simulation against a 1.5s timeout.
            // The full RPC fallback chain can take 10-30s if endpoints are
            // returning 400/429 — we'd rather return a warning quickly and
            // let the player retry than lock them out.
            const DIAG_TIMEOUT_MS = 1500;
            const diagnostic = await diagnoseMove(DIAG_TIMEOUT_MS);

            if (diagnostic.result === 'not_spawned') {
              return handleNotSpawned();
            }

            if (diagnostic.result === 'invalid_move' && onChainRetries < MAX_ON_CHAIN_RETRIES) {
              console.warn('[move] Position stale after revert — re-reading store');
              const freshPos = (getTableValue('PositionV2', characterEntity) ?? getTableValue('Position', characterEntity)) as
                | { x: number; y: number } | undefined;
              if (freshPos) {
                const nextPosition = applyDirection(
                  { x: Number(freshPos.x), y: Number(freshPos.y) },
                  direction,
                );
                x = nextPosition.x;
                y = nextPosition.y;
                args = [characterEntity as `0x${string}`, x, y];
                onChainRetries++;
                continue;
              }
            }

            if (diagnostic.result === 'pass' && onChainRetries < MAX_ON_CHAIN_RETRIES) {
              onChainRetries++;
              console.warn(`[move] Simulation now passes — retrying (${onChainRetries}/${MAX_ON_CHAIN_RETRIES})`);
              await new Promise(r => setTimeout(r, ON_CHAIN_RETRY_DELAY_MS));
              continue;
            }

            // Timeout, transient, MoveTooFast, or retries exhausted — warn and let player retry
            if (diagnostic.result === 'error') {
              console.error(`[move] Diagnostic error:`, diagnostic.error);
              onMoveRevert();
              return { success: false, error: getContractError(diagnostic.error) };
            }
            console.warn(`[move] On-chain revert — ${diagnostic.result} (target: ${x},${y})`);
            onMoveRevert();
            return { success: false, error: MOVE_STALE_STATE_WARNING, severity: 'warning' };
          }
          onMoveSuccess();
          return { success: true };
        } catch (e) {
          // Stale-state / transient errors → yellow warning, not red error
          if (isMoveTooFastError(e) || isTransientRpcError(e)) {
            return { success: false, error: MOVE_STALE_STATE_WARNING, severity: 'warning' };
          }
          return {
            error: getContractError(e),
            success: false,
          };
        }
      }
      return { success: false, error: MOVE_STALE_STATE_WARNING, severity: 'warning' };
    } finally {
      isMovePending = false;
    }
  };

  // --- Auto Adventure (move + auto-fight first mob, deprecated) ---
  // Gas limit for autoAdventure — covers move + spawn + full combat loop + rewards.
  // Higher than MOVE_GAS_LIMIT because combat resolution is included in the same tx.
  const AUTO_ADVENTURE_GAS_LIMIT = BigInt(50_000_000);

  const autoAdventure = async (
    characterEntity: string,
    direction: Direction,
  ): SystemCallReturn => {
    if (isMovePending) {
      return { success: false, error: 'Action in progress.' };
    }

    const ownershipError = validateCharacterOwnership(characterEntity, 'autoAdventure');
    if (ownershipError) return ownershipError;

    // Same store-based position read as move — PositionV2 is canonical (contract writes to it)
    const pos = (getTableValue('PositionV2', characterEntity) ?? getTableValue('Position', characterEntity)) as
      | { x: number; y: number } | undefined;
    if (!pos) {
      return { success: false, error: 'Position not found.' };
    }

    let x = Number(pos.x);
    let y = Number(pos.y);
    switch (direction) {
      case 'up': y += 1; break;
      case 'down': y -= 1; break;
      case 'left': x -= 1; break;
      case 'right': x += 1; break;
    }

    isMovePending = true;
    try {
      await waitForMoveCooldown();

      // Skip simulation — send with hardcoded gas limit (same pattern as move retries).
      // AutoAdventure is always a bigger tx than move, so we skip sim to avoid
      // the extra RPC round-trip (~100-200ms latency saved per action).
      const tx = await wrappedWorldContract.write.UD__autoAdventure(
        [characterEntity as `0x${string}`, x, y],
        { gas: AUTO_ADVENTURE_GAS_LIMIT },
      );

      const receipt = await waitForTransaction(tx);
      lastMoveCompletedMs = Date.now();

      if (receipt.status === 'reverted') {
        // Diagnose: check for NotSpawned (idle timeout)
        try {
          await worldContract.simulate.UD__autoAdventure(
            [characterEntity as `0x${string}`, x, y],
            { account: diagAccount },
          );
        } catch (diagError) {
          if (isNotSpawnedError(diagError)) {
            useGameStore.getState().setRow('Spawned', characterEntity, { spawned: false });
            return { success: false, error: 'Session expired — respawn to continue.' };
          }
          return { success: false, error: getContractError(diagError) };
        }
        return { success: false, error: 'Auto adventure failed — try again.' };
      }

      // Receipt is decoded by applyReceiptToStore automatically — same tables
      // (Position, CombatEncounter, ActionOutcome, CombatOutcome, Stats, etc.)
      // are written by AutoAdventureSystem, so the existing receipt log decoding
      // pipeline updates the Zustand store at ~0ms. No special handling needed.
      return { success: true };
    } catch (e) {
      lastMoveCompletedMs = Date.now();
      return {
        error: getContractError(e),
        success: false,
      };
    } finally {
      isMovePending = false;
    }
  };

  // --- Auto Fight (single-tx targeted combat for auto adventure mode) ---
  // Gas limit covers full combat loop + rewards. Weapons with multiple effects
  // (e.g. Phasefang: PhysDmg + poison_dot + blind) need ~1.6M gas/round × 15
  // rounds = ~24M. 50M gives comfortable headroom within Base's 60M block limit.
  const AUTO_FIGHT_GAS_LIMIT = BigInt(50_000_000);

  const autoFight = async (
    characterEntity: string,
    monsterId: string,
    weaponId: string,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterEntity, 'autoFight');
    if (ownershipError) return ownershipError;

    // Pre-flight: verify monster is still alive in the store.
    if (!isMonsterAlive(monsterId)) {
      evictAllMonstersOnTile(monsterId);
      return {
        success: false,
        error: 'No enemies here — try moving to another tile.',
        severity: 'warning',
      };
    }

    try {
      console.info(`[autoFight] Sending TX — char=${characterEntity.slice(0, 10)} monster=${monsterId.slice(0, 10)} weapon=${weaponId} gas=${AUTO_FIGHT_GAS_LIMIT}`);
      const tx = await wrappedWorldContract.write.UD__autoFight(
        [characterEntity as `0x${string}`, monsterId as `0x${string}`, BigInt(weaponId)],
        { gas: AUTO_FIGHT_GAS_LIMIT },
      );
      console.info(`[autoFight] TX sent: ${tx}`);

      const receipt = await waitForTransaction(tx);
      console.info(`[autoFight] Receipt: status=${receipt.status} gasUsed=${receipt.gasUsed} block=${receipt.blockNumber}`);

      if (receipt.status === 'reverted') {
        console.error(`[autoFight] ON-CHAIN REVERT — gasUsed=${receipt.gasUsed}/${AUTO_FIGHT_GAS_LIMIT} (${Number(receipt.gasUsed) * 100 / Number(AUTO_FIGHT_GAS_LIMIT)}%)`);
        try {
          await worldContract.simulate.UD__autoFight(
            [characterEntity as `0x${string}`, monsterId as `0x${string}`, BigInt(weaponId)],
            { account: diagAccount },
          );
          console.warn('[autoFight] Diagnostic simulation PASSED — was transient');
        } catch (diagError) {
          console.error('[autoFight] Diagnostic simulation FAILED:', diagError);
          if (isNotSpawnedError(diagError)) {
            useGameStore.getState().setRow('Spawned', characterEntity, { spawned: false });
            return { success: false, error: 'Session expired — respawn to continue.' };
          }
          if (isGhostMonsterError(diagError)) {
            evictAllMonstersOnTile(monsterId);
            return { success: false, error: 'No enemies here — try moving to another tile.', severity: 'warning' };
          }
          return { success: false, error: getContractError(diagError) };
        }
        return { success: false, error: 'Auto fight failed — try again.' };
      }

      return { success: true };
    } catch (e) {
      console.error('[autoFight] WRITE THREW (pre-send or submission error):', e);
      if (reloadIfStaleChunk(e)) {
        return { success: false, error: 'Updating game — reloading...' };
      }
      if (isGhostMonsterError(e)) {
        evictAllMonstersOnTile(monsterId);
        return { success: false, error: 'No enemies here — try moving to another tile.', severity: 'warning' };
      }
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const removeEntityFromBoard = async (entity: string): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(entity, 'removeEntityFromBoard');
    if (ownershipError) return ownershipError;

    try {
      const tx = await wrappedWorldContract.write.UD__removeEntityFromBoard([
        entity as `0x${string}`,
      ]);

      const receipt = await waitForTransaction(tx);
      return { success: receipt.status === 'success' };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const restock = async (shopId: string): SystemCallReturn => {
    try {
      const canRestock = await worldContract.read.UD__canRestock([
        shopId as `0x${string}`,
      ]);
      if (!canRestock) {
        return {
          error: undefined,
          success: true,
        };
      }
      const tx = await wrappedWorldContract.write.UD__restock([
        shopId as `0x${string}`,
      ]);

      const txResult = await waitForTransaction(tx);
      return {
        error: txResult.status === 'success' ? undefined : 'Failed to restock shop.',
        success: txResult.status === 'success',
      };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const rollStats = async (
    characterEntity: string,
    characterClass: StatsClasses,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterEntity, 'rollStats');
    if (ownershipError) return ownershipError;

    try {
      const randomString = 'UltimateDominion';
      const userRandomNumber = keccak256(toBytes(randomString));

      const tx = await wrappedWorldContract.write.UD__rollStats([
        userRandomNumber,
        characterEntity as `0x${string}`,
        characterClass,
      ]);

      const receipt = await waitForTransaction(tx);
      if (receipt.status !== 'success') {
        return { success: false, error: 'Failed to roll stats.' };
      }
      const blockNumber = receipt.blockNumber;

      const chainId = await publicClient.getChainId();
      if (chainId !== 31337) {
        const blockToWaitFor = blockNumber + BigInt(2);

        let currentBlockNumber = await publicClient.getBlockNumber();
        while (currentBlockNumber < blockToWaitFor) {
          await new Promise(resolve => setTimeout(resolve, 250));
          currentBlockNumber = await publicClient.getBlockNumber();
        }
      }

      return {
        success: true,
      };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const sell = async (
    amount: bigint,
    shopId: string,
    itemId: string,
    characterId: string,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterId, 'sell');
    if (ownershipError) return ownershipError;

    try {
      const tx = await wrappedWorldContract.write.UD__sellAny([
        amount,
        shopId as `0x${string}`,
        BigInt(itemId),
        characterId as `0x${string}`,
      ]);

      const txResult = await waitForTransaction(tx);
      return {
        error: txResult.status === 'success' ? undefined : 'Failed to sell item.',
        success: txResult.status === 'success',
      };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const spawn = async (characterEntity: string): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterEntity, 'spawn');
    if (ownershipError) return ownershipError;

    try {
      const tx = await wrappedWorldContract.write.UD__spawn([
        characterEntity as `0x${string}`,
      ]);

      const txResult = await waitForTransaction(tx);
      return {
        error: txResult.status === 'success' ? undefined : 'Failed to spawn.',
        success: txResult.status === 'success',
      };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const transitionZone = async (
    characterEntity: string,
    targetZoneId: number,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterEntity, 'transitionZone');
    if (ownershipError) return ownershipError;

    try {
      const tx = await wrappedWorldContract.write.UD__transitionZone([
        characterEntity as `0x${string}`,
        BigInt(targetZoneId),
      ]);

      const txResult = await waitForTransaction(tx);
      return {
        error: txResult.status === 'success' ? undefined : 'Failed to transition zone.',
        success: txResult.status === 'success',
      };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const unequipItem = async (
    characterEntity: string,
    itemId: string,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterEntity, 'unequipItem');
    if (ownershipError) return ownershipError;

    try {
      const tx = await wrappedWorldContract.write.UD__unequipItem([
        characterEntity as `0x${string}`,
        BigInt(itemId),
      ]);

      const receipt = await waitForTransaction(tx);
      return resultFromReceipt(receipt, 'Failed to unequip item.');
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const updateTokenUri = async (
    characterId: string,
    characterMetadataCid: string,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterId, 'updateTokenUri');
    if (ownershipError) return ownershipError;

    try {
      const tx = await wrappedWorldContract.write.UD__updateTokenUri([
        characterId as `0x${string}`,
        characterMetadataCid,
      ]);

      const receipt = await waitForTransaction(tx);
      return { success: receipt.status === 'success' };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  // Gas limit for rest — skip eth_estimateGas. Deferred splice race can show
  // the rest button while on-chain the character is still in an encounter;
  // Privy RPC strips revert selectors from estimation errors.
  const REST_GAS_LIMIT = BigInt(5_000_000);

  const rest = async (entity: string): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(entity, 'rest');
    if (ownershipError) return ownershipError;

    // Store check: if the character appears to be in an encounter, bail early.
    // (Covers most cases; the on-chain revert path below handles the race.)
    const ee = getTableValue('EncounterEntity', entity) as { encounterId?: string } | undefined;
    if (ee?.encounterId && ee.encounterId !== ('0x' + '0'.repeat(64))) {
      return { success: false, error: 'Finish the battle first.', severity: 'warning' };
    }

    try {
      const characterId = entity as `0x${string}`;

      const tx = await wrappedWorldContract.write.UD__rest([characterId], { gas: REST_GAS_LIMIT });

      const receipt = await waitForTransaction(tx);
      if (receipt.status === 'reverted') {
        // Diagnostic simulation to get the actual revert reason
        try {
          await worldContract.simulate.UD__rest([characterId], { account: diagAccount });
        } catch (diagError) {
          return { success: false, error: getContractError(diagError) };
        }
        return { success: false, error: 'Rest failed — try again.' };
      }
      return { success: true };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const useWorldConsumableItem = async (
    entity: string,
    tokenId: string,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(entity, 'useWorldConsumableItem');
    if (ownershipError) return ownershipError;

    try {
      const characterId = entity as `0x${string}`;
      const args: [`0x${string}`, `0x${string}`, bigint] = [
        characterId,
        characterId,
        BigInt(tokenId),
      ];

      const tx = await wrappedWorldContract.write.UD__useWorldConsumableItem(args);

      const receipt = await waitForTransaction(tx);
      if (receipt.status === 'reverted') {
        try {
          await worldContract.simulate.UD__useWorldConsumableItem(args, { account: diagAccount });
        } catch (diagError) {
          return { success: false, error: getContractError(diagError) };
        }
        return { success: false, error: 'Failed to use item.' };
      }
      return { success: receipt.status === 'success' };
    } catch (e) {
      if (isInsufficientFundsError(e)) {
        try {
          await worldContract.simulate.UD__useWorldConsumableItem([
            entity as `0x${string}`,
            entity as `0x${string}`,
            BigInt(tokenId),
          ], { account: diagAccount });
        } catch (diagError) {
          return { success: false, error: getContractError(diagError) };
        }
      }
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  // === Implicit Class System Functions ===

  const chooseRace = async (
    characterEntity: string,
    race: Race,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterEntity, 'chooseRace');
    if (ownershipError) return ownershipError;

    try {
      const tx = await wrappedWorldContract.write.UD__chooseRace([
        characterEntity as `0x${string}`,
        race,
      ]);

      const receipt = await waitForTransaction(tx);
      return resultFromReceipt(receipt, 'Failed to choose race.');
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const choosePowerSource = async (
    characterEntity: string,
    powerSource: PowerSource,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterEntity, 'choosePowerSource');
    if (ownershipError) return ownershipError;

    try {
      const tx = await wrappedWorldContract.write.UD__choosePowerSource([
        characterEntity as `0x${string}`,
        powerSource,
      ]);

      const receipt = await waitForTransaction(tx);
      return resultFromReceipt(receipt, 'Failed to choose power source.');
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const rollBaseStats = async (
    characterEntity: string,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterEntity, 'rollBaseStats');
    if (ownershipError) return ownershipError;

    try {
      const randomString = 'UltimateDominion';
      const userRandomNumber = keccak256(toBytes(randomString));

      const tx = await wrappedWorldContract.write.UD__rollBaseStats([
        userRandomNumber,
        characterEntity as `0x${string}`,
      ]);

      const receipt = await waitForTransaction(tx);
      if (receipt.status !== 'success') {
        return { success: false, error: 'Failed to roll base stats.' };
      }
      const blockNumber = receipt.blockNumber;

      const chainId = await publicClient.getChainId();
      if (chainId !== 31337) {
        const blockToWaitFor = blockNumber + BigInt(2);

        let currentBlockNumber = await publicClient.getBlockNumber();
        while (currentBlockNumber < blockToWaitFor) {
          await new Promise(resolve => setTimeout(resolve, 250));
          currentBlockNumber = await publicClient.getBlockNumber();
        }
      }

      return {
        success: true,
      };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const selectAdvancedClass = async (
    characterEntity: string,
    advancedClass: AdvancedClass,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterEntity, 'selectAdvancedClass');
    if (ownershipError) return ownershipError;

    try {
      const tx = await wrappedWorldContract.write.UD__selectAdvancedClass([
        characterEntity as `0x${string}`,
        advancedClass,
      ]);

      const receipt = await waitForTransaction(tx);
      return resultFromReceipt(receipt, 'Failed to select advanced class.');
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const checkCombatFragmentTriggers = async (
    winners: string[],
    defeated: string[],
    tileX: number,
    tileY: number,
    defeatedAreMobs: boolean,
  ): SystemCallReturn => {
    try {
      const tx = await wrappedWorldContract.write.UD__checkCombatFragmentTriggersForGroup([
        winners as `0x${string}`[],
        defeated as `0x${string}`[],
        tileX,
        tileY,
        defeatedAreMobs,
      ]);

      const receipt = await waitForTransaction(tx);
      return { success: receipt.status === 'success' };
    } catch (e) {
      return { error: getContractError(e), success: false };
    }
  };

  const triggerFragment = async (
    characterId: string,
    fragmentType: number,
    tileX: number,
    tileY: number,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterId, 'triggerFragment');
    if (ownershipError) return ownershipError;

    try {
      const tx = await wrappedWorldContract.write.UD__triggerFragment([
        characterId as `0x${string}`,
        fragmentType,
        tileX,
        tileY,
      ]);

      const receipt = await waitForTransaction(tx);
      return { success: receipt.status === 'success' };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const claimFragment = async (
    characterId: string,
    fragmentType: number,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterId, 'claimFragment');
    if (ownershipError) return ownershipError;

    try {
      const tx = await wrappedWorldContract.write.UD__claimFragment([
        characterId as `0x${string}`,
        fragmentType,
      ]);

      const receipt = await waitForTransaction(tx);
      return { success: receipt.status === 'success' };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const buyGas = async (
    characterId: string,
    goldAmount: bigint,
    minEthOutput: bigint = 1n,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterId, 'buyGas');
    if (ownershipError) return ownershipError;

    try {
      const tx = await wrappedWorldContract.write.UD__buyGas([
        characterId as `0x${string}`,
        goldAmount,
        minEthOutput,
      ]);

      const receipt = await waitForTransaction(tx);
      return { success: receipt.status === 'success' };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  // ==================== Z2 Feature System Calls ====================

  // --- Durability ---
  const repairItem = async (
    characterId: string,
    itemId: bigint,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterId, 'repairItem');
    if (ownershipError) return ownershipError;

    try {
      const tx = await wrappedWorldContract.write.UD__repairItem([
        characterId as `0x${string}`,
        itemId,
      ]);

      const receipt = await waitForTransaction(tx);
      return { success: receipt.status === 'success' };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  // --- Respec ---
  const statRespec = async (
    characterId: string,
    desiredStats: {
      strength: bigint;
      agility: bigint;
      class: number;
      intelligence: bigint;
      maxHp: bigint;
      currentHp: bigint;
      experience: bigint;
      level: bigint;
      powerSource: number;
      race: number;
      startingArmor: number;
      advancedClass: number;
      hasSelectedAdvancedClass: boolean;
    },
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterId, 'statRespec');
    if (ownershipError) return ownershipError;

    try {
      const tx = await wrappedWorldContract.write.UD__statRespec([
        characterId as `0x${string}`,
        desiredStats,
      ]);

      const receipt = await waitForTransaction(tx);
      return { success: receipt.status === 'success' };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const fullRespec = async (
    characterId: string,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterId, 'fullRespec');
    if (ownershipError) return ownershipError;

    try {
      const tx = await wrappedWorldContract.write.UD__fullRespec([
        characterId as `0x${string}`,
      ]);

      const receipt = await waitForTransaction(tx);
      return { success: receipt.status === 'success' };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  // --- NPC Dialogue ---
  const talkToNpc = async (
    characterId: string,
    npcId: string,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterId, 'talkToNpc');
    if (ownershipError) return ownershipError;

    try {
      const tx = await wrappedWorldContract.write.UD__talkToNpc([
        characterId as `0x${string}`,
        npcId as `0x${string}`,
      ]);

      const receipt = await waitForTransaction(tx);
      return { success: receipt.status === 'success' };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  // --- Guild System ---
  const createGuild = async (
    characterId: string,
    name: string,
    tag: string,
    isOpen: boolean,
    description: string,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterId, 'createGuild');
    if (ownershipError) return ownershipError;

    try {
      const tx = await wrappedWorldContract.write.UD__createGuild([
        characterId as `0x${string}`,
        name,
        tag,
        isOpen,
        description,
      ]);

      const receipt = await waitForTransaction(tx);
      return { success: receipt.status === 'success' };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const joinGuild = async (
    characterId: string,
    guildId: bigint,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterId, 'joinGuild');
    if (ownershipError) return ownershipError;

    try {
      const tx = await wrappedWorldContract.write.UD__joinGuild([
        characterId as `0x${string}`,
        guildId,
      ]);

      const receipt = await waitForTransaction(tx);
      return { success: receipt.status === 'success' };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const leaveGuild = async (
    characterId: string,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterId, 'leaveGuild');
    if (ownershipError) return ownershipError;

    try {
      const tx = await wrappedWorldContract.write.UD__leaveGuild([
        characterId as `0x${string}`,
      ]);

      const receipt = await waitForTransaction(tx);
      return { success: receipt.status === 'success' };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const applyToGuild = async (
    characterId: string,
    guildId: bigint,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterId, 'applyToGuild');
    if (ownershipError) return ownershipError;

    try {
      const tx = await wrappedWorldContract.write.UD__applyToGuild([
        characterId as `0x${string}`,
        guildId,
      ]);

      const receipt = await waitForTransaction(tx);
      return { success: receipt.status === 'success' };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const setTaxRate = async (
    characterId: string,
    newRate: bigint,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterId, 'setTaxRate');
    if (ownershipError) return ownershipError;

    try {
      const tx = await wrappedWorldContract.write.UD__setTaxRate([
        characterId as `0x${string}`,
        newRate,
      ]);

      const receipt = await waitForTransaction(tx);
      return { success: receipt.status === 'success' };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const withdrawTreasury = async (
    characterId: string,
    amount: bigint,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterId, 'withdrawTreasury');
    if (ownershipError) return ownershipError;

    try {
      const tx = await wrappedWorldContract.write.UD__withdrawTreasury([
        characterId as `0x${string}`,
        amount,
      ]);

      const receipt = await waitForTransaction(tx);
      return { success: receipt.status === 'success' };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const disbandGuild = async (
    characterId: string,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterId, 'disbandGuild');
    if (ownershipError) return ownershipError;

    try {
      const tx = await wrappedWorldContract.write.UD__disbandGuild([
        characterId as `0x${string}`,
      ]);

      const receipt = await waitForTransaction(tx);
      return { success: receipt.status === 'success' };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  return {
    applyToGuild,
    autoAdventure,
    buy,
    buyGas,
    cancelOrder,
    checkCombatFragmentTriggers,
    chooseRace,
    choosePowerSource,
    claimFragment,
    createEncounter,
    createGuild,
    createOrder,
    disbandGuild,
    endShopEncounter,
    endWorldEncounter,
    endTurn,
    enterGame,
    equipItems,
    fleePvp,
    fullRespec,
    fulfillOrder,
    autoFight,
    joinGuild,
    leaveGuild,
    levelCharacter,
    mintCharacter,
    move,
    removeEntityFromBoard,
    repairItem,
    rest,
    restock,
    rollBaseStats,
    rollStats,
    selectAdvancedClass,
    sell,
    setTaxRate,
    spawn,
    statRespec,
    talkToNpc,
    transitionZone,
    triggerFragment,
    unequipItem,
    updateTokenUri,
    useWorldConsumableItem,
    validateTileMonsters,
    withdrawTreasury,
  };
}
