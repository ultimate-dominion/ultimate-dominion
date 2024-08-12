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
import { formatEther, hexToString, zeroHash } from 'viem';

import { useToast } from '../hooks/useToast';
import {
  decodeArmorStats,
  decodeWeaponStats,
  fetchMetadataFromUri,
  uriToHttp,
} from '../utils/helpers';
import type {
  Armor,
  Character,
  CharacterData,
  EntityStats,
  Weapon,
} from '../utils/types';
import { useMUD } from './MUDContext';

type CharacterContextType = {
  character: Character | null;
  equippedArmor: Armor[];
  equippedWeapons: Weapon[];
  isRefreshing: boolean;
  refreshCharacter: () => Promise<void>;
};

const CharacterContext = createContext<CharacterContextType>({
  character: null,
  equippedArmor: [],
  equippedWeapons: [],
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
      EncounterEntity,
      Items,
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
  const [equippedArmor, setEquippedArmor] = useState<Armor[]>([]);
  const [equippedWeapons, setEquippedWeapons] = useState<Weapon[]>([]);

  const fetchCharacterData = useCallback(async () => {
    if (!(delegatorAddress && publicClient && worldContract)) return;
    const partialCharacter: CharacterData & EntityStats = Array.from(
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

      const encounterId = getComponentValue(
        EncounterEntity,
        entity,
      )?.encounterId;
      const inBattle = !!encounterId && encounterId !== zeroHash;

      return {
        agility: characterStats?.agility.toString() ?? '0',
        baseHp: characterStats?.baseHp.toString() ?? '0',
        currentHp: characterStats?.currentHp.toString() ?? '0',
        characterId: entity,
        entityClass: characterStats?.class ?? 0,
        experience: characterStats?.experience.toString() ?? '0',
        goldBalance: formatEther(goldBalance).toString(),
        inBattle,
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
    EncounterEntity,
    GoldBalances,
    publicClient,
    Stats,
    worldContract,
  ]);

  const refreshCharacter = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchCharacterData();
    } catch (e) {
      renderError((e as Error)?.message ?? 'Error refreshing character.', e);
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
    async (
      _character: Character,
      _equippedArmor: bigint[],
      _equippedWeapons: bigint[],
    ) => {
      try {
        if (_equippedArmor.length === 0) {
          setEquippedArmor([]);
        }
        if (_equippedWeapons.length === 0) {
          setEquippedWeapons([]);
        }

        if (_equippedArmor.length + _equippedWeapons.length === 0) {
          return;
        }

        const _armor = _equippedArmor.map(tokenId => {
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
        });

        const _weapons = _equippedWeapons
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

        const fullArmor = await Promise.all(
          _armor.map(async item => {
            const tokenIdEntity = encodeEntity(
              { tokenId: 'uint256' },
              { tokenId: BigInt(item.tokenId) },
            );

            const itemTemplate = getComponentValueStrict(Items, tokenIdEntity);
            const decodedArmorStats = decodeArmorStats(itemTemplate.stats);

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
              agiModifier: decodedArmorStats.agiModifier,
              armorModifier: decodedArmorStats.armorModifier,
              balance: item.balance,
              classRestrictions: decodedArmorStats.classRestrictions,
              hitPointModifier: decodedArmorStats.hitPointModifier,
              intModifier: decodedArmorStats.intModifier,
              itemId: item.itemId,
              minLevel: decodedArmorStats.minLevel,
              owner: item.owner,
              strModifier: decodedArmorStats.strModifier,
              tokenId: item.tokenId,
            } as Armor;
          }),
        );

        const fullWeapons = await Promise.all(
          _weapons.map(async item => {
            const tokenIdEntity = encodeEntity(
              { tokenId: 'uint256' },
              { tokenId: BigInt(item.tokenId) },
            );

            const itemTemplate = getComponentValueStrict(Items, tokenIdEntity);
            const decodedWeaponStats = decodeWeaponStats(itemTemplate.stats);

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
              agiModifier: decodedWeaponStats.agiModifier,
              balance: item.balance,
              classRestrictions: decodedWeaponStats.classRestrictions,
              hitPointModifier: decodedWeaponStats.hitPointModifier,
              intModifier: decodedWeaponStats.intModifier,
              itemId: item.itemId,
              maxDamage: decodedWeaponStats.maxDamage,
              minDamage: decodedWeaponStats.minDamage,
              minLevel: decodedWeaponStats.minLevel,
              owner: item.owner,
              strModifier: decodedWeaponStats.strModifier,
              tokenId: item.tokenId,
            } as Weapon;
          }),
        );

        setEquippedArmor(fullArmor);
        setEquippedWeapons(fullWeapons);
      } catch (e) {
        renderError(
          (e as Error)?.message ?? 'Failed to fetch character data.',
          e,
        );
      }
    },
    [Items, ItemsBaseURI, ItemsOwners, ItemsTokenURI, renderError],
  );

  useEffect(() => {
    if (!isSynced) return;
    (async (): Promise<void> => {
      if (!userCharacter) return;

      const { equippedArmor, equippedWeapons } =
        getComponentValue(CharacterEquipment, userCharacter.characterId) ??
        ({ equippedArmor: [], equippedWeapons: [] } as {
          equippedArmor: bigint[];
          equippedWeapons: bigint[];
        });
      await fetchCharacterItems(userCharacter, equippedArmor, equippedWeapons);
    })();
  }, [userCharacter, CharacterEquipment, fetchCharacterItems, isSynced]);

  return (
    <CharacterContext.Provider
      value={{
        character: userCharacter,
        equippedArmor,
        equippedWeapons,
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
