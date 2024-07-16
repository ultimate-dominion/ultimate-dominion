import { useEntityQuery } from '@latticexyz/react';
import { Entity, getComponentValue, Has } from '@latticexyz/recs';
import { createContext, ReactNode, useContext, useMemo } from 'react';

import type { CombatDetails, Monster } from '../utils/types';
import { useCharacter } from './CharacterContext';
import { useMapNavigation } from './MapNavigationContext';
import { useMUD } from './MUDContext';

type CombatContextType = {
  currentBattle: CombatDetails | null;
  monster: Monster | null;
};

const CombatContext = createContext<CombatContextType>({
  currentBattle: null,
  monster: null,
});

export type NavigationProviderProps = {
  children: ReactNode;
};

export const CombatProvider = ({
  children,
}: NavigationProviderProps): JSX.Element => {
  const {
    components: { CombatEncounter },
  } = useMUD();
  const { character } = useCharacter();
  const { monsters } = useMapNavigation();

  const currentBattle =
    Array.from(useEntityQuery([Has(CombatEncounter)]))
      .map(entity => {
        const encounter = getComponentValue(CombatEncounter, entity);
        if (!encounter) return null;

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
          (encounter?.attackers.includes(character.characterId) ||
            encounter?.defenders.includes(character.characterId)),
      )[0] ?? null;

  const monster = useMemo(() => {
    if (!currentBattle) return null;

    return (
      monsters.find(monster =>
        currentBattle.defenders.includes(monster.monsterId),
      ) ?? null
    );
  }, [currentBattle, monsters]);

  return (
    <CombatContext.Provider
      value={{
        currentBattle,
        monster,
      }}
    >
      {children}
    </CombatContext.Provider>
  );
};

export const useCombat = (): CombatContextType => useContext(CombatContext);
