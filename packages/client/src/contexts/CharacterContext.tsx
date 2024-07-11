import { useComponentValue } from '@latticexyz/react';
import {
  getComponentValue,
  getComponentValueStrict,
  HasValue,
  runQuery,
} from '@latticexyz/recs';
import { singletonEntity } from '@latticexyz/store-sync/recs';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { formatEther, hexToString } from 'viem';

import { useToast } from '../hooks/useToast';
import { BALANCE_OF_ABI, TOKEN_URI_ABI } from '../utils/constants';
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
    components: { Characters, Stats, UltimateDominionConfig },
    delegatorAddress,
    network: { publicClient, worldContract },
  } = useMUD();
  const { renderError } = useToast();

  const [userCharacter, setUserCharacter] = useState<Character | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const ultimateDominionConfig = useComponentValue(
    UltimateDominionConfig,
    singletonEntity,
  );

  const refreshCharacterData = useCallback(async () => {
    if (
      !(
        delegatorAddress &&
        publicClient &&
        ultimateDominionConfig &&
        worldContract
      )
    )
      return;
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

    const { characterToken, goldToken, multicall } = ultimateDominionConfig;

    const characterContract = {
      address: characterToken as `0x${string}`,
      abi: TOKEN_URI_ABI,
    };

    const goldTokenContract = {
      address: goldToken as `0x${string}`,
      abi: BALANCE_OF_ABI,
    };

    const [{ result: metadataURI }, { result: goldBalance }] =
      await publicClient.multicall({
        contracts: [
          {
            ...characterContract,
            functionName: 'tokenURI',
            args: [BigInt(partialCharacter.tokenId)],
          },
          {
            ...goldTokenContract,
            functionName: 'balanceOf',
            args: [delegatorAddress],
          },
        ],
        multicallAddress: multicall as `0x${string}`,
      });

    const fetachedMetadata = await fetchMetadataFromUri(
      uriToHttp(metadataURI as string)[0],
    );

    setUserCharacter({
      ...partialCharacter,
      ...fetachedMetadata,
      goldBalance: formatEther(BigInt(goldBalance as bigint)).toString(),
    });
  }, [
    Characters,
    delegatorAddress,
    publicClient,
    Stats,
    ultimateDominionConfig,
    worldContract,
  ]);

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
