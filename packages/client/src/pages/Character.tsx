import {
  Avatar,
  Box,
  Button,
  Card,
  CardBody,
  Center,
  Grid,
  GridItem,
  HStack,
  Spinner,
  Text,
  Tooltip,
  useDisclosure,
  VStack,
} from '@chakra-ui/react';
import { useComponentValue } from '@latticexyz/react';
import {
  Entity,
  getComponentValue,
  getComponentValueStrict,
  Has,
  runQuery,
} from '@latticexyz/recs';
import { encodeEntity } from '@latticexyz/store-sync/recs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { FaMedal } from 'react-icons/fa';
import { IoMdInformationCircleOutline } from 'react-icons/io';
import { IoChatbubble } from 'react-icons/io5';
import { useNavigate, useParams } from 'react-router-dom';
import { erc721Abi, hexToBigInt, hexToString, zeroHash } from 'viem';
import { AdvancedClassModal } from '../components/AdvancedClassModal';
import { ClassSymbol } from '../components/ClassSymbol';
import { EditCharacterModal } from '../components/EditCharacterModal';
import { FragmentCollection } from '../components/FragmentCollection';
import { ItemCard } from '../components/ItemCard';
import { ItemConsumeModal } from '../components/ItemConsumeModal';
import { ItemEquipModal } from '../components/ItemEquipModal';
import { Level } from '../components/Level';
import { LevelingPanel } from '../components/LevelingPanel';
import { PolygonalCard } from '../components/PolygonalCard';
import { LeaderboardIconSvg, MarketplaceIconSvg } from '../components/SVGs';
import { useCharacter } from '../contexts/CharacterContext';
import { useChat } from '../contexts/ChatContext';
import { useItems } from '../contexts/ItemsContext';
import { useAuth } from '../contexts/AuthContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { HOME_PATH, LEADERBOARD_PATH, MARKETPLACE_PATH } from '../Routes';
import {
  MAX_EQUIPPED_ARMOR,
  MAX_EQUIPPED_WEAPONS,
  STATUS_EFFECT_NAME_MAPPING,
} from '../utils/constants';
import {
  decodeAppliedStatusEffectId,
  decodeBaseStats,
  decodeCharacterId,
  etherToFixedNumber,
  fetchMetadataFromUri,
  uriToHttp,
} from '../utils/helpers';
import {
  type Armor,
  type Character,
  type Consumable,
  type Spell,
  type Weapon,
  type WorldStatusEffect,
} from '../utils/types';

// Badge contract address - get from environment
const BADGE_CONTRACT_ADDRESS = import.meta.env.VITE_BADGE_CONTRACT_ADDRESS || '';
const ADVENTURER_BADGE_BASE = 1;

