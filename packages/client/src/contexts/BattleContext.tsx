import { useEntityQuery } from '@latticexyz/react';
import {
  Entity,
  getComponentValue,
  getComponentValueStrict,
  Has,
  HasValue,
  runQuery,
} from '@latticexyz/recs';
import { decodeEntity } from '@latticexyz/store-sync/recs';
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

import { useTransaction } from '../hooks/useTransaction';
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
    components: {
      ActionOutcome,
      CombatEncounter,
      CombatOutcome,
      EncounterEntity,
      StatusEffectValidity,
    },
    delegatorAddress,
    systemCalls: { checkCombatFragmentTriggers, endTurn, fleePvp },
  } = useMUD();
  const { character, refreshCharacter } = useCharacter();
  const { allMonsters, allCharacters, position } = useMap();

  const [attackingItemId, setAttackingItemId] = useState<null | string>(null);
  const [continueToBattleOutcome, setContinueToBattleOutcome] = useState(false);
  const attackOutcomeCountAtAttack = useRef<number | null>(null);

  const attackTx = useTransaction({
    actionName: 'attack',
    maxAttempts: 3,
    backoffMs: 1500,
  });

  const fleeTx = useTransaction({
    actionName: 'flee',
    maxAttempts: 2,
    backoffMs: 1500,
    showSuccessToast: true,
    successMessage: 'Successfully fled the battle.',
  });

  const battleEntities = useEntityQuery([Has(CombatEncounter)]);

  const allBattles = useMemo(
    () =>
      battleEntities
        .map(entity => {
          const encounter = getComponentValueStrict(CombatEncounter, entity);

          return {
            attackers: encounter.attackers as Entity[],
            currentTurn: encounter.currentTurn,
            currentTurnTimer: encounter.currentTurnTimer,
            defenders: encounter.defenders as Entity[],
            encounterId: entity,
            encounterType: encounter.encounterType,
            end: encounter.end,
            maxTurns: encounter.maxTurns,
            start: encounter.start,
          };
        })
        .filter(
          encounter =>
            character &&
            (encounter?.attackers.includes(character.id) ||
              encounter?.defenders.includes(character.id)),
        ),
    [battleEntities, CombatEncounter, character],
  );

  const onContinueToBattleOutcome = useCallback((cont: boolean) => {
    setContinueToBattleOutcome(cont);
  }, []);

  const currentBattle = useMemo(() => {
    const latestBattle = allBattles[allBattles.length - 1];
    if (!latestBattle) return null;

    const latestCompletedBattle = allBattles
      .filter(b => b.end !== BigInt(0))
      .pop();

    if (latestCompletedBattle) {
      const combatOutcome = getComponentValue(
        CombatOutcome,
        latestCompletedBattle.encounterId,
      );
      if (latestBattle.end !== BigInt(0) && !combatOutcome) return null;
    }

    const latestBattleOutcomeSeen = localStorage.getItem(
      BATTLE_OUTCOME_SEEN_KEY,
    );

    if (latestBattleOutcomeSeen === latestBattle?.encounterId) return null;

    return latestBattle;
  }, [allBattles, CombatOutcome]);

  const lastestBattleOutcome = useMemo(() => {
    const latestCompletedBattle = allBattles
      .filter(b => b.end !== BigInt(0))
      .pop();
    if (!latestCompletedBattle) return null;

    const combatOutcome = getComponentValue(
      CombatOutcome,
      latestCompletedBattle.encounterId,
    );
    if (!combatOutcome) return null;

    const winner = combatOutcome.attackersWin
      ? latestCompletedBattle.attackers[0]
      : latestCompletedBattle.defenders[0];
    if (!winner) return null;

    return {
      attackers: latestCompletedBattle.attackers,
      defenders: latestCompletedBattle.defenders,
      encounterId: latestCompletedBattle.encounterId,
      endTime: combatOutcome.endTime,
      expDropped: combatOutcome.expDropped,
      goldDropped: combatOutcome.goldDropped,
      itemsDropped: combatOutcome.itemsDropped.map(i => i.toString()),
      playerFled: combatOutcome.playerFled,
      winner,
    };
  }, [allBattles, CombatOutcome]);

  const lastProcessedEncounterRef = useRef<string | null>(null);

  useEffect(() => {
    if (!lastestBattleOutcome || !character || !position) return;
    if (lastProcessedEncounterRef.current === lastestBattleOutcome.encounterId) return;

    lastProcessedEncounterRef.current = lastestBattleOutcome.encounterId;

    const { attackers, defenders, winner } = lastestBattleOutcome;
    const attackersWon = attackers.includes(winner);
    const winners = attackersWon ? attackers : defenders;
    const defeated = attackersWon ? defenders : attackers;

    if (!winners.includes(character.id)) return;

    const battle = allBattles.find(b => b.encounterId === lastestBattleOutcome.encounterId);
    const defeatedAreMobs = battle?.encounterType === EncounterType.PvE;

    checkCombatFragmentTriggers(
      winners as string[],
      defeated as string[],
      position.x,
      position.y,
      defeatedAreMobs,
    ).catch(() => {});
  }, [lastestBattleOutcome, character, position, allBattles, checkCombatFragmentTriggers]);

  const opponent = useMemo(() => {
    if (!(character && currentBattle)) return null;

    let possibleOpponent: Character | Monster | undefined = allMonsters.find(
      monster =>
        [...currentBattle.attackers, ...currentBattle.defenders].includes(
          monster.id,
        ),
    );

    if (!possibleOpponent) {
      possibleOpponent = allCharacters
        .filter(c => c.id !== character.id)
        .find(char =>
          [...currentBattle.attackers, ...currentBattle.defenders].includes(
            char.id,
          ),
        );
    }

    return possibleOpponent ?? null;
  }, [allCharacters, allMonsters, character, currentBattle]);

  const userCharacterForBattleRendering = useMemo(() => {
    if (!character) return null;

    return allCharacters.find(char => char.id === character.id) ?? null;
  }, [allCharacters, character]);

  const attackOutcomeEntities = useEntityQuery([Has(ActionOutcome)]);

  const allAttackOutcomes = useMemo(
    () =>
      attackOutcomeEntities
        .map(entity => {
          const _attackOutcome = getComponentValueStrict(ActionOutcome, entity);

          const { encounterId, currentTurn, attackNumber } = decodeEntity(
            {
              encounterId: 'bytes32',
              currentTurn: 'uint256',
              attackNumber: 'uint256',
            },
            entity,
          );

          return {
            attackerDamageDelt: _attackOutcome.attackerDamageDelt,
            attackerDied: _attackOutcome.attackerDied,
            attackerId: _attackOutcome.attackerId,
            attackNumber: attackNumber,
            blockNumber: _attackOutcome.blockNumber,
            crit: _attackOutcome.crit,
            currentTurn: currentTurn,
            damagePerHit: _attackOutcome.damagePerHit,
            defenderDamageDelt: _attackOutcome.defenderDamageDelt,
            defenderDied: _attackOutcome.defenderDied,
            defenderId: _attackOutcome.defenderId,
            effectIds: _attackOutcome.effectIds,
            encounterId: encounterId,
            hit: _attackOutcome.hit,
            itemId: _attackOutcome.itemId.toString(),
            miss: _attackOutcome.miss,
            timestamp: _attackOutcome.timestamp,
          } as AttackOutcomeType;
        })
        .filter(
          attack =>
            attack.attackerId === character?.id ||
            attack.defenderId === character?.id,
        ),
    [attackOutcomeEntities, ActionOutcome, character],
  );

  const currentBattleAttackOutcomes = useMemo(
    () =>
      allAttackOutcomes.filter(
        attack => attack.encounterId === currentBattle?.encounterId,
      ),
    [allAttackOutcomes, currentBattle],
  );

  const statusEffectActions: StatusAction[] = useMemo(() => {
    if (!currentBattle || !StatusEffectValidity) return [];

    const encounterEntities = Array.from(
      runQuery([
        Has(EncounterEntity),
        HasValue(EncounterEntity, { encounterId: currentBattle?.encounterId }),
      ]),
    );

    return encounterEntities
      .map(entity => {
        const encounter = getComponentValueStrict(EncounterEntity, entity);

        const { appliedStatusEffects } = encounter;
        const statusEffects = appliedStatusEffects.map(
          decodeAppliedStatusEffectId,
        );

        const _statusEffectActions = statusEffects.map(effect => {
          const paddedEffectId = effect.effectId.padEnd(66, '0') as Entity;
          const validity = getComponentValue(
            StatusEffectValidity,
            paddedEffectId,
          );
          if (!validity) return null;

          const isActive =
            BigInt(currentBattle.currentTurn) <=
            effect.turnApplied + validity.validTurns;

          const name = STATUS_EFFECT_NAME_MAPPING[paddedEffectId] ?? 'unknown';

          return {
            active: isActive,
            effectId: paddedEffectId,
            name,
            turnStart: effect.turnApplied.toString(),
            validTurns: validity.validTurns.toString(),
            victimId: entity,
          };
        });

        return _statusEffectActions;
      })
      .flat()
      .filter((action): action is StatusAction => action !== null);
  }, [currentBattle, EncounterEntity, StatusEffectValidity]);

  const onAttack = useCallback(
    async (itemId: string) => {
      if (!delegatorAddress || !character || !currentBattle || !opponent) return;

      setAttackingItemId(itemId);
      attackOutcomeCountAtAttack.current = currentBattleAttackOutcomes.length;

      const result = await attackTx.execute(() =>
        endTurn(
          currentBattle.encounterId,
          character.id,
          opponent.id,
          itemId,
        ),
      );

      if (result) {
        localStorage.removeItem(CURRENT_BATTLE_OPPONENT_TURN_KEY);
        localStorage.removeItem(CURRENT_BATTLE_USER_TURN_KEY);
        refreshCharacter();
        // Don't clear attackingItemId — effect below clears when outcome arrives
      } else {
        // TX failed, clear immediately
        setAttackingItemId(null);
        attackOutcomeCountAtAttack.current = null;
      }
    },
    [
      attackTx,
      character,
      currentBattle,
      currentBattleAttackOutcomes.length,
      delegatorAddress,
      endTurn,
      opponent,
      refreshCharacter,
    ],
  );

  // Clear attack loading state when new outcome data arrives from RECS sync
  useEffect(() => {
    if (
      attackOutcomeCountAtAttack.current !== null &&
      currentBattleAttackOutcomes.length > attackOutcomeCountAtAttack.current
    ) {
      setAttackingItemId(null);
      attackOutcomeCountAtAttack.current = null;
    }
  }, [currentBattleAttackOutcomes.length]);

  // Safety timeout — clear attack loading if outcome never arrives (10s)
  useEffect(() => {
    if (attackingItemId === null) return;
    const timeout = setTimeout(() => {
      setAttackingItemId(null);
      attackOutcomeCountAtAttack.current = null;
    }, 10000);
    return () => clearTimeout(timeout);
  }, [attackingItemId]);

  const onFleePvp = useCallback(async () => {
    if (!character || !delegatorAddress || !currentBattle) return;
    if (currentBattle.encounterType !== EncounterType.PvP) return;

    await fleeTx.execute(() => fleePvp(character.id));
  }, [
    character,
    currentBattle,
    delegatorAddress,
    fleePvp,
    fleeTx,
  ]);

  const contextValue = useMemo(
    () => ({
      attackOutcomes: currentBattleAttackOutcomes,
      attackingItemId,
      attackStatusMessage: attackTx.statusMessage || 'Attacking...',
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
      currentBattleAttackOutcomes,
      attackingItemId,
      attackTx.statusMessage,
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
