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
import { formatEther, formatUnits } from 'viem';

import { useToast } from '../hooks/useToast';
import {
  BATTLE_OUTCOME_SEEN_KEY,
  CURRENT_BATTLE_MONSTER_TURN_KEY,
  CURRENT_BATTLE_USER_TURN_KEY,
} from '../utils/constants';
import {
  type ActionOutcomeType,
  ActionType,
  type Character,
  type CombatDetails,
  type CombatOutcomeType,
  type Monster,
} from '../utils/types';
import { useCharacter } from './CharacterContext';
import { useMap } from './MapContext';
import { useMUD } from './MUDContext';

type BattleContextType = {
  actionOutcomes: ActionOutcomeType[];
  attackingItemId: null | string;
  continueToBattleOutcome: boolean;
  currentBattle: CombatDetails | null;
  lastestBattleOutcome: CombatOutcomeType | null;
  onAttack: (itemId: string) => void;
  onContinueToBattleOutcome: (cont: boolean) => void;
  opponent: Character | Monster | null;
};

const BattleContext = createContext<BattleContextType>({
  actionOutcomes: [],
  attackingItemId: null,
  continueToBattleOutcome: false,
  currentBattle: null,
  lastestBattleOutcome: null,
  onAttack: () => {},
  onContinueToBattleOutcome: () => {},
  opponent: null,
});

export type BattleProviderProps = {
  children: ReactNode;
};

export const BattleProvider = ({
  children,
}: BattleProviderProps): JSX.Element => {
  const { renderError } = useToast();
  const {
    components: { ActionOutcome, Actions, CombatEncounter, CombatOutcome },
    delegatorAddress,
    systemCalls: { endTurn },
  } = useMUD();
  const { character, refreshCharacter } = useCharacter();
  const { allMonsters, otherCharactersOnTile } = useMap();

  const [attackingItemId, setAttackingItemId] = useState<null | string>(null);
  const [continueToBattleOutcome, setContinueToBattleOutcome] = useState(false);

  const allBattles = useEntityQuery([Has(CombatEncounter)])
    .map(entity => {
      const encounter = getComponentValueStrict(CombatEncounter, entity);

      return {
        attackers: encounter.attackers as Entity[],
        currentTurn: encounter.currentTurn.toString(),
        defenders: encounter.defenders as Entity[],
        encounterId: entity,
        encounterType: encounter.encounterType,
        end: encounter.end.toString(),
        maxTurns: encounter.maxTurns.toString(),
        start: encounter.start.toString(),
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

    const latestBattleOutcomeSeen = localStorage.getItem(
      BATTLE_OUTCOME_SEEN_KEY,
    );

    if (latestBattleOutcomeSeen === latestBattle?.encounterId) return null;

    if (latestBattle.end !== '0' && continueToBattleOutcome) return null;
    return latestBattle;
  }, [allBattles, continueToBattleOutcome]);

  const lastestBattleOutcome = useMemo(() => {
    const latestCompletedBattle = allBattles.filter(b => b.end !== '0').pop();
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
      endTime: combatOutcome.endTime.toString(),
      expDropped: combatOutcome.expDropped.toString(),
      goldDropped: formatEther(combatOutcome.goldDropped).toString(),
      itemsDropped: combatOutcome.itemsDropped.map(i => i.toString()),
      winner,
    };
  }, [allBattles, CombatOutcome]);

  const opponent = useMemo(() => {
    if (!currentBattle) return null;

    let possibleOpponent: Character | Monster | undefined = allMonsters.find(
      monster =>
        [...currentBattle.attackers, ...currentBattle.defenders].includes(
          monster.id,
        ),
    );

    if (!possibleOpponent) {
      possibleOpponent = otherCharactersOnTile.find(char =>
        [...currentBattle.attackers, ...currentBattle.defenders].includes(
          char.id,
        ),
      );
    }

    return possibleOpponent ?? null;
  }, [allMonsters, currentBattle, otherCharactersOnTile]);

  const allActionOutcomes = useEntityQuery([Has(ActionOutcome)])
    .map(entity => {
      const _actionOutcome = getComponentValueStrict(ActionOutcome, entity);

      const { encounterId, currentTurn, actionNumber } = decodeEntity(
        {
          encounterId: 'bytes32',
          currentTurn: 'uint256',
          actionNumber: 'uint256',
        },
        entity,
      );

      return {
        attackerDamageDelt: formatUnits(
          _actionOutcome.attackerDamageDelt,
          5,
        ).toString(),
        attackerDied: _actionOutcome.attackerDied,
        attackerId: _actionOutcome.attackerId.toString(),
        actionId: _actionOutcome.actionId.toString(),
        actionNumber: actionNumber.toString(),
        blockNumber: _actionOutcome.blockNumber.toString(),
        crit: _actionOutcome.crit,
        currentTurn: currentTurn.toString(),
        defenderDamageDelt: _actionOutcome.defenderDamageDelt.toString(),
        defenderDied: _actionOutcome.defenderDied,
        defenderId: _actionOutcome.defenderId.toString(),
        encounterId: encounterId.toString(),
        hit: _actionOutcome.hit,
        miss: _actionOutcome.miss,
        timestamp: _actionOutcome.timestamp.toString(),
        weaponId: _actionOutcome.weaponId.toString(),
      } as ActionOutcomeType;
    })
    .filter(
      action =>
        action.attackerId === character?.id ||
        action.defenderId === character?.id,
    );

  const currentBattleActionOutcomes = useMemo(
    () =>
      allActionOutcomes.filter(
        action => action.encounterId === currentBattle?.encounterId,
      ),
    [allActionOutcomes, currentBattle],
  );

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

        const basicAttackId = Array.from(
          runQuery([
            Has(Actions),
            HasValue(Actions, { actionType: ActionType.PhysicalAttack }),
          ]),
        )[0];

        if (!basicAttackId) {
          throw new Error('Basic attack not found.');
        }

        const { error, success } = await endTurn(
          currentBattle.encounterId,
          character.id,
          opponent.id,
          basicAttackId,
          itemId,
          currentBattle.currentTurn,
        );

        if (error && !success) {
          throw new Error(error);
        }

        localStorage.removeItem(CURRENT_BATTLE_MONSTER_TURN_KEY);
        localStorage.removeItem(CURRENT_BATTLE_USER_TURN_KEY);

        await refreshCharacter();
      } catch (e) {
        renderError((e as Error)?.message ?? 'Failed to attack.', e);
      } finally {
        setAttackingItemId(null);
      }
    },
    [
      Actions,
      character,
      currentBattle,
      delegatorAddress,
      endTurn,
      opponent,
      refreshCharacter,
      renderError,
    ],
  );

  return (
    <BattleContext.Provider
      value={{
        actionOutcomes: currentBattleActionOutcomes,
        attackingItemId,
        continueToBattleOutcome,
        currentBattle,
        lastestBattleOutcome,
        onAttack,
        onContinueToBattleOutcome,
        opponent,
      }}
    >
      {children}
    </BattleContext.Provider>
  );
};

export const useBattle = (): BattleContextType => useContext(BattleContext);
