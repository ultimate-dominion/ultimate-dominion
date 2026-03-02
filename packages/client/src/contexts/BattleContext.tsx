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
  getTableEntries,
  getTableValue,
  toBigInt,
  toNumber,
  useGameTable,
} from '../lib/gameStore';
import { useToast } from '../hooks/useToast';
import { useTransaction } from '../hooks/useTransaction';
import { useTransactionProgress, type TransactionProgress } from '../hooks/useTransactionProgress';
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
  isFleeing: boolean;
  lastestBattleOutcome: CombatOutcomeType | null;
  onAttack: (itemId: string) => void;
  onContinueToBattleOutcome: (cont: boolean) => void;
  onFleePvp: () => void;
  opponent: Character | Monster | null;
  statusEffectActions: StatusAction[];
  userCharacterForBattleRendering: Character | null;
};

const BattleContext = createContext<BattleContextType>({
  attackOutcomes: [],
  attackingItemId: null,
  attackProgress: { phase: 'idle', percent: 0, transitionMs: 0 },
  attackStatusMessage: '',
  continueToBattleOutcome: false,
  currentBattle: null,
  isFleeing: false,
  lastestBattleOutcome: null,
  onAttack: () => {},
  onContinueToBattleOutcome: () => {},
  onFleePvp: () => {},
  opponent: null,
  statusEffectActions: [],
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
  const { allMonsters, allCharacters, position } = useMap();

  const { renderError } = useToast();
  const {
    progress: attackProgress,
    start: startAttackProgress,
    complete: completeAttackProgress,
    fail: failAttackProgress,
  } = useTransactionProgress();
  const [attackingItemId, setAttackingItemId] = useState<null | string>(null);
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
      );
  }, [combatEncounterTable, character]);

  const onContinueToBattleOutcome = useCallback((cont: boolean) => {
    setContinueToBattleOutcome(cont);
    if (!cont) setAcknowledgeVersion(v => v + 1);
  }, []);

  const currentBattle = useMemo(() => {
    const latestBattle = allBattles[allBattles.length - 1];
    if (!latestBattle) return null;

    const latestCompletedBattle =
      allBattles
        .filter(b => b.end !== BigInt(0))
        .sort((a, b) => Number(b.end - a.end))[0] ?? null;

    if (latestCompletedBattle) {
      const combatOutcome = combatOutcomeTable[latestCompletedBattle.encounterId];
      if (latestBattle.end !== BigInt(0) && !combatOutcome) return null;
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

  const opponent = useMemo(() => {
    if (!(character && currentBattle)) return null;

    const participants = [
      ...currentBattle.attackers,
      ...currentBattle.defenders,
    ];

    let possibleOpponent: Character | Monster | undefined = allMonsters.find(
      monster => participants.includes(monster.id),
    );

    if (!possibleOpponent) {
      possibleOpponent = allCharacters
        .filter(c => c.id !== character.id)
        .find(char => participants.includes(char.id));
    }

    return possibleOpponent ?? null;
  }, [allCharacters, allMonsters, character, currentBattle]);

  const userCharacterForBattleRendering = useMemo(() => {
    if (!character) return null;
    return allCharacters.find(char => char.id === character.id) ?? null;
  }, [allCharacters, character]);

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

        return {
          attackerDamageDelt: toBigInt(outcome.attackerDamageDelt),
          attackerDied: Boolean(outcome.attackerDied),
          attackerId: outcome.attackerId as string,
          attackNumber,
          blockNumber: toBigInt(outcome.blockNumber),
          crit: Boolean(outcome.crit),
          currentTurn,
          damagePerHit: toBigInt(outcome.damagePerHit),
          defenderDamageDelt: toBigInt(outcome.defenderDamageDelt),
          defenderDied: Boolean(outcome.defenderDied),
          defenderId: outcome.defenderId as string,
          effectIds: (outcome.effectIds as string[]) ?? [],
          encounterId,
          hit: Boolean(outcome.hit),
          itemId: outcome.itemId != null ? outcome.itemId.toString() : '0',
          miss: Boolean(outcome.miss),
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

  const statusEffectActions: StatusAction[] = useMemo(() => {
    if (!currentBattle) return [];

    const encounterEntityTable = getTableEntries('EncounterEntity');

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
  }, [currentBattle, combatEncounterTable]); // combatEncounterTable triggers re-derive when store updates

  const onAttack = useCallback(
    async (itemId: string) => {
      if (!delegatorAddress || !character || !currentBattle || !opponent)
        return;
      if (attackingItemId !== null) return; // prevent double-submit

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
        setAttackingItemId(null);
        attackOutcomeCountAtAttack.current = null;
      }
    },
    [
      attackingItemId,
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
      setAttackingItemId(null);
      attackOutcomeCountAtAttack.current = null;
    }
  }, [completeAttackProgress, currentBattleAttackOutcomes.length]);

  // Safety timeout — clear attack loading if outcome never arrives (10s)
  useEffect(() => {
    if (attackingItemId === null) return;
    const timeout = setTimeout(() => {
      failAttackProgress();
      setAttackingItemId(null);
      attackOutcomeCountAtAttack.current = null;
    }, 10000);
    return () => clearTimeout(timeout);
  }, [attackingItemId, failAttackProgress]);

  const onFleePvp = useCallback(async () => {
    if (!character || !delegatorAddress || !currentBattle) return;
    if (currentBattle.encounterType !== EncounterType.PvP) return;

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
      isFleeing: fleeTx.isLoading,
      lastestBattleOutcome,
      onAttack,
      onContinueToBattleOutcome,
      onFleePvp,
      opponent,
      statusEffectActions,
      userCharacterForBattleRendering,
    }),
    [
      attackProgress,
      currentBattleAttackOutcomes,
      attackingItemId,
      continueToBattleOutcome,
      currentBattle,
      fleeTx.isLoading,
      lastestBattleOutcome,
      onAttack,
      onContinueToBattleOutcome,
      onFleePvp,
      opponent,
      statusEffectActions,
      userCharacterForBattleRendering,
    ],
  );

  return (
    <BattleContext.Provider value={contextValue}>
      {children}
    </BattleContext.Provider>
  );
};

export const useBattle = (): BattleContextType => useContext(BattleContext);
