import {
  Entity,
  getComponentValue,
  getComponentValueStrict,
  Has,
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
import { STATUS_EFFECT_NAME_MAPPING } from '../utils/constants';
import {
  decodeAppliedStatusEffectId,
  decodeBaseStats,
  fetchMetadataFromUri,
  isTextOnlyUri,
  uriToHttp,
} from '../utils/helpers';
import {
  AdvancedClass,
  ArmorType,
  PowerSource,
  Race,
} from '../utils/types';
import type {
  Armor,
  Character,
  CharacterData,
  Consumable,
  EntityStats,
  Spell,
  Weapon,
  WorldStatusEffect,
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
      StatusEffectStats,
      StatusEffectValidity,
      WorldEncounter,
      WorldStatusEffects,
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
  const [itemsRefreshCounter, setItemsRefreshCounter] = useState(0);
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

      const { encounterId, pvpTimer } = getComponentValue(
        EncounterEntity,
        entity,
      ) ?? { encounterId: zeroHash, pvpTimer: BigInt(0) };
      const inBattle = !!encounterId && encounterId !== zeroHash;

      let decodedBaseStats = {
        agility: BigInt(0),
        currentHp: BigInt(0),
        entityClass: 0,
        experience: BigInt(0),
        intelligence: BigInt(0),
        level: BigInt(0),
        maxHp: BigInt(0),
        strength: BigInt(0),
      };

      if (characterData.baseStats !== '0x') {
        decodedBaseStats = decodeBaseStats(characterData.baseStats);
      }

      const worldStatusEffectsComponent = getComponentValue(
        WorldStatusEffects,
        entity,
      );

      const { appliedStatusEffects } = worldStatusEffectsComponent ?? {
        appliedStatusEffects: [],
      };

      const decodedStatusEffects = appliedStatusEffects.map(
        decodeAppliedStatusEffectId,
      );

      const worldStatusEffects: WorldStatusEffect[] = decodedStatusEffects.map(
        effect => {
          const paddedEffectId = effect.effectId.padEnd(66, '0') as Entity;

          const effectStats = getComponentValueStrict(
            StatusEffectStats,
            paddedEffectId,
          );

          const validity = getComponentValueStrict(
            StatusEffectValidity,
            paddedEffectId,
          );

          const timestampEnd = effect.timestamp + validity.validTime;
          const isActive = timestampEnd > BigInt(Date.now()) / BigInt(1000);

          const name = STATUS_EFFECT_NAME_MAPPING[paddedEffectId] ?? 'unknown';

          return {
            active: isActive,
            agiModifier: effectStats.agiModifier,
            effectId: paddedEffectId,
            intModifier: effectStats.intModifier,
            maxStacks: validity.maxStacks,
            name,
            strModifier: effectStats.strModifier,
            timestampEnd,
            timestampStart: effect.timestamp,
          };
        },
      );

      const worldEncounter = Array.from(
        runQuery([
          Has(WorldEncounter),
          HasValue(WorldEncounter, { character: entity, end: BigInt(0) }),
        ]),
      ).map(worldEncounterEntity => ({
        encounterId: worldEncounterEntity,
        ...getComponentValueStrict(WorldEncounter, worldEncounterEntity),
      }))[0];

      return {
        agility: characterStats?.agility ?? BigInt(0),
        baseStats: decodedBaseStats,
        currentHp: characterStats?.currentHp ?? BigInt(0),
        entityClass: characterStats?.class ?? 0,
        escrowGoldBalance,
        experience: characterStats?.experience ?? BigInt(0),
        externalGoldBalance,
        id: entity,
        inBattle,
        intelligence: characterStats?.intelligence ?? BigInt(0),
        level: characterStats?.level ?? BigInt(0),
        locked: characterData.locked,
        maxHp: characterStats?.maxHp ?? BigInt(0),
        name: hexToString(characterData.name as `0x${string}`, { size: 32 }),
        owner: characterData.owner,
        pvpCooldownTimer: pvpTimer,
        strength: characterStats?.strength ?? BigInt(0),
        tokenId: tokenId.toString(),
        worldEncounter: worldEncounter
          ? {
              characterId: worldEncounter.character as Entity,
              encounterId: worldEncounter.encounterId as Entity,
              shopId: worldEncounter.entity as Entity,
            }
          : undefined,
        worldStatusEffects,
        // Implicit class system fields
        race: (characterStats?.race as Race) ?? Race.None,
        powerSource: (characterStats?.powerSource as PowerSource) ?? PowerSource.None,
        startingArmor: (characterStats?.startingArmor as ArmorType) ?? ArmorType.None,
        advancedClass: (characterStats?.advancedClass as AdvancedClass) ?? AdvancedClass.None,
        hasSelectedAdvancedClass: characterStats?.hasSelectedAdvancedClass ?? false,
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

    // Try to fetch metadata, but use defaults if it fails (e.g., test URIs)
    let fetchedMetadata = {
      name: '',
      description: '',
      image: '',
    };

    try {
      // Handle text-only URIs directly (no HTTP fetch needed)
      if (metadataURI && isTextOnlyUri(metadataURI)) {
        fetchedMetadata = await fetchMetadataFromUri(metadataURI);
      } else if (metadataURI && !metadataURI.startsWith('test') && metadataURI.length > 10) {
        // Handle IPFS/HTTP URIs
        const urls = metadataURI.startsWith('ipfs://')
          ? uriToHttp(metadataURI)
          : uriToHttp(`ipfs://${metadataURI}`);
        fetchedMetadata = await fetchMetadataFromUri(urls[0]);
      }
    } catch (error) {
      console.warn('Failed to fetch character metadata, using defaults:', error);
    }

    // Only override partialCharacter fields if fetchedMetadata has non-empty values
    setUserCharacter({
      ...partialCharacter,
      // Keep decoded bytes32 name if fetched name is empty
      name: fetchedMetadata.name || partialCharacter.name,
      description: fetchedMetadata.description || '',
      image: fetchedMetadata.image || '',
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
    StatusEffectStats,
    StatusEffectValidity,
    worldContract,
    WorldEncounter,
    WorldStatusEffects,
  ]);

  const refreshCharacter = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchCharacterData();
      // Small delay to ensure RECS sync has propagated, then force items refresh
      await new Promise(resolve => setTimeout(resolve, 500));
      setItemsRefreshCounter(c => c + 1);
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
              balance: itemOwner ? itemOwner.balance : BigInt(0),
              itemId: tokenOwnersEntity,
              owner: _character.owner,
            } as Armor;
          })
          .filter(a => a.balance !== BigInt(0));

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
              balance: itemOwner ? itemOwner.balance : BigInt(0),
              itemId: tokenOwnersEntity,
              owner: _character.owner,
            } as Consumable;
          })
          .filter(c => c.balance !== BigInt(0));

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
              balance: itemOwner ? itemOwner.balance : BigInt(0),
              itemId: tokenOwnersEntity,
              owner: _character.owner,
            } as Spell;
          })
          .filter(s => s.balance !== BigInt(0));

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
              balance: itemOwner ? itemOwner.balance : BigInt(0),
              itemId: tokenOwnersEntity,
              owner: _character.owner,
            } as Weapon;
          })
          .filter(w => w.balance !== BigInt(0));

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

    const equipmentData = getComponentValue(CharacterEquipment, userCharacter.id);

    const { equippedArmor, equippedSpells, equippedWeapons } =
      equipmentData ??
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
    itemsRefreshCounter,
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
