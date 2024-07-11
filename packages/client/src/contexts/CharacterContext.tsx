import { useComponentValue } from '@latticexyz/react';
import { getComponentValueStrict, HasValue, runQuery } from '@latticexyz/recs';
import { encodeEntity } from '@latticexyz/store-sync/recs';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  bytesToHex,
  formatEther,
  getContract,
  hexToBytes,
  hexToString,
} from 'viem';

import { useToast } from '../hooks/useToast';
import { fetchMetadataFromUri, uriToHttp } from '../utils/helpers';
import type { CharacterData, CharacterStats } from '../utils/types';
import { useMUD } from './MUDContext';

type CharacterContextType = {
  character: CharacterData | null;
  characterStats: CharacterStats;
  isRefreshing: boolean;
  refreshCharacter: () => Promise<void>;
};

const CharacterContext = createContext<CharacterContextType>({
  character: null,
  characterStats: {
    agility: '0',
    experience: '0',
    intelligence: '0',
    baseHitPoints: '0',
    strength: '0',
  },
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

  const [characterData, setCharacterData] = useState<CharacterData | null>(
    null,
  );
  const characterStats = useComponentValue(
    Stats,
    characterData
      ? encodeEntity(
          { characterId: 'uint256' },
          { characterId: BigInt(characterData.characterId) },
        )
      : undefined,
  );

  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchCharacterData = useCallback(async () => {
    if (!(delegatorAddress && publicClient && worldContract)) return;
    const partialCharacter: CharacterData & CharacterStats = Array.from(
      runQuery([
        HasValue(Characters, {
          owner: delegatorAddress,
        }),
      ]),
    ).map(entity => {
      const characterData = getComponentValueStrict(Characters, entity);
      const characterStats = getComponentValue(Stats, entity);
      const { tokenId } = characterData;

      const ownerEntity = encodeEntity(
        { address: 'address' },
        { address: characterData.owner as `0x${string}` },
      );
      const goldBalance =
        getComponentValue(GoldBalances, ownerEntity)?.value ?? BigInt(0);

      const entityBytes = hexToBytes(entity.toString() as `0x${string}`);
      const tokenBytes = entityBytes.slice(20);
      const tokenId = BigInt(bytesToHex(tokenBytes)).toString();

      return {
        characterClass: characterData.class,
        characterId: entity,
        locked: characterData.locked,
        name: hexToString(characterData.name as `0x${string}`, { size: 32 }),
        owner: characterData.owner,
        tokenId,
      };
    })[0];

    if (!partialCharacter) return;
    const { tokenId } = partialCharacter;

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
      BigInt(characterComponent.tokenId),
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

    setCharacterData({
      ...characterComponent,
      ...fetachedMetadata,
    });
  }, [
    Characters,
    CharactersTokenURI,
    delegatorAddress,
    GoldBalances,
    publicClient,
    Stats,
    worldContract,
  ]);

  const refreshCharacter = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchCharacterData();
    } catch (error) {
      renderError('Error refreshing character');
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchCharacterData, renderError]);

  useEffect(() => {
    if (!(delegatorAddress && publicClient && worldContract)) return;
    fetchCharacterData();
  }, [delegatorAddress, fetchCharacterData, publicClient, worldContract]);

  return (
    <CharacterContext.Provider
      value={{
        character: characterData,
        characterStats: {
          agility: characterStats?.agility.toString() ?? '0',
          experience: characterStats?.experience.toString() ?? '0',
          intelligence: characterStats?.intelligence.toString() ?? '0',
          baseHitPoints: characterStats?.baseHitPoints.toString() ?? '0',
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
