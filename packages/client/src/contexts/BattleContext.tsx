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
} from '../lib/gameStore';
import { useToast } from '../hooks/useToast';
import { useTransaction } from '../hooks/useTransaction';
import { useTransactionProgress, type TransactionProgress } from '../hooks/useTransactionProgress';
import { useReactiveEntity } from '../hooks/useReactiveEntity';
import {
  BATTLE_OUTCOME_SEEN_KEY,
  CURRENT_BATTLE_OPPONENT_TURN_KEY,
  CURRENT_BATTLE_USER_TURN_KEY,
  STATUS_EFFECT_NAME_MAPPING,
} from '../utils/constants';
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
  opponentPredictedHp: bigint;
  statusEffectActions: StatusAction[];
  userPredictedHp: bigint;
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
  opponentPredictedHp: 0n,
  statusEffectActions: [],
  userPredictedHp: 0n,
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
  const { character } = useCharacter();
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
    // Prefer an active (ongoing) battle; fall back to most recent completed
    const activeBattle = allBattles.filter(b => b.end === BigInt(0)).pop();
    const latestBattle = activeBattle ?? allBattles[allBattles.length - 1];
    if (!latestBattle) return null;

    // If the most recent battle ended but outcome hasn't arrived yet, hide it
    // (the reactive combatOutcomeTable dep will re-trigger when outcome arrives)
    if (latestBattle.end !== BigInt(0)) {
      const combatOutcome = combatOutcomeTable[latestBattle.encounterId];
      if (!combatOutcome) return null;
    }

    const latestBattleOutcomeSeen = localStorage.getItem(
      BATTLE_OUTCOME_SEEN_KEY,
    );

    if (latestBattleOutcomeSeen === latestBattle?.encounterId) return null;

    return latestBattle;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allBattles, combatOutcomeTable, acknowledgeVersion]);

  const lastestBattleOutcome = useMemo(() => {
    const latestCompletedBattle =
      allBattles
        .filter(b => b.end !== BigInt(0))
        .sort((a, b) => Number(b.end - a.end))[0] ?? null;
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

    checkCombatFragmentTriggers(
      winners,
      defeated,
      position.x,
      position.y,
      defeatedAreMobs,
    ).catch(() => {});
  }, [
    lastestBattleOutcome,
    character,
    position,
    allBattles,
    checkCombatFragmentTriggers,
  ]);

  // Derive opponent entity ID for PvP (characters only — monsters use allMonsters)
  const opponentEntityId = useMemo(() => {
    if (!character || !currentBattle) return undefined;
    const participants = [
      ...currentBattle.attackers,
      ...currentBattle.defenders,
    ];
    const isMonsterFight = allMonsters.some(m => participants.includes(m.id));
    if (isMonsterFight) return undefined;
    return participants.find(id => id.toLowerCase() !== character.id.toLowerCase());
  }, [character, currentBattle, allMonsters]);

  // Fully reactive PvP opponent data
  const reactiveOpponent = useReactiveEntity(opponentEntityId);

  const opponent = useMemo(() => {
    if (!character || !currentBattle) return null;
    const participants = [
      ...currentBattle.attackers,
      ...currentBattle.defenders,
    ];
    return allMonsters.find(m => participants.includes(m.id)) ?? reactiveOpponent;
  }, [character, currentBattle, allMonsters, reactiveOpponent]);

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

  const allAttackOutcomes = useMemo(() => {
    return Object.entries(actionOutcomeTable)
      .map(([keyBytes, outcome]) => {
        // keyBytes = 0x + encounterId(64 hex) + currentTurn(64 hex) + attackNumber(64 hex)
        const clean = keyBytes.startsWith('0x') ? keyBytes.slice(2) : keyBytes;
        const encounterId = '0x' + clean.slice(0, 64);
        const currentTurn = BigInt('0x' + (clean.slice(64, 128) || '0'));
        const attackNumber = BigInt('0x' + (clean.slice(128, 192) || '0'));

        const toArray = <T,>(val: unknown, map: (v: unknown) => T): T[] =>
          Array.isArray(val) ? val.map(map) : [map(val)];

        return {
          attackerDamageDelt: toBigInt(outcome.attackerDamageDelt),
          attackerDied: Boolean(outcome.attackerDied),
          attackerId: outcome.attackerId as string,
          attackNumber,
          blockNumber: toBigInt(outcome.blockNumber),
          crit: toArray(outcome.crit, Boolean),
          currentTurn,
          damagePerHit: toArray(outcome.damagePerHit, toBigInt),
          defenderDamageDelt: toBigInt(outcome.defenderDamageDelt),
          defenderDied: Boolean(outcome.defenderDied),
          defenderId: outcome.defenderId as string,
          effectIds: (outcome.effectIds as string[]) ?? [],
          encounterId,
          hit: toArray(outcome.hit, Boolean),
          itemId: outcome.itemId != null ? outcome.itemId.toString() : '0',
          miss: toArray(outcome.miss, Boolean),
          timestamp: toBigInt(outcome.timestamp),
        } as AttackOutcomeType;
      })
      .filter(
        attack =>
          attack.attackerId === character?.id ||
          attack.defenderId === character?.id,
      );
  }, [actionOutcomeTable, character]);

  const currentBattleAttackOutcomes = useMemo(
    () =>
      allAttackOutcomes.filter(
        attack => attack.encounterId === currentBattle?.encounterId,
      ),
    [allAttackOutcomes, currentBattle],
  );

  const opponentPredictedHp = useMemo(() => {
    if (!opponent) return 0n;
    const storeHp = opponent.currentHp ?? 0n;
    let totalDamage = 0n;
    for (const outcome of currentBattleAttackOutcomes) {
      if (outcome.defenderId.toLowerCase() === opponent.id.toLowerCase()) {
        totalDamage += outcome.attackerDamageDelt;
      }
    }
    // Include DoT damage (entityId = victim)
    for (const dot of dotActions) {
      if (dot.entityId.toLowerCase() === opponent.id.toLowerCase()) {
        totalDamage += dot.totalDamage;
      }
    }
    const predicted = opponent.maxHp - totalDamage;
    const clamped = predicted > 0n ? predicted : 0n;
    // Use whichever is lower: prediction or store value
    return clamped < storeHp ? clamped : storeHp;
  }, [currentBattleAttackOutcomes, dotActions, opponent]);

  const userPredictedHp = useMemo(() => {
    if (!character) return 0n;
    const storeHp = character.currentHp ?? 0n;
    let totalDamage = 0n;
    for (const outcome of currentBattleAttackOutcomes) {
      if (outcome.defenderId.toLowerCase() === character.id.toLowerCase()) {
        totalDamage += outcome.attackerDamageDelt;
      }
    }
    // Include DoT damage (entityId = victim)
    for (const dot of dotActions) {
      if (dot.entityId.toLowerCase() === character.id.toLowerCase()) {
        totalDamage += dot.totalDamage;
      }
    }
    const predicted = character.maxHp - totalDamage;
    const clamped = predicted > 0n ? predicted : 0n;
    // Use whichever is lower: prediction or store value
    return clamped < storeHp ? clamped : storeHp;
  }, [currentBattleAttackOutcomes, dotActions, character]);

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
      opponentPredictedHp,
      statusEffectActions,
      userCharacterForBattleRendering,
      userPredictedHp,
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
      opponentPredictedHp,
      statusEffectActions,
      userCharacterForBattleRendering,
      userPredictedHp,
    ],
  );

  return (
    <BattleContext.Provider value={contextValue}>
      {children}
    </BattleContext.Provider>
  );
};

export const useBattle = (): BattleContextType => useContext(BattleContext);