export const CharacterPage = (): JSX.Element => {
  const { id } = useParams();
  const { renderError } = useToast();
  const navigate = useNavigate();
  const { isAuthenticated: isConnected, isConnecting } = useAuth();

  const {
    components: {
      AdventureEscrow,
      Characters,
      CharactersTokenURI,
      EncounterEntity,
      GoldBalances,
      Levels,
      Stats,
      StatusEffectStat,
      StatusEffectVali,
      WorldStatusEffec,
    },
    isSynced,
    network: { publicClient, worldContract },
  } = useMUD();
  const { character: userCharacter, refreshCharacter } = useCharacter();
  const { onOpen: onOpenChat } = useChat();

  const {
    isOpen: isEditModalOpen,
    onClose: onCloseEditModal,
    onOpen: onOpenEditModal,
  } = useDisclosure();

  const {
    isOpen: isClassModalOpen,
    onClose: onCloseClassModal,
    onOpen: onOpenClassModal,
  } = useDisclosure();

  const [character, setCharacter] = useState<Character | null>(null);
  const [isLoadingCharacter, setIsLoadingCharacter] = useState(true);
  const [hasBadge, setHasBadge] = useState(false);

  useEffect(() => {
    if (isConnecting) return;

    if (!isConnected) {
      navigate(HOME_PATH);
    }
  }, [isConnected, isConnecting, navigate]);

  // Check if character has Adventurer badge
  useEffect(() => {
    const checkBadge = async () => {
      if (!character || !publicClient || !BADGE_CONTRACT_ADDRESS) {
        setHasBadge(false);
        return;
      }

      try {
        const badgeTokenId =
          BigInt(ADVENTURER_BADGE_BASE) * BigInt(1_000_000) +
          BigInt(character.tokenId);

        const owner = await publicClient.readContract({
          address: BADGE_CONTRACT_ADDRESS as `0x${string}`,
          abi: erc721Abi,
          functionName: 'ownerOf',
          args: [badgeTokenId],
        });

        setHasBadge(owner === character.owner);
      } catch {
        // Badge doesn't exist or other error
        setHasBadge(false);
      }
    };

    checkBadge();
  }, [character, publicClient]);

  const fetchCharacter = useCallback(async () => {
    try {
      if (!(id && publicClient && worldContract)) return null;
      setIsLoadingCharacter(true);

      const characterData = getComponentValue(Characters, id as Entity);
      const characterStats = getComponentValue(Stats, id as Entity);

      if (!(characterData && characterStats)) return null;

      const ownerEntity = encodeEntity(
        { address: 'address' },
        { address: characterData.owner as `0x${string}` },
      );
      const tokenIdEntity = encodeEntity(
        { tokenId: 'uint256' },
        { tokenId: characterData.tokenId },
      );

      // These components may be undefined if tables are empty
      const externalGoldBalance = GoldBalances
        ? (getComponentValue(GoldBalances, ownerEntity)?.value ?? BigInt(0))
        : BigInt(0);
      const escrowGoldBalance = AdventureEscrow
        ? (getComponentValue(AdventureEscrow, id as Entity)?.balance ?? BigInt(0))
        : BigInt(0);

      const metadataURI = getComponentValueStrict(
        CharactersTokenURI,
        tokenIdEntity,
      ).tokenURI;

      const fetachedMetadata = await fetchMetadataFromUri(
        uriToHttp(`ipfs://${metadataURI}`)[0],
      );

      const { encounterId, pvpTimer } = EncounterEntity
        ? (getComponentValue(EncounterEntity, id as Entity) ?? { encounterId: zeroHash, pvpTimer: BigInt(0) })
        : { encounterId: zeroHash, pvpTimer: BigInt(0) };
      const inBattle = !!encounterId && encounterId !== zeroHash;

      const decodedBaseStats = decodeBaseStats(characterData.baseStats);

      // WorldStatusEffec and related components may be undefined
      const worldStatusEffectsComponent = WorldStatusEffec
        ? getComponentValue(WorldStatusEffec, id as Entity)
        : undefined;

      const { appliedStatusEffects } = worldStatusEffectsComponent ?? {
        appliedStatusEffects: [],
      };

      const decodedStatusEffects = appliedStatusEffects.map(
        decodeAppliedStatusEffectId,
      );

      // Only process status effects if the required components exist
      const worldStatusEffects: WorldStatusEffect[] = (StatusEffectStat && StatusEffectVali)
        ? decodedStatusEffects.map(effect => {
            const paddedEffectId = effect.effectId.padEnd(66, '0') as Entity;
            const effectStats = getComponentValue(StatusEffectStat, paddedEffectId);
            const validity = getComponentValue(StatusEffectVali, paddedEffectId);

            if (!effectStats || !validity) return null;

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

      const _character = {
        ...fetachedMetadata,
        agility: characterStats.agility,
        baseStats: decodedBaseStats,
        currentHp: characterStats.currentHp,
        entityClass: characterStats.class,
        escrowGoldBalance,
        experience: characterStats.experience,
        externalGoldBalance,
        id: id as Entity,
        inBattle,
        intelligence: characterStats.intelligence,
        isSpawned: false,
        level: characterStats.level,
        locked: characterData.locked,
        maxHp: characterStats.maxHp,
        name: hexToString(characterData.name as `0x${string}`, {
          size: 32,
        }),
        owner: characterData.owner,
        position: { x: 0, y: 0 },
        pvpCooldownTimer: pvpTimer,
        strength: characterStats.strength,
        tokenId: characterData.tokenId.toString(),
        worldStatusEffects,
      };

      setCharacter(_character);
      return _character;
    } catch (e) {
      renderError(
        (e as Error)?.message ?? 'Failed to fetch character data.',
        e,
      );
      return null;
    } finally {
      setIsLoadingCharacter(false);
    }
  }, [
    AdventureEscrow,
    Characters,
    CharactersTokenURI,
    EncounterEntity,
    GoldBalances,
    id,
    publicClient,
    renderError,
    Stats,
    StatusEffectStat,
    StatusEffectVali,
    worldContract,
    WorldStatusEffec,
  ]);

  const isOwner = useMemo(() => {
    if (!(id && userCharacter)) return false;
    const { ownerAddress } = decodeCharacterId(id as `0x${string}`);
    return userCharacter.owner.toLowerCase() === ownerAddress;
  }, [id, userCharacter]);

  useEffect(() => {
    if (!isSynced) return;
    (async (): Promise<void> => {
      if (isOwner && userCharacter) {
        setCharacter(userCharacter);
        setIsLoadingCharacter(false);
        return;
      }
      await fetchCharacter();
    })();
  }, [fetchCharacter, isOwner, isSynced, userCharacter]);

  // Auto-open advanced class modal when level >= 10 and no class selected
  useEffect(() => {
    if (
      isOwner &&
      userCharacter &&
      Number(userCharacter.level) >= 10 &&
      !userCharacter.hasSelectedAdvancedClass
    ) {
      onOpenClassModal();
    }
  }, [isOwner, userCharacter, onOpenClassModal]);

  const onClassSelected = useCallback(() => {
    refreshCharacter();
  }, [refreshCharacter]);

  const currentLevelXpRequirement =
    useComponentValue(
      Levels,
      character && Number(character.level) > 0
        ? encodeEntity(
            { level: 'uint256' },
            { level: BigInt(Math.max(0, Number(character.level) - 1)) },
          )
        : undefined,
    )?.experience ?? BigInt(0);

  const nextLevelXpRequirement =
    useComponentValue(
      Levels,
      character
        ? encodeEntity({ level: 'uint256' }, { level: BigInt(character.level) })
        : undefined,
    )?.experience ?? BigInt(0);

  const levelPercent = useMemo(() => {
    if (!character) return 0;

    const xpEarnedSinceLastLevel =
      BigInt(character.experience) - currentLevelXpRequirement;
    const xpNeededSinceLastLevel =
      nextLevelXpRequirement - currentLevelXpRequirement;

    const percent =
      (100 * Number(xpEarnedSinceLastLevel)) / Number(xpNeededSinceLastLevel);
    return percent > 100 ? 100 : percent;
  }, [character, currentLevelXpRequirement, nextLevelXpRequirement]);

  const maxLevelXpRequirement = useMemo(
    () =>
      hexToBigInt(
        Array.from(runQuery([Has(Levels)])).slice(-1)[0] as `0x${string}`,
      ),
    [Levels],
  );

  const maxed = useMemo(() => {
    if (!character) return false;
    return maxLevelXpRequirement <= BigInt(character.level);
  }, [character, maxLevelXpRequirement]);

  const canLevel = useMemo(() => {
    if (!character) return false;
    if (maxed) return false;
    if (nextLevelXpRequirement === BigInt(0)) return false;
    return BigInt(character.experience) >= nextLevelXpRequirement;
  }, [character, maxed, nextLevelXpRequirement]);

  if (isLoadingCharacter) {
    return (
      <Center h="100%">
        <Spinner size="lg" />
      </Center>
    );
  }

  return (
    <Box>
      <Helmet>
        <title>{character ? `${character.name} | Ultimate Dominion` : 'Character | Ultimate Dominion'}</title>
      </Helmet>
      {character ? (
        <Grid
          gap={2}
          rowGap={{ base: 3, lg: 10 }}
          sx={{
            filter: character ? 'blur(0px)' : 'blur(10px)',
          }}
          templateColumns={{
            base: 'repeat(1, 1fr)',
            sm: 'repeat(1, 1fr)',
            lg: 'repeat(3, 1fr)',
            xl: 'repeat(3, 1fr)',
          }}
        >
          <GridItem
            colSpan={{ base: 1, sm: 1, md: 1, lg: 1, xl: 1 }}
            colStart={{ base: 1, sm: 1, md: 1, lg: 1, xl: 1 }}
          >
            <PolygonalCard clipPath="none" p={6} position="relative">
              <VStack alignItems="start" spacing={0}>
                <HStack justify="space-between" w="100%">
                  <HStack>
                    <Text
                      color="yellow"
                      fontWeight={700}
                      size={{ base: 'md', sm: 'lg', md: 'xl' }}
                    >
                      {etherToFixedNumber(character.externalGoldBalance)} $GOLD
                    </Text>
                    <Tooltip
                      bg="#14120F"
                      hasArrow
                      label="This is your external wallet's $GOLD balance. You can use this to buy items in the Marketplace and various shops. To withdraw from or deposit $GOLD into your Adventure Escrow, visit 0,0 on the map."
                      placement="top"
                      shouldWrapChildren
                    >
                      <IoMdInformationCircleOutline />
                    </Tooltip>
                  </HStack>
                  <Text size={{ base: 'sm', sm: 'md' }}>
                    <Text
                      as="span"
                      color={
                        BigInt(character.experience) >= nextLevelXpRequirement
                          ? 'green'
                          : 'black'
                      }
                      fontWeight={
                        BigInt(character.experience) >= nextLevelXpRequirement
                          ? 'bold'
                          : 'normal'
                      }
                    >
                      {character.experience.toString()}
                    </Text>
                    /{nextLevelXpRequirement.toString()} XP
                  </Text>
                </HStack>
                <HStack>
                  <Text
                    color="#8A7E6A"
                    size="xs"
                    fontWeight="bold"
                    textAlign="start"
                  >
                    Adventure Escrow balance:{' '}
                    {etherToFixedNumber(character.escrowGoldBalance)} $GOLD
                  </Text>
                  <Tooltip
                    bg="#14120F"
                    hasArrow
                    label="Your Adventure Escrow is where $GOLD goes when you win battles. Leaving $GOLD in your escrow will help you level up faster, but in the Outer Realms, you run the risk of losing it all against other players. You can withdraw your $GOLD at 0,0 on the map."
                    placement="top"
                    shouldWrapChildren
                  >
                    <IoMdInformationCircleOutline />
                  </Tooltip>
                </HStack>
              </VStack>
              <Level
                currentLevel={character.level}
                levelPercent={levelPercent}
                maxed={maxed}
                mt={10}
              />

              <VStack
                bottom={6}
                mt={{ base: 12, sm: 20 }}
                left={0}
                position={{ base: 'static', lg: 'absolute' }}
                px={{ base: 0, lg: 6 }}
                spacing={3}
                w="100%"
              >
                {isOwner ? (
                  <Button
                    leftIcon={<MarketplaceIconSvg theme="dark" />}
                    onClick={() => navigate(MARKETPLACE_PATH)}
                    variant="white"
                    w="100%"
                  >
                    Marketplace
                  </Button>
                ) : (
                  <Button
                    leftIcon={<IoChatbubble />}
                    onClick={onOpenChat}
                    variant="white"
                    w="100%"
                  >
                    Chat
                  </Button>
                )}
                <Button
                  leftIcon={<LeaderboardIconSvg theme="dark" />}
                  onClick={() => navigate(LEADERBOARD_PATH)}
                  variant="white"
                  w="100%"
                >
                  Leaderboard
                </Button>
              </VStack>
            </PolygonalCard>
          </GridItem>
          <GridItem
            colSpan={{ base: 1, sm: 1, md: 1, lg: 1, xl: 1 }}
            colStart={{ base: 1, sm: 1, md: 1, lg: 2, xl: 2 }}
          >
            <LevelingPanel canLevel={canLevel} character={character} />
          </GridItem>
          <GridItem
            colSpan={{ base: 1, sm: 1, md: 1, lg: 1, xl: 1 }}
            colStart={{ base: 1, sm: 1, md: 1, lg: 3, xl: 3 }}
          >
            <PolygonalCard
              bgColor="#14120F"
              clipPath="none"
              color="white"
              p={6}
              position="relative"
            >
              <HStack spacing={4}>
                <Avatar size="lg" src={character.image} />
                <Text fontWeight={700} mt={1} size="xl">
                  {character.name}
                </Text>
                {hasBadge && (
                  <Tooltip
                    bg="#14120F"
                    hasArrow
                    label="Adventurer Badge - Earned at Level 3"
                    placement="top"
                    shouldWrapChildren
                  >
                    <Box color="gold">
                      <FaMedal size={20} />
                    </Box>
                  </Tooltip>
                )}
                <ClassSymbol entityClass={character.entityClass} />
                {isOwner && Number(character.level) >= 10 && !character.hasSelectedAdvancedClass && (
                  <Button size="xs" variant="outline" colorScheme="blue" onClick={onOpenClassModal}>
                    Choose Class
                  </Button>
                )}
              </HStack>
              <Text fontWeight={500} my={12} size={{ base: 'sm', sm: 'md' }}>
                {character.description}
              </Text>
              {isOwner && (
                <Button
                  borderRadius="4px"
                  bottom={6}
                  onClick={onOpenEditModal}
                  position="absolute"
                  right={6}
                  size="xs"
                  variant="white"
                >
                  Edit Character
                </Button>
              )}
            </PolygonalCard>
          </GridItem>
          <GridItem
            colSpan={{ base: 1, sm: 1, md: 1, lg: 3, xl: 3 }}
            colStart={{ base: 1, sm: 1, md: 1, lg: 1, xl: 1 }}
          >
            <ItemsPanel character={character} />
          </GridItem>
          <GridItem
            colSpan={{ base: 1, sm: 1, md: 1, lg: 3, xl: 3 }}
            colStart={{ base: 1, sm: 1, md: 1, lg: 1, xl: 1 }}
          >
            <FragmentCollection />
          </GridItem>
        </Grid>
      ) : (
        <Grid>
          <GridItem>
            <Center
              left="0"
              position="absolute"
              right="0"
              top="32%"
              zIndex={100}
            >
              <Card
                background="black"
                color="white"
                margin="0 auto"
                variant="filled"
              >
                <CardBody>
                  <Text fontWeight="bold">This character does not exist</Text>
                </CardBody>
              </Card>
            </Center>
          </GridItem>
        </Grid>
      )}
      {character && (
        <EditCharacterModal
          isOpen={isEditModalOpen}
          onClose={onCloseEditModal}
          {...character}
        />
      )}
      {character && isOwner && (
        <AdvancedClassModal
          isOpen={isClassModalOpen}
          onClose={onCloseClassModal}
          characterId={character.id}
          onClassSelected={onClassSelected}
        />
      )}
    </Box>
  );
};

const ItemsPanel = ({ character }: { character: Character }): JSX.Element => {
  const { renderError } = useToast();
  const {
    components: { CharacterEquipme, ItemsOwners },
  } = useMUD();
  const {
    armorTemplates,
    consumableTemplates,
    isLoading: isLoadingItemTemplates,
    spellTemplates,
    weaponTemplates,
  } = useItems();

  const {
    isOpen: isItemModalOpen,
    onClose: onCloseItemModal,
    onOpen: onOpenItemModal,
  } = useDisclosure();
  const {
    isOpen: isConsumableModalOpen,
    onClose: onCloseConsumableModal,
    onOpen: onOpenConsumableModal,
  } = useDisclosure();

  const [selectedItem, setSelectedItem] = useState<
    Armor | Spell | Weapon | null
  >(null);
  const [selectedConsumable, setSelectedConsumable] =
    useState<Consumable | null>(null);
  const [inventoryArmor, setInventoryArmor] = useState<Armor[]>([]);
  const [inventoryConsumables, setInventoryConsumables] = useState<
    Consumable[]
  >([]);
  const [inventorySpells, setInventorySpells] = useState<Spell[]>([]);
  const [inventoryWeapons, setInventoryWeapons] = useState<Weapon[]>([]);
  const [equippedArmor, setEquippedArmor] = useState<Armor[]>([]);
  const [equippedSpells, setEquippedSpells] = useState<Spell[]>([]);
  const [equippedWeapons, setEquippedWeapons] = useState<Weapon[]>([]);

  const fetchCharacterItems = useCallback(
    (
      _character: Character,
      _equippedArmorIds: bigint[],
      _equippedSpellsIds: bigint[],
      _equippedWeaponsIds: bigint[],
    ) => {
      try {
        // If ItemsOwners component doesn't exist, skip item fetching
        if (!ItemsOwners) {
          console.log('[Character] ItemsOwners component not available, skipping items');
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

  // Use useComponentValue to subscribe to equipment data changes
  // CharacterEquipme may be undefined if table is empty/not synced yet
  const equipmentData = useComponentValue(
    CharacterEquipme ?? undefined,
    CharacterEquipme ? character.id : undefined,
  );

  useEffect(() => {
    if (isLoadingItemTemplates) return;

    // Destructure with default values to handle undefined fields
    const {
      equippedArmor: equippedArmorIds = [],
      equippedSpells: equippedSpellsIds = [],
      equippedWeapons: equippedWeaponsIds = [],
    } = equipmentData ?? {};

    fetchCharacterItems(
      character,
      equippedArmorIds as bigint[],
      equippedSpellsIds as bigint[],
      equippedWeaponsIds as bigint[],
    );
  }, [
    character,
    equipmentData,
    fetchCharacterItems,
    isLoadingItemTemplates,
  ]);

  const spellsAndWeapons = useMemo(() => {
    return [...inventorySpells, ...inventoryWeapons];
  }, [inventorySpells, inventoryWeapons]);

  const equippedSpellsAndWeapons = useMemo(() => {
    return [...equippedSpells, ...equippedWeapons];
  }, [equippedSpells, equippedWeapons]);

  const equippedArmorIds = useMemo(() => {
    return equippedArmor.map(a => BigInt(a.tokenId));
  }, [equippedArmor]);

  const equippedSpellsAndWeaponsIds = useMemo(() => {
    return equippedSpellsAndWeapons.map(sow => BigInt(sow.tokenId));
  }, [equippedSpellsAndWeapons]);

  const equippedConsumableIds = useMemo(() => {
    const ids = (equipmentData?.equippedConsumables ?? []) as bigint[];
    return ids.map(id => BigInt(id));
  }, [equipmentData?.equippedConsumables]);

  const maxArmorEquipped = equippedArmorIds.length === MAX_EQUIPPED_ARMOR;
  const maxWeaponsEquipped =
    equippedSpellsAndWeaponsIds.length === MAX_EQUIPPED_WEAPONS;

  const armorInInventory = useMemo(() => {
    return inventoryArmor
      .reduce((acc, item) => {
        return acc + item.balance;
      }, BigInt(0))
      .toString();
  }, [inventoryArmor]);

  const spellsAndWeaponsInInventory = useMemo(() => {
    return spellsAndWeapons
      .reduce((acc, item) => {
        return acc + item.balance;
      }, BigInt(0))
      .toString();
  }, [spellsAndWeapons]);

  const consumablesInInventory = useMemo(() => {
    return inventoryConsumables
      .reduce((acc, item) => {
        return acc + item.balance;
      }, BigInt(0))
      .toString();
  }, [inventoryConsumables]);

  if (isLoadingItemTemplates) {
    return (
      <Center h="100%">
        <Spinner size="lg" />
      </Center>
    );
  }

  return (
    <Box>
      <HStack
        color="white"
        bgColor="#1C1814"
        h="68px"
        justifyContent="space-between"
        px={6}
      >
        <Text color="white" fontWeight={700} size={{ base: 'lg', sm: 'xl' }}>
          Items Inventory
        </Text>
        <Text color="white" fontWeight={500} size={{ base: 'md', sm: 'lg' }}>
          Total:{' '}
          {inventoryArmor.length +
            spellsAndWeapons.length +
            inventoryConsumables.length}
        </Text>
      </HStack>
      <PolygonalCard clipPath="none" p={6}>
        <Text fontWeight="bold" mt={{ base: 8, lg: 0 }} size="lg">
          Armor ({armorInInventory}) - {equippedArmor.length}/
          {MAX_EQUIPPED_ARMOR} equipped{' '}
        </Text>
        {maxArmorEquipped && <Text fontSize="sm">(Max armor equipped)</Text>}
        <Grid
          templateColumns={{
            base: 'repeat(1, 1fr)',
            sm: 'repeat(1, 1fr)',
            md: 'repeat(2, 1fr)',
            xl: 'repeat(3, 1fr)',
          }}
          gap={2}
          mt={4}
        >
          {inventoryArmor.length === 0 && <Text>No armor</Text>}
          {inventoryArmor.map((ar, i) => {
            const isEquipped = equippedArmorIds.includes(BigInt(ar.tokenId));
            return (
              <GridItem key={i}>
                <ItemCard
                  isEquipped={isEquipped}
                  onClick={
                    maxArmorEquipped && !isEquipped
                      ? undefined
                      : () => {
                          setSelectedItem(ar);
                          onOpenItemModal();
                        }
                  }
                  {...ar}
                />
              </GridItem>
            );
          })}
        </Grid>
        <Text fontWeight="bold" mt={{ base: 8, lg: 12 }} size="lg">
          Weapons & Spells ({spellsAndWeaponsInInventory}) -{' '}
          {equippedSpellsAndWeaponsIds.length}/{MAX_EQUIPPED_WEAPONS} equipped{' '}
        </Text>
        {maxWeaponsEquipped && (
          <Text fontSize="sm">(Max weapons equipped)</Text>
        )}
        <Grid
          templateColumns={{
            base: 'repeat(1, 1fr)',
            sm: 'repeat(1, 1fr)',
            md: 'repeat(2, 1fr)',
            xl: 'repeat(3, 1fr)',
          }}
          gap={2}
          mt={4}
        >
          {spellsAndWeapons.length === 0 && <Text>No weapons</Text>}
          {spellsAndWeapons.map((item, i) => {
            const isEquipped = equippedSpellsAndWeaponsIds.includes(
              BigInt(item.tokenId),
            );

            return (
              <GridItem key={i}>
                <ItemCard
                  isEquipped={isEquipped}
                  onClick={
                    maxWeaponsEquipped && !isEquipped
                      ? undefined
                      : () => {
                          setSelectedItem(item);
                          onOpenItemModal();
                        }
                  }
                  {...item}
                />
              </GridItem>
            );
          })}
        </Grid>
        <Text fontWeight="bold" mt={{ base: 8, lg: 12 }} size="lg">
          Consumables ({consumablesInInventory}) -{' '}
          {equippedConsumableIds.length} equipped
        </Text>
        <Grid
          templateColumns={{
            base: 'repeat(1, 1fr)',
            sm: 'repeat(1, 1fr)',
            md: 'repeat(2, 1fr)',
            xl: 'repeat(3, 1fr)',
          }}
          gap={2}
          mt={4}
        >
          {inventoryConsumables.length === 0 && <Text>No consumables</Text>}
          {inventoryConsumables.map((consumable, i) => {
            const isEquipped = equippedConsumableIds.includes(
              BigInt(consumable.tokenId),
            );
            return (
              <GridItem key={i}>
                <ItemCard
                  isEquipped={isEquipped}
                  onClick={() => {
                    setSelectedConsumable(consumable);
                    onOpenConsumableModal();
                  }}
                  {...consumable}
                />
              </GridItem>
            );
          })}
        </Grid>
        {selectedItem && (
          <ItemEquipModal
            isEquipped={
              equippedArmorIds.includes(BigInt(selectedItem?.tokenId ?? 0)) ||
              equippedSpellsAndWeaponsIds.includes(
                BigInt(selectedItem?.tokenId ?? 0),
              )
            }
            isOpen={isItemModalOpen}
            onClose={() => {
              onCloseItemModal();
              setSelectedItem(null);
            }}
            {...selectedItem}
          />
        )}
        {selectedConsumable && (
          <ItemConsumeModal
            isEquipped={equippedConsumableIds.includes(
              BigInt(selectedConsumable.tokenId),
            )}
            isOpen={isConsumableModalOpen}
            onClose={() => {
              onCloseConsumableModal();
              setSelectedConsumable(null);
            }}
            {...selectedConsumable}
          />
        )}
      </PolygonalCard>
    </Box>
  );
};
