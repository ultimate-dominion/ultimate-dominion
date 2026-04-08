import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  getTableValue,
  toBigInt,
  toNumber,
  useGameTable,
  useGameValue,
} from '../lib/gameStore';
import { useToast } from '../hooks/useToast';
import { useTransaction } from '../hooks/useTransaction';
import { useTransactionProgress, type TransactionProgress } from '../hooks/useTransactionProgress';
import { useReactiveEntity } from '../hooks/useReactiveEntity';
import {
  BATTLE_OUTCOME_SEEN_KEY,
  CURRENT_BATTLE_OPPONENT_TURN_KEY,
  CURRENT_BATTLE_USER_TURN_KEY,
  SLOT_ORDER_KEY_PREFIX,
  STATUS_EFFECT_NAME_MAPPING,
} from '../utils/constants';
import { getFirstSlotItem } from '../hooks/useSlotOrder';
import { decodeAppliedStatusEffectId } from '../utils/helpers';
import {
  type AttackOutcomeType,
  type Character,
  type CombatDetails,
  type CombatOutcomeType,
  type DotAction,
  EncounterType,
  type Monster,
  type StatusAction,
} from '../utils/types';

import { useCharacter } from './CharacterContext';
import { useMap } from './MapContext';
import { useMUD } from './MUDContext';
import { resolveCurrentBattle } from './resolveCurrentBattle';

type BattleContextType = {
  attackOutcomes: AttackOutcomeType[];
  attackingItemId: null | string;
  attackProgress: TransactionProgress;
  attackStatusMessage: string;
  continueToBattleOutcome: boolean;
  currentBattle: CombatDetails | null;
  dotActions: DotAction[];
  isFleeing: boolean;
  lastestBattleOutcome: CombatOutcomeType | null;
  onAttack: (itemId: string) => void;
  onContinueToBattleOutcome: (cont: boolean) => void;
  onFleePvp: () => void;
  opponent: Character | Monster | null;
  opponentHp: bigint;
  statusEffectActions: StatusAction[];
  userHp: bigint;
  userCharacterForBattleRendering: Character | null;
};

const BattleContext = createContext<BattleContextType>({
  attackOutcomes: [],
  attackingItemId: null,
  attackProgress: { phase: 'idle', percent: 0, transitionMs: 0 },
  attackStatusMessage: '',
  continueToBattleOutcome: false,
  currentBattle: null,
  dotActions: [],
  isFleeing: false,
  lastestBattleOutcome: null,
  onAttack: () => {},
  onContinueToBattleOutcome: () => {},
  onFleePvp: () => {},
  opponent: null,
  opponentHp: 0n,
  statusEffectActions: [],
  userHp: 0n,
  userCharacterForBattleRendering: null,
});

export type BattleProviderProps = {
  children: ReactNode;
};

