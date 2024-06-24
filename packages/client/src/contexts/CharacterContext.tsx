import { getComponentValueStrict, HasValue, runQuery } from '@latticexyz/recs';
import { decodeEntity } from '@latticexyz/store-sync/recs';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { getContract, hexToString } from 'viem';

import { useToast } from '../hooks/useToast';
import { fetchMetadataFromUri, uriToHttp } from '../utils/helpers';
import type { Character } from '../utils/types';
import { useMUD } from './MUDContext';

type CharacterContextType = {
  character: Character | null;
  isRefreshing: boolean;
  refreshCharacter: () => void;
};

const CharacterContext = createContext<CharacterContextType>({
  character: null,
  isRefreshing: false,
  refreshCharacter: () => {},
});

export type CharacterProviderProps = {
  children: ReactNode;
};

export const CharacterProvider = ({
  children,
}: CharacterProviderProps): JSX.Element => {
  const {
    components: { Characters, CharacterStats },
    delegatorAddress,
    network: { publicClient, worldContract },
  } = useMUD();
  const { renderError } = useToast();

  const [characterDetails, setCharacterDetails] = useState<Character | null>(
    null,
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const getCharacterData = useCallback(async () => {
    if (!(delegatorAddress && publicClient && worldContract)) return;
    const characterComponent = Array.from(
      runQuery([
        HasValue(Characters, {
          owner: delegatorAddress ?? '0x0',
        }),
      ]),
    ).map(entity => {
      const characterData = getComponentValueStrict(Characters, entity);
      const characterStats = getComponentValueStrict(CharacterStats, entity);
      return {
        agility: characterStats.agility.toString(),
        characterClass: characterData.class,
        characterId: decodeEntity(
          { characterId: 'uint256' },
          entity,
        ).characterId.toString(),
        hitPoints: characterStats.hitPoints.toString(),
        intelligence: characterStats.intelligence.toString(),
        locked: characterData.locked,
        name: hexToString(characterData.name as `0x${string}`, { size: 32 }),
        owner: characterData.owner,
        strength: characterStats.strength.toString(),
      };
    })[0];

    if (!characterComponent) return;

    const characterTokenAddress =
      await worldContract.read.UD__getCharacterToken();

    const erc721 = getContract({
      address: characterTokenAddress,
      abi: [
        {
          type: 'function',
          name: 'tokenURI',
          inputs: [
            {
              name: 'tokenId',
              type: 'uint256',
              internalType: 'uint256',
            },
          ],
          outputs: [
            {
              name: '',
              type: 'string',
              internalType: 'string',
            },
          ],
          stateMutability: 'view',
        },
      ],
      client: publicClient,
    });

    const metadataURI = await erc721.read.tokenURI([
      BigInt(characterComponent.characterId),
    ]);

    const fetachedMetadata = await fetchMetadataFromUri(
      uriToHttp(metadataURI)[0],
    );

    setCharacterDetails({
      ...characterComponent,
      ...fetachedMetadata,
    });
  }, [
    Characters,
    CharacterStats,
    delegatorAddress,
    publicClient,
    worldContract,
  ]);

  const refreshCharacter = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await getCharacterData();
    } catch (error) {
      renderError('Error refreshing character');
    } finally {
      setIsRefreshing(false);
    }
  }, [getCharacterData, renderError]);

  useEffect(() => {
    if (!(delegatorAddress && publicClient && worldContract)) return;
    getCharacterData();
  }, [delegatorAddress, getCharacterData, publicClient, worldContract]);

  return (
    <CharacterContext.Provider
      value={{
        character: characterDetails,
        isRefreshing,
        refreshCharacter,
      }}
    >
      {children}
    </CharacterContext.Provider>
  );
};

export const useCharacter = (): CharacterContextType =>
  useContext(CharacterContext);
