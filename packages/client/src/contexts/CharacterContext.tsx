import {
  getComponentValue,
  getComponentValueStrict,
  HasValue,
  runQuery,
} from '@latticexyz/recs';
import { encodeEntity, singletonEntity } from '@latticexyz/store-sync/recs';
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
import type {
  Character,
  CharacterData,
  CharacterStats,
  StatsClasses,
  Weapon,
} from '../utils/types';
import { useMUD } from './MUDContext';

type CharacterContextType = {
  character: Character | null;
  equippedItems: Weapon[] | null;
  isRefreshing: boolean;
  refreshCharacter: () => Promise<void>;
};

const CharacterContext = createContext<CharacterContextType>({
  character: null,
  equippedItems: null,
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
    components: {
      CharacterEquipment,
      Characters,
      CharactersTokenURI,
      ItemsBaseURI,
      ItemsOwners,
      ItemsTokenURI,
      GoldBalances,
      Stats,
    },
    delegatorAddress,
    isSynced,
    network: { publicClient, worldContract },
  } = useMUD();
  const { renderError } = useToast();

  const [userCharacter, setUserCharacter] = useState<Character | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [equippedItems, setEquippedItems] = useState<Weapon[] | null>(null);

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
    if (!(delegatorAddress && isSynced && publicClient && worldContract))
      return;
    fetchCharacterData();
  }, [
    delegatorAddress,
    fetchCharacterData,
    isSynced,
    publicClient,
    worldContract,
  ]);

  const fetchCharacterItems = useCallback(
    async (_character: Character, _equippedWeapons: bigint[]) => {
      try {
        if (_equippedWeapons.length === 0) {
          setEquippedItems([]);
          return;
        }

        const _items = _equippedWeapons
          .map(tokenId => {
            const tokenOwnersEntity = encodeEntity(
              { owner: 'address', tokenId: 'uint256' },
              {
                owner: _character.owner as `0x${string}`,
                tokenId: BigInt(tokenId),
              },
            );
            const itemOwner = getComponentValueStrict(
              ItemsOwners,
              tokenOwnersEntity,
            );

            return {
              balance: itemOwner.balance.toString(),
              itemId: tokenOwnersEntity,
              owner: _character.owner,
              tokenId: tokenId.toString(),
            };
          })
          .filter(item => item.owner === _character.owner)
          .sort((a, b) => {
            return Number(a.tokenId) - Number(b.tokenId);
          });

        const fullItems = await Promise.all(
          _items.map(async item => {
            const itemTemplateStats =
              await worldContract.read.UD__getWeaponStats([
                BigInt(item.tokenId),
              ]);

            const tokenIdEntity = encodeEntity(
              { tokenId: 'uint256' },
              { tokenId: BigInt(item.tokenId) },
            );

            const baseURI = getComponentValueStrict(
              ItemsBaseURI,
              singletonEntity,
            ).uri;

            const tokenURI = getComponentValueStrict(
              ItemsTokenURI,
              tokenIdEntity,
            ).uri;

            const metadata = await fetchMetadataFromUri(
              uriToHttp(`${baseURI}${tokenURI}`)[0],
            );

            return {
              ...metadata,
              agiModifier: itemTemplateStats.agiModifier.toString(),
              balance: item.balance,
              classRestrictions: itemTemplateStats.classRestrictions.map(
                (classRestriction: number) => classRestriction as StatsClasses,
              ),
              hitPointModifier: itemTemplateStats.hitPointModifier.toString(),
              intModifier: itemTemplateStats.intModifier.toString(),
              itemId: item.itemId,
              maxDamage: itemTemplateStats.maxDamage.toString(),
              minDamage: itemTemplateStats.minDamage.toString(),
              minLevel: itemTemplateStats.minLevel.toString(),
              owner: item.owner,
              strModifier: itemTemplateStats.strModifier.toString(),
              tokenId: item.tokenId,
            } as Weapon;
          }),
        );

        setEquippedItems(fullItems);
      } catch (error) {
        renderError(error, 'Failed to fetch character data');
      }
    },
    [ItemsBaseURI, ItemsOwners, ItemsTokenURI, renderError, worldContract],
  );

  useEffect(() => {
    if (!isSynced) return;
    (async (): Promise<void> => {
      if (!userCharacter) return;
      const equippedWeapons =
        getComponentValue(CharacterEquipment, userCharacter.characterId)
          ?.equippedWeapons ?? [];
      await fetchCharacterItems(userCharacter, equippedWeapons);
    })();
  }, [userCharacter, CharacterEquipment, fetchCharacterItems, isSynced]);

  return (
    <CharacterContext.Provider
      value={{
        character: userCharacter,
        equippedItems,
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
