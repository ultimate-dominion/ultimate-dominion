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
import { formatEther, hexToString, zeroHash } from 'viem';

import { useToast } from '../hooks/useToast';
import { fetchMetadataFromUri, uriToHttp } from '../utils/helpers';
import type {
  Armor,
  Character,
  CharacterData,
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
  isRefreshing: boolean;
  refreshCharacter: () => Promise<void>;
};

const CharacterContext = createContext<CharacterContextType>({
  character: null,
  equippedArmor: [],
  equippedSpells: [],
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
    isLoading: isLoadingItemTemplates,
    spellTemplates,
    weaponTemplates,
  } = useItems();

  const [userCharacter, setUserCharacter] = useState<Character | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(true);
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
      const goldBalance =
        getComponentValue(GoldBalances, ownerEntity)?.value ?? BigInt(0);

      const encounterId = getComponentValue(
        EncounterEntity,
        entity,
      )?.encounterId;
      const inBattle = !!encounterId && encounterId !== zeroHash;

      return {
        agility: characterStats?.agility.toString() ?? '0',
        maxHp: characterStats?.maxHp.toString() ?? '0',
        currentHp: characterStats?.currentHp.toString() ?? '0',
        entityClass: characterStats?.class ?? 0,
        experience: characterStats?.experience.toString() ?? '0',
        goldBalance: formatEther(goldBalance).toString(),
        id: entity,
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
      _equippedArmor: bigint[],
      _equippedSpells: bigint[],
      _equippedWeapons: bigint[],
    ) => {
      try {
        if (_equippedArmor.length === 0) {
          setEquippedArmor([]);
        }

        if (_equippedSpells.length === 0) {
          setEquippedSpells([]);
        }

        if (_equippedWeapons.length === 0) {
          setEquippedWeapons([]);
        }

        if (
          _equippedArmor.length +
            _equippedSpells.length +
            _equippedWeapons.length ===
          0
        ) {
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

          const armorDetails = armorTemplates.find(
            item => item.tokenId === tokenId.toString(),
          );

          return {
            ...armorDetails,
            balance: itemOwner.balance.toString(),
            itemId: tokenOwnersEntity,
            owner: _character.owner,
          } as Armor;
        });

        const _spells = _equippedSpells
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

            const spellDetails = spellTemplates.find(
              item => item.tokenId === tokenId.toString(),
            );

            return {
              ...spellDetails,
              balance: itemOwner.balance.toString(),
              itemId: tokenOwnersEntity,
              owner: _character.owner,
              tokenId: tokenId.toString(),
            } as Spell;
          })
          .filter(item => item.owner === _character.owner)
          .sort((a, b) => {
            return Number(a.tokenId) - Number(b.tokenId);
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

            const weaponDetails = weaponTemplates.find(
              item => item.tokenId === tokenId.toString(),
            );

            return {
              ...weaponDetails,
              balance: itemOwner.balance.toString(),
              itemId: tokenOwnersEntity,
              owner: _character.owner,
              tokenId: tokenId.toString(),
            } as Weapon;
          })
          .filter(item => item.owner === _character.owner)
          .sort((a, b) => {
            return Number(a.tokenId) - Number(b.tokenId);
          });

        setEquippedArmor(_armor);
        setEquippedSpells(_spells);
        setEquippedWeapons(_weapons);
      } catch (e) {
        renderError(
          (e as Error)?.message ?? 'Failed to fetch character data.',
          e,
        );
      }
    },
    [armorTemplates, ItemsOwners, renderError, spellTemplates, weaponTemplates],
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

  return (
    <CharacterContext.Provider
      value={{
        character: userCharacter,
        equippedArmor,
        equippedSpells,
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
