import { useEntityQuery } from '@latticexyz/react';
import {
  Entity,
  getComponentValue,
  getComponentValueStrict,
  Has,
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
import { formatEther } from 'viem';

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
  type Monster,
} from '../utils/types';
import { useCharacter } from './CharacterContext';
import { useMap } from './MapContext';
import { useMUD } from './MUDContext';

type BattleContextType = {
  attackOutcomes: AttackOutcomeType[];
  attackingItemId: null | string;
  continueToBattleOutcome: boolean;
  currentBattle: CombatDetails | null;
  lastestBattleOutcome: CombatOutcomeType | null;
  onAttack: (itemId: string, currentTurn: string) => void;
  onContinueToBattleOutcome: (cont: boolean) => void;
  opponent: Character | Monster | null;
  userCharacterForBattleRendering: Character | null;
};

const BattleContext = createContext<BattleContextType>({
  attackOutcomes: [],
  attackingItemId: null,
  continueToBattleOutcome: false,
  currentBattle: null,
  lastestBattleOutcome: null,
  onAttack: () => {},
  onContinueToBattleOutcome: () => {},
  opponent: null,
  userCharacterForBattleRendering: null,
});

export type BattleProviderProps = {
  children: ReactNode;
};

export const BattleProvider = ({
  children,
}: BattleProviderProps): JSX.Element => {
  const { renderError } = useToast();
  const {
    components: { ActionOutcome, CombatEncounter, CombatOutcome },
    delegatorAddress,
    systemCalls: { endTurn },
  } = useMUD();
  const { character, refreshCharacter } = useCharacter();
  const { allMonsters, allCharacters } = useMap();

  const [attackingItemId, setAttackingItemId] = useState<null | string>(null);
  const [continueToBattleOutcome, setContinueToBattleOutcome] = useState(false);

  const allBattles = useEntityQuery([Has(CombatEncounter)])
    .map(entity => {
      const encounter = getComponentValueStrict(CombatEncounter, entity);

      return {
        attackers: encounter.attackers as Entity[],
        currentTurn: encounter.currentTurn.toString(),
        currentTurnTimer: encounter.currentTurnTimer.toString(),
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

    return latestBattle;
  }, [allBattles]);

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
        attackerDamageDelt: _attackOutcome.attackerDamageDelt.toString(),
        attackerDied: _attackOutcome.attackerDied,
        attackerId: _attackOutcome.attackerId.toString(),
        attackNumber: attackNumber.toString(),
        blockNumber: _attackOutcome.blockNumber.toString(),
        crit: _attackOutcome.crit,
        currentTurn: currentTurn.toString(),
        effectIds: _attackOutcome.effectIds.map(e => e.toString()),
        encounterId: encounterId.toString(),
        damagePerHit: _attackOutcome.damagePerHit.map(d => d.toString()),
        defenderDamageDelt: _attackOutcome.defenderDamageDelt.toString(),
        defenderDied: _attackOutcome.defenderDied,
        defenderId: _attackOutcome.defenderId.toString(),
        hit: _attackOutcome.hit,
        itemId: _attackOutcome.itemId.toString(),
        miss: _attackOutcome.miss,
        timestamp: _attackOutcome.timestamp.toString(),
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

  const onAttack = useCallback(
    async (itemId: string, currentTurn: string) => {
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
          currentTurn,
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

  return (
    <BattleContext.Provider
      value={{
        attackOutcomes: currentBattleAttackOutcomes,
        attackingItemId,
        continueToBattleOutcome,
        currentBattle,
        lastestBattleOutcome,
        onAttack,
        onContinueToBattleOutcome,
        opponent,
        userCharacterForBattleRendering,
      }}
    >
      {children}
    </BattleContext.Provider>
  );
};

export const useBattle = (): BattleContextType => useContext(BattleContext);
