import { useComponentValue } from '@latticexyz/react';
import { getComponentValueStrict, HasValue, runQuery } from '@latticexyz/recs';
import { decodeEntity, encodeEntity } from '@latticexyz/store-sync/recs';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { formatEther, getContract, hexToString } from 'viem';

import { useToast } from '../hooks/useToast';
import { fetchMetadataFromUri, uriToHttp } from '../utils/helpers';
import type { Character, CharacterStats } from '../utils/types';
import { useMUD } from './MUDContext';

type CharacterContextType = {
  character: Character | null;
  characterStats: CharacterStats;
  isRefreshing: boolean;
  refreshCharacter: () => void;
};

const CharacterContext = createContext<CharacterContextType>({
  character: null,
  characterStats: {
    agility: '0',
    experience: '0',
    hitPoints: '0',
    intelligence: '0',
    strength: '0',
  },
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
  const characterStats = useComponentValue(
    CharacterStats,
    characterDetails
      ? encodeEntity(
          { characterId: 'uint256' },
          { characterId: BigInt(characterDetails.characterId) },
        )
      : undefined,
  );

  const [isRefreshing, setIsRefreshing] = useState(false);

  const getCharacterData = useCallback(async () => {
    if (!(delegatorAddress && publicClient && worldContract)) return;
    const characterComponent = Array.from(
      runQuery([
        HasValue(Characters, {
          owner: delegatorAddress,
        }),
      ]),
    ).map(entity => {
      const characterData = getComponentValueStrict(Characters, entity);

      return {
        characterClass: characterData.class,
        characterId: decodeEntity(
          { characterId: 'uint256' },
          entity,
        ).characterId.toString(),
        locked: characterData.locked,
        name: hexToString(characterData.name as `0x${string}`, { size: 32 }),
        owner: characterData.owner,
      };
    })[0];

    if (!characterComponent) return;

    const characterTokenAddress =
      await worldContract.read.UD__getCharacterToken();

    const characterToken = getContract({
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

    const metadataURI = await characterToken.read.tokenURI([
      BigInt(characterComponent.characterId),
    ]);

    const fetachedMetadata = await fetchMetadataFromUri(
      uriToHttp(metadataURI)[0],
    );

    const goldTokenAddress = await worldContract.read.UD__getGoldToken();

    const goldToken = getContract({
      address: goldTokenAddress,
      abi: [
        {
          type: 'function',
          name: 'balanceOf',
          inputs: [
            {
              name: 'account',
              type: 'address',
              internalType: 'address',
            },
          ],
          outputs: [
            {
              name: '',
              type: 'uint256',
              internalType: 'uint256',
            },
          ],
          stateMutability: 'view',
        },
      ],
      client: publicClient,
    });

    const goldBalance = await goldToken.read.balanceOf([delegatorAddress]);

    setCharacterDetails({
      ...characterComponent,
      ...fetachedMetadata,
      goldBalance: formatEther(BigInt(goldBalance)).toString(),
    });
  }, [Characters, delegatorAddress, publicClient, worldContract]);

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
        characterStats: {
          agility: characterStats?.agility.toString() ?? '0',
          experience: characterStats?.experience.toString() ?? '0',
          hitPoints: characterStats?.hitPoints.toString() ?? '0',
          intelligence: characterStats?.intelligence.toString() ?? '0',
          strength: characterStats?.strength.toString() ?? '0',
        },
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
