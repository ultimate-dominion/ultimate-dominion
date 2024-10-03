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
  useMemo,
  useState,
} from 'react';
import { hexToString, zeroHash } from 'viem';

import { useToast } from '../hooks/useToast';
import {
  decodeBaseStats,
  fetchMetadataFromUri,
  uriToHttp,
} from '../utils/helpers';
import type {
  Armor,
  Character,
  CharacterData,
  Consumable,
  EntityStats,
  Spell,
  Weapon,
} from '../utils/types';
import { useItems } from './ItemsContext';
import { useMUD } from './MUDContext';

type CharacterContextType = {
  character: Character | null;
  equippedArmor: Armor[];
  equippedSpells: Spell[];
  equippedWeapons: Weapon[];
  inventoryArmor: Armor[];
  inventoryConsumables: Consumable[];
  inventorySpells: Spell[];
  inventoryWeapons: Weapon[];
  isMoveEquipped: boolean;
  isRefreshing: boolean;
  refreshCharacter: () => Promise<void>;
};

const CharacterContext = createContext<CharacterContextType>({
  character: null,
  equippedArmor: [],
  equippedSpells: [],
  equippedWeapons: [],
  inventoryArmor: [],
  inventoryConsumables: [],
  inventorySpells: [],
  inventoryWeapons: [],
  isMoveEquipped: false,
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
      AdventureEscrow,
      CharacterEquipment,
      Characters,
      CharactersTokenURI,
      EncounterEntity,
      GoldBalances,
      ItemsOwners,
      Stats,
    },
    delegatorAddress,
    isSynced,
    network: { publicClient, worldContract },
  } = useMUD();
  const { renderError } = useToast();
  const {
    armorTemplates,
    consumableTemplates,
    isLoading: isLoadingItemTemplates,
    spellTemplates,
    weaponTemplates,
  } = useItems();

  const [userCharacter, setUserCharacter] = useState<Character | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [inventoryArmor, setInventoryArmor] = useState<Armor[]>([]);
  const [inventoryConsumables, setInventoryConsumables] = useState<
    Consumable[]
  >([]);
  const [inventorySpells, setInventorySpells] = useState<Spell[]>([]);
  const [inventoryWeapons, setInventoryWeapons] = useState<Weapon[]>([]);
  const [equippedArmor, setEquippedArmor] = useState<Armor[]>([]);
  const [equippedSpells, setEquippedSpells] = useState<Spell[]>([]);
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
      const externalGoldBalance =
        getComponentValue(GoldBalances, ownerEntity)?.value ?? BigInt(0);
      const escrowGoldBalance =
        getComponentValue(AdventureEscrow, entity)?.balance ?? BigInt(0);

      const encounterId = getComponentValue(
        EncounterEntity,
        entity,
      )?.encounterId;
      const inBattle = !!encounterId && encounterId !== zeroHash;

      let decodedBaseStats = {
        agility: '0',
        currentHp: '0',
        entityClass: 0,
        experience: '0',
        intelligence: '0',
        level: '0',
        maxHp: '0',
        strength: '0',
      };

      if (characterData.baseStats !== '0x') {
        decodedBaseStats = decodeBaseStats(characterData.baseStats);
      }

      return {
        agility: characterStats?.agility.toString() ?? '0',
        baseStats: decodedBaseStats,
        currentHp: characterStats?.currentHp.toString() ?? '0',
        entityClass: characterStats?.class ?? 0,
        escrowGoldBalance,
        experience: characterStats?.experience.toString() ?? '0',
        externalGoldBalance,
        id: entity,
        inBattle,
        intelligence: characterStats?.intelligence.toString() ?? '0',
        level: characterStats?.level.toString() ?? '0',
        locked: characterData.locked,
        maxHp: characterStats?.maxHp.toString() ?? '0',
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
    AdventureEscrow,
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
    refreshCharacter();
  }, [
    delegatorAddress,
    refreshCharacter,
    isSynced,
    publicClient,
    worldContract,
  ]);

  const fetchCharacterItems = useCallback(
    (
      _character: Character,
      _equippedArmorIds: bigint[],
      _equippedSpellsIds: bigint[],
      _equippedWeaponsIds: bigint[],
    ) => {
      try {
        const _armor = armorTemplates
          .map(armor => {
            const tokenOwnersEntity = encodeEntity(
              { owner: 'address', tokenId: 'uint256' },
              {
                owner: _character.owner as `0x${string}`,
                tokenId: BigInt(armor.tokenId),
              },
            );

            const itemOwner = getComponentValue(ItemsOwners, tokenOwnersEntity);

            return {
              ...armor,
              balance: itemOwner ? itemOwner.balance.toString() : '0',
              itemId: tokenOwnersEntity,
              owner: _character.owner,
            } as Armor;
          })
          .filter(a => a.balance !== '0');

        const _consumables = consumableTemplates
          .map(consumable => {
            const tokenOwnersEntity = encodeEntity(
              { owner: 'address', tokenId: 'uint256' },
              {
                owner: _character.owner as `0x${string}`,
                tokenId: BigInt(consumable.tokenId),
              },
            );

            const itemOwner = getComponentValue(ItemsOwners, tokenOwnersEntity);

            return {
              ...consumable,
              balance: itemOwner ? itemOwner.balance.toString() : '0',
              itemId: tokenOwnersEntity,
              owner: _character.owner,
            } as Consumable;
          })
          .filter(c => c.balance !== '0');

        const _spells = spellTemplates
          .map(spell => {
            const tokenOwnersEntity = encodeEntity(
              { owner: 'address', tokenId: 'uint256' },
              {
                owner: _character.owner as `0x${string}`,
                tokenId: BigInt(spell.tokenId),
              },
            );

            const itemOwner = getComponentValue(ItemsOwners, tokenOwnersEntity);

            return {
              ...spell,
              balance: itemOwner ? itemOwner.balance.toString() : '0',
              itemId: tokenOwnersEntity,
              owner: _character.owner,
            } as Spell;
          })
          .filter(s => s.balance !== '0');

        const _weapons = weaponTemplates
          .map(weapon => {
            const tokenOwnersEntity = encodeEntity(
              { owner: 'address', tokenId: 'uint256' },
              {
                owner: _character.owner as `0x${string}`,
                tokenId: BigInt(weapon.tokenId),
              },
            );

            const itemOwner = getComponentValue(ItemsOwners, tokenOwnersEntity);

            return {
              ...weapon,
              balance: itemOwner ? itemOwner.balance.toString() : '0',
              itemId: tokenOwnersEntity,
              owner: _character.owner,
            } as Weapon;
          })
          .filter(w => w.balance !== '0');

        const _equippedArmor = _equippedArmorIds
          .map(id => _armor.find(a => a.tokenId === id.toString()))
          .filter(Boolean) as Armor[];
        const _equippedSpells = _equippedSpellsIds
          .map(id => _spells.find(s => s.tokenId === id.toString()))
          .filter(Boolean) as Spell[];
        const _equippedWeapons = _equippedWeaponsIds
          .map(id => _weapons.find(w => w.tokenId === id.toString()))
          .filter(Boolean) as Weapon[];

        setInventoryArmor(_armor);
        setInventoryConsumables(_consumables);
        setInventorySpells(_spells);
        setInventoryWeapons(_weapons);

        setEquippedArmor(_equippedArmor);
        setEquippedSpells(_equippedSpells);
        setEquippedWeapons(_equippedWeapons);
      } catch (e) {
        renderError(
          (e as Error)?.message ?? 'Failed to fetch character data.',
          e,
        );
      }
    },
    [
      armorTemplates,
      consumableTemplates,
      ItemsOwners,
      renderError,
      spellTemplates,
      weaponTemplates,
    ],
  );

  useEffect(() => {
    if (!(isSynced && userCharacter) || isLoadingItemTemplates) return;

    const { equippedArmor, equippedSpells, equippedWeapons } =
      getComponentValue(CharacterEquipment, userCharacter.id) ??
      ({ equippedArmor: [], equippedSpells: [], equippedWeapons: [] } as {
        equippedArmor: bigint[];
        equippedSpells: bigint[];
        equippedWeapons: bigint[];
      });

    fetchCharacterItems(
      userCharacter,
      equippedArmor,
      equippedSpells,
      equippedWeapons,
    );
  }, [
    CharacterEquipment,
    fetchCharacterItems,
    isLoadingItemTemplates,
    isSynced,
    userCharacter,
  ]);

  const isMoveEquipped = useMemo(() => {
    return equippedSpells.length + equippedWeapons.length > 0;
  }, [equippedSpells, equippedWeapons]);

  return (
    <CharacterContext.Provider
      value={{
        character: userCharacter,
        equippedArmor,
        equippedSpells,
        equippedWeapons,
        inventoryArmor,
        inventoryConsumables,
        inventorySpells,
        inventoryWeapons,
        isMoveEquipped,
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
