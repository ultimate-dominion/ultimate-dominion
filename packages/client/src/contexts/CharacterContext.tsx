import {
  getComponentValue,
  getComponentValueStrict,
  HasValue,
  runQuery,
} from '@latticexyz/recs';
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
import {
  decodeCharacterId,
  fetchMetadataFromUri,
  uriToHttp,
} from '../utils/helpers';
import type { Character, CharacterData, CharacterStats } from '../utils/types';
import { useMUD } from './MUDContext';

type CharacterContextType = {
  character: Character | null;
  isRefreshing: boolean;
  refreshCharacter: () => Promise<void>;
};

const CharacterContext = createContext<CharacterContextType>({
  character: null,
  isRefreshing: false,
  refreshCharacter: async () => {},
});

export type CharacterProviderProps = {
  children: ReactNode;
};

export const CharacterProvider = ({
  children,
}: CharacterProviderProps): JSX.Element => {
  const {
    components: { Characters, Stats },
    delegatorAddress,
    network: { publicClient, worldContract },
  } = useMUD();
  const { renderError } = useToast();

  const [userCharacter, setUserCharacter] = useState<Character | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshCharacterData = useCallback(async () => {
    if (!(delegatorAddress && publicClient && worldContract)) return;
    const partialCharacter: Omit<
      CharacterData & CharacterStats,
      'goldBalance'
    > = Array.from(
      runQuery([
        HasValue(Characters, {
          owner: delegatorAddress,
        }),
      ]),
    ).map(entity => {
      const characterData = getComponentValueStrict(Characters, entity);
      const characterStats = getComponentValue(Stats, entity);

      const { characterTokenId } = decodeCharacterId(
        entity.toString() as `0x${string}`,
      );

      return {
        agility: characterStats?.agility.toString() ?? '0',
        baseHitPoints: characterStats?.baseHitPoints.toString() ?? '0',
        characterClass: characterStats?.class ?? 0,
        characterId: entity,
        experience: characterStats?.experience.toString() ?? '0',
        intelligence: characterStats?.intelligence.toString() ?? '0',
        level: characterStats?.level.toString() ?? '0',
        locked: characterData.locked,
        name: hexToString(characterData.name as `0x${string}`, { size: 32 }),
        owner: characterData.owner,
        strength: characterStats?.strength.toString() ?? '0',
        tokenId: characterTokenId,
      };
    })[0];

    if (!partialCharacter) return;

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
      BigInt(partialCharacter.tokenId),
    ]);

    const fetachedMetadata = await fetchMetadataFromUri(
      uriToHttp(metadataURI)[0],
    );

    const metadataURI = getComponentValueStrict(
      CharactersTokenURI,
      tokenIdEntity,
    ).tokenURI;

    const fetachedMetadata = await fetchMetadataFromUri(
      uriToHttp(`ipfs://${metadataURI}`)[0],
    );

    const goldBalance = await goldToken.read.balanceOf([delegatorAddress]);

    setUserCharacter({
      ...partialCharacter,
      ...fetachedMetadata,
    });
  }, [Characters, delegatorAddress, publicClient, Stats, worldContract]);

  const refreshCharacter = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshCharacterData();
    } catch (error) {
      renderError('Error refreshing character');
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshCharacterData, renderError]);

  useEffect(() => {
    if (!(delegatorAddress && publicClient && worldContract)) return;
    refreshCharacterData();
  }, [delegatorAddress, refreshCharacterData, publicClient, worldContract]);

  return (
    <CharacterContext.Provider
      value={{
        character: userCharacter,
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
