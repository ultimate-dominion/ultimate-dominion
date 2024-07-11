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
  refreshCharacter: () => void;
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
  refreshCharacter: () => {},
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
      BigInt(characterComponent.tokenId),
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

    setCharacterData({
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
