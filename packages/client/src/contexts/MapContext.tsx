import { useComponentValue, useEntityQuery } from '@latticexyz/react';
import {
  Entity,
  getComponentValue,
  getComponentValueStrict,
  Has,
  Not,
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
import { formatEther, hexToString, zeroHash } from 'viem';

import { useToast } from '../hooks/useToast';
import {
  decodeBaseStats,
  decodeMobInstanceId,
  fetchMetadataFromUri,
  uriToHttp,
} from '../utils/helpers';
import { type Character, type Monster, Shop, ShopItem } from '../utils/types';
import { useCharacter } from './CharacterContext';
import { useMonsters } from './MonstersContext';
import { useMUD } from './MUDContext';

type MapContextType = {
  allCharacters: Character[];
  allMonsters: Monster[];
  allShops: Shop[];
  allShopItems: ShopItem[];
  inSafetyZone: boolean;
  isFetchingEntities: boolean;
  isSpawned: boolean;
  isSpawning: boolean;
  monstersOnTile: Monster[];
  onSpawn: () => void;
  otherCharactersOnTile: Character[];
  position: { x: number; y: number } | null;
  shopsOnTile: Shop[];
};

const MapContext = createContext<MapContextType>({
  allCharacters: [],
  allMonsters: [],
  allShops: [],
  allShopItems: [],
  inSafetyZone: false,
  isFetchingEntities: false,
  isSpawned: false,
  isSpawning: false,
  monstersOnTile: [],
  onSpawn: () => {},
  otherCharactersOnTile: [],
  position: null,
  shopsOnTile: [],
});

export type MapProviderProps = {
  children: ReactNode;
};

export const MapProvider = ({ children }: MapProviderProps): JSX.Element => {
  const { renderError, renderSuccess } = useToast();
  const {
    components: {
      Characters,
      CharactersTokenURI,
      EncounterEntity,
      GoldBalances,
      Position,
      Shops,
      ShopItems,
      Spawned,
      Stats,
    },
    delegatorAddress,
    isSynced,
    network: { publicClient, worldContract },
    systemCalls: { spawn },
  } = useMUD();
  const { monsterTemplates } = useMonsters();
  const { character, refreshCharacter } = useCharacter();

  const [isSpawning, setIsSpawning] = useState(false);
  const [isFetchingEntities, setIsFetchingEntities] = useState(true);

  const [allCharacters, setAllCharacters] = useState<Character[]>([]);
  const [otherCharactersOnTile, setOtherCharactersOnTile] = useState<
    Character[]
  >([]);
  const [allMonsters, setAllMonsters] = useState<Monster[]>([]);
  const [monstersOnTile, setMonstersOnTile] = useState<Monster[]>([]);

  const [allShops, setAllShops] = useState<Shop[]>([]);
  const [allShopItems, setAllShopItems] = useState<ShopItem[]>([]);

  const [shopsOnTile, setShopsOnTile] = useState<Shop[]>([]);
  const position = useComponentValue(
    Position,
    encodeEntity(
      { characterId: 'uint256' },
      { characterId: BigInt(character?.id ?? 0) },
    ),
  );

  const inSafetyZone = useMemo(() => {
    if (!position) return false;
    return position.x < 5 && position.y < 5;
  }, [position]);

  const isSpawned = !!useComponentValue(
    Spawned,
    encodeEntity(
      { characterId: 'uint256' },
      { characterId: BigInt(character?.id ?? 0) },
    ),
  )?.spawned;

  const allShopEntities = useEntityQuery([
    Has(Position),
    Has(Spawned),
    Has(Shops),
  ]);

  const allShopItemEntities = useEntityQuery([Has(ShopItems)]);
  const allMonsterEntities = useEntityQuery([
    Has(Spawned),
    Has(Stats),
    Not(Characters),
    Has(Position),
  ]);

  const allCharacterEntities = useEntityQuery([
    Has(Characters),
    Has(Spawned),
    Has(Stats),
    Has(Position),
  ]);

  const getAllCharacters = useCallback(
    async (
      entities: Entity[],
    ): Promise<
      (Character & { isSpawned: boolean; position: { x: number; y: number } })[]
    > => {
      if (!(delegatorAddress && publicClient && worldContract)) return [];

      try {
        const characters: (Character & {
          isSpawned: boolean;
          position: { x: number; y: number };
        })[] = await Promise.all(
          entities.map(async (entity: Entity) => {
            const characterData = getComponentValueStrict(Characters, entity);
            const characterStats = getComponentValueStrict(Stats, entity);
            const { tokenId } = characterData;

            const ownerEntity = encodeEntity(
              { address: 'address' },
              { address: characterData.owner as `0x${string}` },
            );
            const tokenIdEntity = encodeEntity(
              { tokenId: 'uint256' },
              { tokenId: BigInt(tokenId) },
            );

            const goldBalance =
              getComponentValueStrict(GoldBalances, ownerEntity)?.value ??
              BigInt(0);
            const metadataURI = getComponentValueStrict(
              CharactersTokenURI,
              tokenIdEntity,
            ).tokenURI;

            const fetachedMetadata = await fetchMetadataFromUri(
              uriToHttp(`ipfs://${metadataURI}`)[0],
            );

            const encounterId = getComponentValue(
              EncounterEntity,
              entity,
            )?.encounterId;
            const inBattle = !!encounterId && encounterId !== zeroHash;

            const isSpawned = getComponentValueStrict(Spawned, entity).spawned;
            const _position = getComponentValueStrict(Position, entity);

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
              ...fetachedMetadata,
              agility: characterStats.agility.toString(),
              baseStats: decodedBaseStats,
              currentHp: characterStats.currentHp.toString(),
              entityClass: characterStats.class,
              experience: characterStats.experience.toString(),
              goldBalance: goldBalance,
              id: entity,
              inBattle,
              intelligence: characterStats.intelligence.toString(),
              isSpawned,
              level: characterStats.level.toString(),
              locked: characterData.locked,
              maxHp: characterStats.maxHp.toString(),
              name: hexToString(characterData.name as `0x${string}`, {
                size: 32,
              }),
              owner: characterData.owner,
              position: { x: _position.x, y: _position.y },
              strength: characterStats.strength.toString(),
              tokenId: tokenId.toString(),
            } as Character & {
              isSpawned: boolean;
              position: { x: number; y: number };
            };
          }),
        );

        return characters;
      } catch (e) {
        renderError(
          (e as Error)?.message ?? 'Failed to fetch other players.',
          e,
        );
        return [];
      }
    },
    [
      Characters,
      CharactersTokenURI,
      delegatorAddress,
      EncounterEntity,
      GoldBalances,
      Position,
      publicClient,
      renderError,
      Spawned,
      Stats,
      worldContract,
    ],
  );

  const getMonsters = useCallback(
    (entities: Entity[]): Monster[] => {
      try {
        const _monsters: Monster[] = entities.map(entity => {
          const { mobId } = decodeMobInstanceId(entity as `0x${string}`);
          const encounterId = getComponentValue(
            EncounterEntity,
            entity,
          )?.encounterId;

          const currentHp = getComponentValueStrict(
            Stats,
            entity,
          ).currentHp.toString();
          const inBattle = !!encounterId && encounterId !== zeroHash;
          const isSpawned = getComponentValueStrict(Spawned, entity).spawned;
          const _position = getComponentValueStrict(Position, entity);

          const monsterTemplate = monsterTemplates.find(
            m => m.mobId === mobId.toString(),
          );

          return {
            ...monsterTemplate,
            maxHp: monsterTemplate?.hitPoints.toString() ?? '0',
            currentHp,
            id: entity,
            inBattle,
            isSpawned,
            position: { x: _position.x, y: _position.y },
          } as Monster;
        });

        return _monsters;
      } catch (e) {
        renderError((e as Error)?.message ?? 'Failed to fetch monsters.', e);
        return [];
      }
    },
    [EncounterEntity, monsterTemplates, Position, renderError, Spawned, Stats],
  );
  const getShopItems = useCallback(
    (entities: Entity[]): ShopItem[] => {
      try {
        const _shops: ShopItem[] = entities.map(entity => {
          const itemId = parseInt(entity);
          const shopItem = getComponentValueStrict(ShopItems, entity);
          return {
            itemId: itemId.toString(),
            price: shopItem.price,
          } as ShopItem;
        });

        return _shops;
      } catch (e) {
        renderError((e as Error)?.message ?? 'Failed to fetch shops.', e);
        return [];
      }
    },
    [ShopItems, renderError],
  );

  const getShops = useCallback(
    (entities: Entity[]): Shop[] => {
      try {
        const _shops: Shop[] = entities.map(entity => {
          const _position = getComponentValueStrict(Position, entity);
          const shopData = getComponentValueStrict(Shops, entity);

          return {
            shopId: entity,
            position: { x: _position.x, y: _position.y },
            priceMarkup: shopData.priceMarkup,
            priceMarkdown: shopData.priceMarkdown,
            sellableItems: shopData.sellableItems.map(item => item.toString()),
            buyableItems: shopData.buyableItems.map(item => item.toString()),
            stock: shopData.stock.map(item => item.toString()),
            restock: shopData.stock.map(item => item.toString()),
            gold: shopData.gold,
            maxGold: shopData.maxGold,
          } as Shop;
        });

        return _shops;
      } catch (e) {
        renderError((e as Error)?.message ?? 'Failed to fetch shops.', e);
        return [];
      }
    },
    [Position, Shops, renderError],
  );

  useEffect(() => {
    (async () => {
      if (!(allCharacterEntities && allMonsterEntities && isSynced)) return;

      const _allCharacters = await getAllCharacters(allCharacterEntities);
      setAllCharacters(_allCharacters as Character[]);

      const _monsters = getMonsters(allMonsterEntities);
      const _shops = getShops(allShopEntities);
      const _shopItems = getShopItems(allShopItemEntities);

      setAllMonsters(_monsters);
      setAllShops(_shops);
      setAllShopItems(_shopItems);
    })();
  }, [
    allCharacterEntities,
    allMonsterEntities,
    allShopEntities,
    allShopItemEntities,
    getAllCharacters,
    getMonsters,
    getShopItems,
    getShops,
    isSynced,
  ]);

  useEffect(() => {
    (async (): Promise<void> => {
      if (!position || (position.x === 0 && position.y === 0)) {
        setOtherCharactersOnTile([]);
        setMonstersOnTile([]);
        setShopsOnTile([]);
      }

      if (allMonsters.length > 0 && position) {
        setMonstersOnTile(
          (
            allMonsters as (Monster & {
              isSpawned: boolean;
              position: { x: number; y: number };
            })[]
          ).filter(
            m =>
              Number(m.currentHp) > 0 &&
              m.position.x === position.x &&
              m.position.y === position.y,
          ),
        );
      }
      if (allShops.length > 0 && position) {
        setShopsOnTile(
          (
            allShops as (Shop & {
              isSpawned: boolean;
              position: { x: number; y: number };
            })[]
          ).filter(
            m => m.position.x === position.x && m.position.y === position.y,
          ),
        );
      }

      if (allCharacters.length > 0 && position) {
        const _otherPlayersOnTile = (
          allCharacters as (Character & {
            isSpawned: boolean;
            position: { x: number; y: number };
          })[]
        ).filter(
          (
            c: Character & {
              isSpawned: boolean;
              position: { x: number; y: number };
            },
          ) =>
            c.position.x === position.x &&
            c.position.y === position.y &&
            c.owner !== delegatorAddress &&
            c.isSpawned,
        );
        setOtherCharactersOnTile(_otherPlayersOnTile as Character[]);
      }

      setIsFetchingEntities(false);
    })();
  }, [
    allCharacters,
    allMonsters,
    allShops,
    character,
    delegatorAddress,
    position,
  ]);

  const onSpawn = useCallback(async () => {
    try {
      setIsSpawning(true);

      if (!delegatorAddress) {
        throw new Error('Missing delegation.');
      }

      if (!character) {
        throw new Error('Character not found.');
      }

      const { error, success } = await spawn(character.id);

      if (error && !success) {
        throw new Error(error);
      }

      renderSuccess('Spawned!');
      await refreshCharacter();
    } catch (e) {
      renderError((e as Error)?.message ?? 'Failed to spawn.', e);
    } finally {
      setIsSpawning(false);
    }
  }, [
    character,
    delegatorAddress,
    refreshCharacter,
    renderError,
    renderSuccess,
    spawn,
  ]);

  return (
    <MapContext.Provider
      value={{
        allCharacters,
        allMonsters,
        allShops,
        allShopItems,
        inSafetyZone,
        isFetchingEntities,
        isSpawned,
        isSpawning,
        monstersOnTile,
        onSpawn,
        otherCharactersOnTile,
        position: position ? { x: position.x, y: position.y } : null,
        shopsOnTile,
      }}
    >
      {children}
    </MapContext.Provider>
  );
};

export const useMap = (): MapContextType => useContext(MapContext);
