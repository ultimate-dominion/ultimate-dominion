import { useEntityQuery } from '@latticexyz/react';
import { getComponentValueStrict, HasValue } from '@latticexyz/recs';
import { decodeEntity } from '@latticexyz/store-sync/recs';
import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { hexToString } from 'viem';

import { CharacterClasses, type Metadata } from '../utils/types';
import { useMUD } from './MUDContext';

type CharacterContextType = {
  characterClass: CharacterClasses;
  characterId: string;
  description: string;
  image: string;
  locked: boolean;
  name: string;
  owner: string;
} | null;

const CharacterContext = createContext<CharacterContextType>(null);

export type CharacterProviderProps = {
  children: ReactNode;
};

export const CharacterProvider = ({
  children,
}: CharacterProviderProps): JSX.Element => {
  const {
    components: { Characters },
    delegatorAddress,
  } = useMUD();

  const [metadata] = useState<Metadata | null>({
    description: 'Slayer of Moloch!',
    image:
      'https://ipfs.io/ipfs/QmZPHxk9PfFPgMv1Q3KoaG7Mtxk52tySkd7rpG4Sv7GqFL',
    name: 'Alice',
  });

  const characterComponent = useEntityQuery([
    HasValue(Characters, {
      owner: delegatorAddress ?? '0x0',
    }),
  ]).map(entity => {
    const character = getComponentValueStrict(Characters, entity);
    return {
      ...character,
      name: hexToString(character.name as `0x${string}`, { size: 32 }),
      characterId: decodeEntity({ characterId: 'uint256' }, entity).characterId,
    };
  })[0];

  const value = useMemo(() => {
    if (!(characterComponent && metadata)) {
      return null;
    }

    const {
      class: characterClass,
      characterId,
      locked,
      owner,
    } = characterComponent;

    return {
      characterClass,
      characterId: characterId.toString(),
      locked,
      owner,
      ...metadata,
    };
  }, [characterComponent, metadata]);

  return (
    <CharacterContext.Provider value={value}>
      {children}
    </CharacterContext.Provider>
  );
};

export const useCharacter = (): CharacterContextType =>
  useContext(CharacterContext);
