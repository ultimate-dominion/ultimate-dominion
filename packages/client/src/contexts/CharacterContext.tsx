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
  equippedConsumables: Consumable[];
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
  equippedConsumables: [],
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

// Wrapper component that checks if MUD components are ready
export const CharacterProvider = ({
  children,
}: CharacterProviderProps): JSX.Element => {
  const { components, isSynced } = useMUD();

  // Check if the essential components for character lookup are available
  // Only require the minimum components needed to find and display a character
  // Other components (for equipment, encounters, effects) may be empty tables
  const componentsReady = !!(
    components?.Characters &&
    components?.CharactersTokenURI &&
    components?.Stats
  );

  // If components aren't ready, render with default context
  if (!componentsReady) {
    return (
      <CharacterContext.Provider
        value={{
          character: null,
          equippedArmor: [],
          equippedConsumables: [],
          equippedSpells: [],
          equippedWeapons: [],
          inventoryArmor: [],
          inventoryConsumables: [],
          inventorySpells: [],
          inventoryWeapons: [],
          isMoveEquipped: false,
          isRefreshing: true,
          refreshCharacter: async () => {},
        }}
      >
        {children}
      </CharacterContext.Provider>
    );
  }

  return (
    <CharacterProviderInner components={components} isSynced={isSynced}>
      {children}
    </CharacterProviderInner>
  );
};

// Inner component that uses the hooks - only rendered when components are ready
const CharacterProviderInner = ({
  children,
  components,
  isSynced,
}: {
  children: ReactNode;
  components: any;
  isSynced: boolean;
}): JSX.Element => {
  console.log('[CharacterProviderInner] Mounted with isSynced:', isSynced);

  const {
    AdventureEscrow,
    CharacterEquipmentnt,
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
  } = components;
  const {
    delegatorAddress,
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
  const [equippedConsumables, setEquippedConsumables] = useState<Consumable[]>([]);
  const [equippedSpells, setEquippedSpells] = useState<Spell[]>([]);
  const [equippedWeapons, setEquippedWeapons] = useState<Weapon[]>([]);

  const fetchCharacterData = useCallback(async (): Promise<boolean> => {
    if (!(delegatorAddress && publicClient && worldContract)) return false;

    // Find character by owner - try exact match first, then lowercase match
    // MUD may store addresses in different cases depending on how they were set
    let characterEntities = Array.from(
      runQuery([
        HasValue(Characters, {
          owner: delegatorAddress as `0x${string}`,
        }),
      ]),
    );

    // If no match, try lowercase (some contracts store addresses in lowercase)
    if (characterEntities.length === 0) {
      characterEntities = Array.from(
        runQuery([
          HasValue(Characters, {
            owner: delegatorAddress.toLowerCase() as `0x${string}`,
          }),
        ]),
      );
    }

    // If still no match, manually find by comparing lowercase addresses
    if (characterEntities.length === 0) {
      const allChars = Array.from(runQuery([Has(Characters)]));
      characterEntities = allChars.filter(entity => {
        const data = getComponentValue(Characters, entity);
        return data?.owner?.toLowerCase() === delegatorAddress.toLowerCase();
      });
      // Found via manual lowercase comparison
    }

    const partialCharacter: CharacterData & EntityStats = characterEntities.map(entity => {
      const characterData = getComponentValueStrict(Characters, entity);
      const characterStats = getComponentValue(Stats, entity);
      const { tokenId } = characterData;

      const ownerEntity = encodeEntity(
        { address: 'address' },
        { address: characterData.owner as `0x${string}` },
      );
      // These components may be undefined if tables are empty
      const externalGoldBalance = GoldBalances
        ? (getComponentValue(GoldBalances, ownerEntity)?.value ?? BigInt(0))
        : BigInt(0);
      const escrowGoldBalance = AdventureEscrow
        ? (getComponentValue(AdventureEscrow, entity)?.balance ?? BigInt(0))
        : BigInt(0);

      const { encounterId, pvpTimer } = EncounterEntity
        ? (getComponentValue(EncounterEntity, entity) ?? { encounterId: zeroHash, pvpTimer: BigInt(0) })
        : { encounterId: zeroHash, pvpTimer: BigInt(0) };
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

      // WorldStatusEffects and related components may be undefined
      const worldStatusEffectsComponent = WorldStatusEffects
        ? getComponentValue(WorldStatusEffects, entity)
        : undefined;

      const { appliedStatusEffects } = worldStatusEffectsComponent ?? {
        appliedStatusEffects: [],
      };

      const decodedStatusEffects = appliedStatusEffects.map(
        decodeAppliedStatusEffectId,
      );

      // Only process status effects if the required components exist
      const worldStatusEffects: WorldStatusEffect[] = (StatusEffectStats && StatusEffectValidity)
        ? decodedStatusEffects.map(effect => {
            const paddedEffectId = effect.effectId.padEnd(66, '0') as Entity;

            const effectStats = getComponentValue(StatusEffectStats, paddedEffectId);
            const validity = getComponentValue(StatusEffectValidity, paddedEffectId);

            if (!effectStats || !validity) {
              return null;
            }

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
          }).filter((effect): effect is WorldStatusEffect => effect !== null)
        : [];

      // WorldEncounter may be undefined if table is empty
      const worldEncounter = WorldEncounter
        ? Array.from(
            runQuery([
              Has(WorldEncounter),
              HasValue(WorldEncounter, { character: entity, end: BigInt(0) }),
            ]),
          ).map(worldEncounterEntity => ({
            encounterId: worldEncounterEntity,
            ...getComponentValueStrict(WorldEncounter, worldEncounterEntity),
          }))[0]
        : undefined;

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

    if (!partialCharacter) {
      return false;
    }
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
    return true;
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
      // Retry fetching character data - MUD sync can take time after a transaction
      let retries = 0;
      const maxRetries = 15;
      const baseDelay = 500;

      while (retries < maxRetries) {
        const found = await fetchCharacterData();

        if (found) {
          break;
        }

        retries++;
        await new Promise(resolve => setTimeout(resolve, baseDelay));
      }

      // Small additional delay then refresh items
      await new Promise(resolve => setTimeout(resolve, 200));
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
      _equippedConsumableIds: bigint[],
    ) => {
      try {
        // If ItemsOwners component doesn't exist, skip item fetching
        if (!ItemsOwners) {
          return;
        }

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
        const _equippedConsumablesList = _equippedConsumableIds
          .map(id => _consumables.find(c => c.tokenId === id.toString()))
          .filter(Boolean) as Consumable[];
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
        setEquippedConsumables(_equippedConsumablesList);
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

    // CharacterEquipment may be undefined if the table is empty
    const equipmentData = CharacterEquipment
      ? getComponentValue(CharacterEquipment, userCharacter.id)
      : undefined;

    const { equippedArmor, equippedConsumables: eqConsumables, equippedSpells, equippedWeapons } =
      equipmentData ??
      ({ equippedArmor: [], equippedConsumables: [], equippedSpells: [], equippedWeapons: [] } as {
        equippedArmor: bigint[];
        equippedConsumables: bigint[];
        equippedSpells: bigint[];
        equippedWeapons: bigint[];
      });

    fetchCharacterItems(
      userCharacter,
      equippedArmor,
      equippedSpells,
      equippedWeapons,
      eqConsumables,
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
        equippedConsumables,
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
