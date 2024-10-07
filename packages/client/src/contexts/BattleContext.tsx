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
  useMemo,
  useState,
} from 'react';
import { hexToBigInt, sliceHex } from 'viem';

import { useToast } from '../hooks/useToast';
import {
  BATTLE_OUTCOME_SEEN_KEY,
  CURRENT_BATTLE_OPPONENT_TURN_KEY,
  CURRENT_BATTLE_USER_TURN_KEY,
} from '../utils/constants';
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

const decodeAppliedStatusEffectId = (encodedId: string) => {
  const effectId = sliceHex(encodedId as `0x${string}`, 0, 8);
  const timestampHex = sliceHex(encodedId as `0x${string}`, 8, 16);
  const turnAppliedHex = sliceHex(encodedId as `0x${string}`, 24, 32);

  const timestamp = hexToBigInt(timestampHex);
  const turnApplied = hexToBigInt(turnAppliedHex);

  return {
    effectId,
    timestamp,
    turnApplied,
  };
};

const STATUS_EFFECT_NAME_MAPPING: { [key: string]: string } = {
  '0xd2812fe9b0b2cad2000000000000000000000000000000000000000000000000': 'blind',
  '0x78ded5c390ab6de3000000000000000000000000000000000000000000000000':
    'poison',
  '0x54a7e38986f19669000000000000000000000000000000000000000000000000':
    'stupify',
  '0x98562f2b32aeb98f000000000000000000000000000000000000000000000000':
    'weaken',
};

type BattleContextType = {
  attackOutcomes: AttackOutcomeType[];
  attackingItemId: null | string;
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
  const { renderError, renderSuccess } = useToast();
  const {
    components: {
      ActionOutcome,
      CombatEncounter,
      CombatOutcome,
      EncounterEntity,
      StatusEffectValidity,
    },
    delegatorAddress,
    systemCalls: { endTurn, fleePvp },
  } = useMUD();
  const { character, refreshCharacter } = useCharacter();
  const { allMonsters, allCharacters } = useMap();

  const [attackingItemId, setAttackingItemId] = useState<null | string>(null);
  const [isFleeing, setIsFleeing] = useState<boolean>(false);
  const [continueToBattleOutcome, setContinueToBattleOutcome] = useState(false);

  const allBattles = useEntityQuery([Has(CombatEncounter)])
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
      winner,
    };
  }, [allBattles, CombatOutcome]);

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

  const allAttackOutcomes = useEntityQuery([Has(ActionOutcome)])
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
    );

  const currentBattleAttackOutcomes = useMemo(
    () =>
      allAttackOutcomes.filter(
        attack => attack.encounterId === currentBattle?.encounterId,
      ),
    [allAttackOutcomes, currentBattle],
  );

  const statusEffectActions: StatusAction[] = useMemo(() => {
    if (!currentBattle) return [];

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
          const validity = getComponentValueStrict(
            StatusEffectValidity,
            paddedEffectId,
          );

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
      .flat();
  }, [currentBattle, EncounterEntity, StatusEffectValidity]);

  const onAttack = useCallback(
    async (itemId: string) => {
      try {
        setAttackingItemId(itemId);

        if (!delegatorAddress) {
          throw new Error('Missing delegation.');
        }

        if (!character) {
          throw new Error('Character not found.');
        }

        if (!currentBattle) {
          throw new Error('Battle not found.');
        }

        if (!opponent) {
          throw new Error('Opponent not found.');
        }

        const { error, success } = await endTurn(
          currentBattle.encounterId,
          character.id,
          opponent.id,
          itemId,
        );

        if (error && !success) {
          throw new Error(error);
        }

        localStorage.removeItem(CURRENT_BATTLE_OPPONENT_TURN_KEY);
        localStorage.removeItem(CURRENT_BATTLE_USER_TURN_KEY);

        refreshCharacter();
      } catch (e) {
        renderError((e as Error)?.message ?? 'Failed to attack.', e);
      } finally {
        setAttackingItemId(null);
      }
    },
    [
      character,
      currentBattle,
      delegatorAddress,
      endTurn,
      opponent,
      refreshCharacter,
      renderError,
    ],
  );

  const onFleePvp = useCallback(async () => {
    try {
      setIsFleeing(true);

      if (!character) {
        throw new Error('No character found.');
      }

      if (!delegatorAddress) {
        throw new Error('Missing delegation.');
      }

      if (!currentBattle) {
        throw new Error('No battle found.');
      }

      if (currentBattle.encounterType !== EncounterType.PvP) {
        throw new Error('Cannot flee from a PvE battle.');
      }

      const { error, success } = await fleePvp(character.id);

      if (error && !success) {
        throw new Error(error);
      }

      renderSuccess('Successfully fled the battle.');
    } catch (e) {
      renderError((e as Error)?.message ?? 'Error fleeing from battle.', e);
    } finally {
      setIsFleeing(false);
    }
  }, [
    character,
    currentBattle,
    delegatorAddress,
    fleePvp,
    renderError,
    renderSuccess,
  ]);

  return (
    <BattleContext.Provider
      value={{
        attackOutcomes: currentBattleAttackOutcomes,
        attackingItemId,
        continueToBattleOutcome,
        currentBattle,
        isFleeing,
        lastestBattleOutcome,
        onAttack,
        onContinueToBattleOutcome,
        onFleePvp,
        opponent,
        statusEffectActions,
        userCharacterForBattleRendering,
      }}
    >
      {children}
    </BattleContext.Provider>
  );
};

export const useBattle = (): BattleContextType => useContext(BattleContext);
