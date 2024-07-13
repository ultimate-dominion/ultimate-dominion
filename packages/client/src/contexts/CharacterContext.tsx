import {
  getComponentValue,
  getComponentValueStrict,
  HasValue,
  runQuery,
} from '@latticexyz/recs';
import { encodeEntity } from '@latticexyz/store-sync/recs';
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
import { fetchMetadataFromUri, uriToHttp } from '../utils/helpers';
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
    components: { Characters, CharactersTokenURI, GoldBalances, Stats },
    delegatorAddress,
    network: { publicClient, worldContract },
  } = useMUD();
  const { renderError } = useToast();

  const [userCharacter, setUserCharacter] = useState<Character | null>(null);
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

      return {
        agility: characterStats?.agility.toString() ?? '0',
        baseHitPoints: characterStats?.baseHitPoints.toString() ?? '0',
        characterClass: characterStats?.class ?? 0,
        characterId: entity,
        experience: characterStats?.experience.toString() ?? '0',
        goldBalance: formatEther(goldBalance).toString(),
        intelligence: characterStats?.intelligence.toString() ?? '0',
        level: characterStats?.level.toString() ?? '0',
        locked: characterData.locked,
        name: hexToString(characterData.name as `0x${string}`, { size: 32 }),
        owner: characterData.owner,
        strength: characterStats?.strength.toString() ?? '0',
        tokenId: tokenId.toString(),
      };
    })[0];

    if (!partialCharacter) return;
    const { tokenId } = partialCharacter;

    const tokenIdEntity = encodeEntity(
      { tokenId: 'uint256' },
      { tokenId: BigInt(tokenId) },
    );

    const metadataURI = getComponentValueStrict(
      CharactersTokenURI,
      tokenIdEntity,
    ).tokenURI;

    const fetachedMetadata = await fetchMetadataFromUri(
      uriToHttp(`ipfs://${metadataURI}`)[0],
    );

    setUserCharacter({
      ...partialCharacter,
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