export const BattleProvider = ({
  children,
}: BattleProviderProps): JSX.Element => {
  const {
    authMethod,
    delegatorAddress,
    systemCalls: { checkCombatFragmentTriggers, endTurn, fleePvp },
  } = useMUD();
  const { character, equippedSpells, equippedWeapons } = useCharacter();
  const { allMonsters, position } = useMap();

  const { renderError } = useToast();
  const {
    progress: attackProgress,
    start: startAttackProgress,
    complete: completeAttackProgress,
    fail: failAttackProgress,
  } = useTransactionProgress();
  const [attackingItemId, setAttackingItemId] = useState<null | string>(null);
  const attackInFlightRef = useRef(false); // synchronous guard — immune to React batching
  const [continueToBattleOutcome, setContinueToBattleOutcome] = useState(false);
  const [acknowledgeVersion, setAcknowledgeVersion] = useState(0);
  const attackOutcomeCountAtAttack = useRef<number | null>(null);

  const fleeTx = useTransaction({
    actionName: 'flee',
    maxAttempts: 2,
    backoffMs: 1500,
    showSuccessToast: true,
    successMessage: 'Successfully fled the battle.',
  });

  // Reactive: re-renders when any CombatEncounter row changes
  const combatEncounterTable = useGameTable('CombatEncounter');
  // Reactive: re-renders when any CombatOutcome row changes
  // (fixes race condition where CombatOutcome arrives after CombatEncounter)
  const combatOutcomeTable = useGameTable('CombatOutcome');
  const liveEncounterEntity = useGameValue('EncounterEntity', character?.id);

  const allBattles = useMemo(() => {
    return Object.entries(combatEncounterTable)
      .map(([keyBytes, encounter]) => ({
        attackers: (encounter.attackers as string[]) ?? [],
        currentTurn: toBigInt(encounter.currentTurn),
        currentTurnTimer: toBigInt(encounter.currentTurnTimer),
        defenders: (encounter.defenders as string[]) ?? [],
        encounterId: keyBytes,
        encounterType: toNumber(encounter.encounterType),
        end: toBigInt(encounter.end),
        maxTurns: toBigInt(encounter.maxTurns),
        start: toBigInt(encounter.start),
      }))
      .filter(
        encounter =>
          character &&
          (encounter.attackers.includes(character.id) ||
            encounter.defenders.includes(character.id)),
      )
      .sort((a, b) => Number(a.start - b.start));
  }, [combatEncounterTable, character]);

  const onContinueToBattleOutcome = useCallback((cont: boolean) => {
    setContinueToBattleOutcome(cont);
    if (!cont) setAcknowledgeVersion(v => v + 1);
  }, []);

  const currentBattle = useMemo(() => {
    const lastSeenEncounterId = localStorage.getItem(BATTLE_OUTCOME_SEEN_KEY);
    return resolveCurrentBattle(
      allBattles,
      combatOutcomeTable,
      lastSeenEncounterId,
      (liveEncounterEntity?.encounterId as string | undefined) ?? null,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allBattles, combatOutcomeTable, acknowledgeVersion, liveEncounterEntity?.encounterId]);

  // Ghost encounter safety: if an "active" battle (end=0) started more than
  // 2 minutes ago, it's stale cache data from a previous session — auto-dismiss.
  // No real PvE encounter lasts 2+ minutes without the opponent resolving.
  useEffect(() => {
    if (!currentBattle || currentBattle.end !== BigInt(0)) return;
    const ageSeconds = Math.floor(Date.now() / 1000) - Number(currentBattle.start);
    if (ageSeconds < 120) return; // legit recent battle, don't touch
    console.warn('[battle] Ghost encounter detected (age:', ageSeconds, 's) — auto-dismissing', currentBattle.encounterId);
    localStorage.setItem(BATTLE_OUTCOME_SEEN_KEY, currentBattle.encounterId);
    setAcknowledgeVersion(v => v + 1);
  }, [currentBattle?.encounterId]); // eslint-disable-line react-hooks/exhaustive-deps

  const lastestBattleOutcome = useMemo(() => {
    // Include battles where CombatOutcome exists even if end hasn't synced yet
    // (splice event delay). This ensures battleOver=true as soon as outcome arrives.
    const latestCompletedBattle =
      allBattles
        .filter(b => b.end !== BigInt(0) || !!combatOutcomeTable[b.encounterId])
        .sort((a, b) => {
          const aTime = a.end !== BigInt(0) ? a.end : a.start;
          const bTime = b.end !== BigInt(0) ? b.end : b.start;
          return Number(bTime - aTime);
        })[0] ?? null;
    if (!latestCompletedBattle) return null;

    const combatOutcome = combatOutcomeTable[latestCompletedBattle.encounterId];
    if (!combatOutcome) return null;

    const attackersWin = Boolean(combatOutcome.attackersWin);
    const winner = attackersWin
      ? latestCompletedBattle.attackers[0]
      : latestCompletedBattle.defenders[0];
    if (!winner) return null;

    return {
      attackers: latestCompletedBattle.attackers,
      defenders: latestCompletedBattle.defenders,
      encounterId: latestCompletedBattle.encounterId,
      endTime: toBigInt(combatOutcome.endTime),
      expDropped: toBigInt(combatOutcome.expDropped),
      goldDropped: toBigInt(combatOutcome.goldDropped),
      itemsDropped: ((combatOutcome.itemsDropped as unknown[]) ?? []).map(i =>
        i!.toString(),
      ),
      playerFled: Boolean(combatOutcome.playerFled),
      winner,
    } as CombatOutcomeType;
  }, [allBattles, combatOutcomeTable]);

  const lastProcessedEncounterRef = useRef<string | null>(null);

  useEffect(() => {
    if (!lastestBattleOutcome || !character || !position) return;
    if (
      lastProcessedEncounterRef.current === lastestBattleOutcome.encounterId
    )
      return;

    lastProcessedEncounterRef.current = lastestBattleOutcome.encounterId;

    const { attackers, defenders, winner } = lastestBattleOutcome;
    const attackersWon = attackers.includes(winner);
    const winners = attackersWon ? attackers : defenders;
    const defeated = attackersWon ? defenders : attackers;

    if (!winners.includes(character.id)) return;

    const battle = allBattles.find(
      b => b.encounterId === lastestBattleOutcome.encounterId,
    );
    const defeatedAreMobs = battle?.encounterType === EncounterType.PvE;

    // Delay fragment check so viem's nonce cache refreshes after the
    // endTurn TX that resolved combat — avoids "nonce too low" errors.
    setTimeout(() => {
      checkCombatFragmentTriggers(
        winners,
        defeated,
        position.x,
        position.y,
        defeatedAreMobs,
      ).catch(() => {});
    }, 1500);
  }, [
    lastestBattleOutcome,
    character,
    position,
    allBattles,
    checkCombatFragmentTriggers,
  ]);

  // Derive the opponent entity ID from battle participants.
  // For PvP this feeds useReactiveEntity; for PvE it feeds the Stats subscription.
  const battleOpponentId = useMemo(() => {
    if (!character || !currentBattle) return undefined;
    const participants = [
      ...currentBattle.attackers,
      ...currentBattle.defenders,
    ];
    return participants.find(id => id.toLowerCase() !== character.id.toLowerCase());
  }, [character, currentBattle]);

  // PvP-only: full reactive Character data (needs Characters table, so monsters return null)
  const reactiveOpponent = useReactiveEntity(battleOpponentId);

  // Reactive Stats subscription — works for both monsters and characters.
  // Keeps delivering currentHp updates even after the mob despawns from allMonsters.
  const reactiveOpponentStats = useGameValue('Stats', battleOpponentId);

  const liveOpponent = useMemo(() => {
    if (!character || !currentBattle) return null;
    const participants = [
      ...currentBattle.attackers,
      ...currentBattle.defenders,
    ];
    return allMonsters.find(m => participants.includes(m.id)) ?? reactiveOpponent;
  }, [character, currentBattle, allMonsters, reactiveOpponent]);

  // Cache the opponent so it survives monster despawn after the killing blow.
  // Without this, opponent goes null when the dead mob is pruned from allMonsters,
  // which tears down the battle UI before the player can see the final moves.
  const cachedOpponentRef = useRef<typeof liveOpponent>(null);
  if (liveOpponent) {
    cachedOpponentRef.current = liveOpponent;
  }
  // Clear the cache when the battle is dismissed
  useEffect(() => {
    if (!currentBattle) {
      cachedOpponentRef.current = null;
    }
  }, [currentBattle]);

  // Use live opponent when available; fall back to cached opponent with reactive HP
  const opponent = useMemo(() => {
    if (liveOpponent) return liveOpponent;
    const cached = cachedOpponentRef.current;
    if (!cached) return null;
    // Overlay reactive HP from the store onto the cached opponent
    if (reactiveOpponentStats) {
      const hp = toBigInt(reactiveOpponentStats.currentHp);
      if (hp !== cached.currentHp) {
        return { ...cached, currentHp: hp };
      }
    }
    return cached;
  }, [liveOpponent, reactiveOpponentStats]);

  // Fully reactive user character for battle rendering
  const userCharacterForBattleRendering = useReactiveEntity(character?.id);

  // Reactive: re-renders when any DamageOverTimeApplied row changes
  const dotTable = useGameTable('DamageOverTimeApplied');

  const dotActions: DotAction[] = useMemo(() => {
    if (!currentBattle) return [];

    return Object.entries(dotTable)
      .map(([keyBytes, row]) => {
        // keyBytes = 0x + encounterId(64 hex) + turnNumber(64 hex)
        const clean = keyBytes.startsWith('0x') ? keyBytes.slice(2) : keyBytes;
        const encounterId = '0x' + clean.slice(0, 64);
        const turnNumber = BigInt('0x' + (clean.slice(64, 128) || '0'));

        const individualDamages = Array.isArray(row.individualDamages)
          ? (row.individualDamages as unknown[]).map(v => toBigInt(v))
          : [];

        return {
          encounterId,
          entityId: row.entityId as string,
          individualDamages,
          totalDamage: toBigInt(row.totalDamage),
          turnNumber,
        } as DotAction;
      })
      .filter(
        dot =>
          dot.encounterId.toLowerCase() ===
          currentBattle.encounterId.toLowerCase(),
      );
  }, [currentBattle, dotTable]);

  // Reactive: re-renders when any ActionOutcome row changes
  const actionOutcomeTable = useGameTable('ActionOutcome');

  // Reactive: re-renders when any CombatFlags row changes
  const combatFlagsTable = useGameTable('CombatFlags');

  const allAttackOutcomes = useMemo(() => {
    return Object.entries(actionOutcomeTable)
      .map(([keyBytes, outcome]) => {
        // keyBytes = 0x + encounterId(64 hex) + currentTurn(64 hex) + attackNumber(64 hex)
        const clean = keyBytes.startsWith('0x') ? keyBytes.slice(2) : keyBytes;
        const encounterId = '0x' + clean.slice(0, 64);
        const currentTurn = BigInt('0x' + (clean.slice(64, 128) || '0'));
        const attackNumber = BigInt('0x' + (clean.slice(128, 192) || '0'));

        // Look up matching CombatFlags row (same composite key)
        const flagsRow = combatFlagsTable[keyBytes];

        const toArray = <T,>(val: unknown, map: (v: unknown) => T): T[] =>
          Array.isArray(val) ? val.map(map) : [map(val)];

        return {
          attackerDamageDelt: toBigInt(outcome.attackerDamageDelt),
          attackerDied: Boolean(outcome.attackerDied),
          attackerId: outcome.attackerId as string,
          attackNumber,
          blocked: Boolean(flagsRow?.blocked),
          blockNumber: toBigInt(outcome.blockNumber),
          crit: toArray(outcome.crit, Boolean),
          currentTurn,
          damagePerHit: toArray(outcome.damagePerHit, toBigInt),
          defenderDamageDelt: toBigInt(outcome.defenderDamageDelt),
          defenderDied: Boolean(outcome.defenderDied),
          defenderId: outcome.defenderId as string,
          doubleStrike: Boolean(flagsRow?.doubleStrike),
          effectIds: (outcome.effectIds as string[]) ?? [],
          encounterId,
          hit: toArray(outcome.hit, Boolean),
          itemId: outcome.itemId != null ? outcome.itemId.toString() : '0',
          miss: toArray(outcome.miss, Boolean),
          spellDodged: Boolean(flagsRow?.spellDodged),
          timestamp: toBigInt(outcome.timestamp),
        } as AttackOutcomeType;
      })
      .filter(
        attack =>
          attack.attackerId === character?.id ||
          attack.defenderId === character?.id,
      );
  }, [actionOutcomeTable, combatFlagsTable, character]);

  const currentBattleAttackOutcomes = useMemo(
    () =>
      allAttackOutcomes.filter(
        attack => attack.encounterId === currentBattle?.encounterId,
      ),
    [allAttackOutcomes, currentBattle],
  );

  // HP is now decoded synchronously from splice events — no optimistic
  // derivation needed. Simple passthrough from the store.
  const opponentHp = useMemo(() => {
    return opponent?.currentHp ?? 0n;
  }, [opponent]);

  const userHp = useMemo(() => {
    return userCharacterForBattleRendering?.currentHp ?? 0n;
  }, [userCharacterForBattleRendering]);

  // Reactive: re-renders when any EncounterEntity row changes (status effects applied)
  const encounterEntityTable = useGameTable('EncounterEntity');

  const statusEffectActions: StatusAction[] = useMemo(() => {
    if (!currentBattle) return [];

    const matchingEntries = Object.entries(encounterEntityTable).filter(
      ([, row]) => {
        const rowEncounterId = row.encounterId as string | undefined;
        if (!rowEncounterId) return false;
        // Compare normalised lowercase hex strings
        return (
          rowEncounterId.toLowerCase() ===
          currentBattle.encounterId.toLowerCase()
        );
      },
    );

    return matchingEntries
      .flatMap(([entityKeyBytes, encounter]) => {
        const appliedStatusEffects =
          (encounter.appliedStatusEffects as string[]) ?? [];
        const statusEffects = appliedStatusEffects.map(
          decodeAppliedStatusEffectId,
        );

        return statusEffects.map(effect => {
          const paddedEffectId = effect.effectId.padEnd(66, '0');
          const validity = getTableValue('StatusEffectValidity', paddedEffectId);
          if (!validity) return null;

          const isActive =
            toBigInt(currentBattle.currentTurn) <=
            effect.turnApplied + toBigInt(validity.validTurns);

          const name = STATUS_EFFECT_NAME_MAPPING[paddedEffectId] ?? 'unknown';

          return {
            active: isActive,
            effectId: paddedEffectId,
            name,
            turnStart: effect.turnApplied.toString(),
            validTurns: toBigInt(validity.validTurns).toString(),
            victimId: entityKeyBytes,
          } as StatusAction;
        });
      })
      .filter((action): action is StatusAction => action !== null);
  }, [currentBattle, encounterEntityTable, combatEncounterTable]);

  const onAttack = useCallback(
    async (itemId: string) => {
      if (!delegatorAddress || !character || !currentBattle || !opponent)
        return;
      if (currentBattle.end !== BigInt(0)) return; // encounter already ended
      if (attackInFlightRef.current) return; // synchronous double-submit guard

      attackInFlightRef.current = true;
      setAttackingItemId(itemId);
      attackOutcomeCountAtAttack.current = currentBattleAttackOutcomes.length;
      startAttackProgress(authMethod === 'embedded' ? 6000 : 500);

      const result = await endTurn(
        currentBattle.encounterId,
        character.id,
        opponent.id,
        itemId,
      );

      if (result.success) {
        localStorage.removeItem(CURRENT_BATTLE_OPPONENT_TURN_KEY);
        localStorage.removeItem(CURRENT_BATTLE_USER_TURN_KEY);
        // Don't clear attackingItemId — effect below clears when outcome arrives
      } else {
        renderError(result.error || 'Attack failed');
        failAttackProgress();
        attackInFlightRef.current = false;
        setAttackingItemId(null);
        attackOutcomeCountAtAttack.current = null;
      }
    },
    [
      authMethod,
      character,
      currentBattle,
      currentBattleAttackOutcomes.length,
      delegatorAddress,
      endTurn,
      failAttackProgress,
      opponent,
      renderError,
      startAttackProgress,
    ],
  );

  // Clear attack loading state when new outcome data arrives from store sync
  useEffect(() => {
    if (
      attackOutcomeCountAtAttack.current !== null &&
      currentBattleAttackOutcomes.length > attackOutcomeCountAtAttack.current
    ) {
      completeAttackProgress();
      attackInFlightRef.current = false;
      setAttackingItemId(null);
      attackOutcomeCountAtAttack.current = null;
    }
  }, [completeAttackProgress, currentBattleAttackOutcomes.length]);

  // Safety timeout — clear attack loading if outcome never arrives (10s)
  useEffect(() => {
    if (attackingItemId === null) return;
    const timeout = setTimeout(() => {
      failAttackProgress();
      attackInFlightRef.current = false;
      setAttackingItemId(null);
      attackOutcomeCountAtAttack.current = null;
    }, 10000);
    return () => clearTimeout(timeout);
  }, [attackingItemId, failAttackProgress]);

  // Auto adventure auto-attack: when auto adventure is on and there's an active
  // battle, auto-submit endTurn with the first equipped weapon/spell.
  // Re-fires each time attackingItemId clears (previous attack resolved).
  useEffect(() => {
    if (localStorage.getItem('ud_auto_adventure') !== 'true') return;
    if (!currentBattle || currentBattle.end !== BigInt(0)) return;
    if (attackingItemId !== null) return; // attack in flight
    if (!opponent || !character || !delegatorAddress) return;

    const allAttackItems = [...equippedWeapons, ...equippedSpells];
    const firstWeapon = character
      ? getFirstSlotItem(`${SLOT_ORDER_KEY_PREFIX}${character.id}`, allAttackItems)
      : allAttackItems[0];
    if (!firstWeapon) return;

    // Small delay so React state settles after previous attack resolves
    const timer = setTimeout(() => {
      onAttack(firstWeapon.tokenId);
    }, 300);
    return () => clearTimeout(timer);
  }, [
    attackingItemId,
    character,
    currentBattle,
    delegatorAddress,
    equippedSpells,
    equippedWeapons,
    onAttack,
    opponent,
  ]);

  const onFleePvp = useCallback(async () => {
    if (!character || !delegatorAddress || !currentBattle) return;

    await fleeTx.execute(() => fleePvp(character.id));
  }, [character, currentBattle, delegatorAddress, fleePvp, fleeTx]);

  const contextValue = useMemo(
    () => ({
      attackOutcomes: currentBattleAttackOutcomes,
      attackingItemId,
      attackProgress,
      attackStatusMessage: attackingItemId ? 'Attacking...' : '',
      continueToBattleOutcome,
      currentBattle,
      dotActions,
      isFleeing: fleeTx.isLoading,
      lastestBattleOutcome,
      onAttack,
      onContinueToBattleOutcome,
      onFleePvp,
      opponent,
      opponentHp,
      statusEffectActions,
      userCharacterForBattleRendering,
      userHp,
    }),
    [
      attackProgress,
      currentBattleAttackOutcomes,
      attackingItemId,
      continueToBattleOutcome,
      currentBattle,
      dotActions,
      fleeTx.isLoading,
      lastestBattleOutcome,
      onAttack,
      onContinueToBattleOutcome,
      onFleePvp,
      opponent,
      opponentHp,
      statusEffectActions,
      userCharacterForBattleRendering,
      userHp,
    ],
  );

  return (
    <BattleContext.Provider value={contextValue}>
      {children}
    </BattleContext.Provider>
  );
};

export const useBattle = (): BattleContextType => useContext(BattleContext);
