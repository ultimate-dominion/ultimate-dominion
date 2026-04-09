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
  IconButton,
  Spinner,
  Text,
  Tooltip,
  useDisclosure,
  VStack,
} from '@chakra-ui/react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { IoMdInformationCircleOutline } from 'react-icons/io';
import { IoChatbubble } from 'react-icons/io5';
import { useNavigate, useParams } from 'react-router-dom';
import {
  encodeAddressKey,
  encodeCompositeKey,
  encodeUint256Key,
  toBigInt,
  useGameTable,
  useGameValue,
} from '../lib/gameStore';
import { useBadges } from '../hooks/useBadges';
import { useReactiveEntity } from '../hooks/useReactiveEntity';
import { AdvancedClassModal } from '../components/AdvancedClassModal';
import { BadgeIcons, BadgeShowcase } from '../components/BadgeDisplay';
import { CharacterInspectOverlay } from '../components/CharacterInspectOverlay';
import { ClassSymbol } from '../components/ClassSymbol';
import { EditCharacterModal } from '../components/EditCharacterModal';
import { FragmentChainProgress } from '../components/FragmentChainProgress';
import { FragmentCollection } from '../components/FragmentCollection';
import { RespecPanel } from '../components/RespecPanel';
import { ItemCard } from '../components/ItemCard';
import { ItemConsumeModal } from '../components/ItemConsumeModal';
import { ItemEquipModal } from '../components/ItemEquipModal';
import { Level } from '../components/Level';
import { LevelingPanel } from '../components/LevelingPanel';
import { PolygonalCard } from '../components/PolygonalCard';
import { useCharacter } from '../contexts/CharacterContext';
import { useChat } from '../contexts/ChatContext';
import { useItems } from '../contexts/ItemsContext';
import { useAuth } from '../contexts/AuthContext';
import { useMUD } from '../contexts/MUDContext';
import { SHOW_Z2 } from '../lib/env';
import { HOME_PATH } from '../Routes';
import {
  MAX_EQUIPPED_ARMOR,
  MAX_EQUIPPED_WEAPONS,
  MAX_LEVEL,
} from '../utils/constants';
import {
  decodeCharacterId,
  etherToFixedNumber,
} from '../utils/helpers';
import { getRarityColor } from '../utils/rarityHelpers';
import { DARK_DIVIDER_SHADOW } from '../utils/theme';
import {
  type Armor,
  type Character,
  type Consumable,
  type QuestItemTemplate,
  Race,
  type Spell,
  type Weapon,
} from '../utils/types';

const CharacterViewer = lazy(() =>
  import('../components/pretext/game/CharacterViewer').then(m => ({ default: m.CharacterViewer })),
);

export const CharacterPage = (): JSX.Element => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation('ui');
  const { isAuthenticated: isConnected, isConnecting } = useAuth();

  const { isSynced } = useMUD();
  const {
    character: userCharacter,
    refreshCharacter,
    equippedArmor,
    equippedWeapons,
    equippedSpells,
    equippedConsumables,
  } = useCharacter();
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

  const {
    isOpen: isInspectOpen,
    onClose: onCloseInspect,
    onOpen: onOpenInspect,
  } = useDisclosure();

  // Reactive character data for any entity ID
  const reactiveCharacter = useReactiveEntity(id);

  const isOwner = useMemo(() => {
    if (!(id && userCharacter)) return false;
    const { ownerAddress } = decodeCharacterId(id as `0x${string}`);
    return userCharacter.owner.toLowerCase() === ownerAddress;
  }, [id, userCharacter]);

  // For owner's own character, CharacterContext provides reactive data.
  // For other characters, useReactiveEntity provides reactive data.
  const character = isOwner ? userCharacter : reactiveCharacter;
  const isLoadingCharacter = !isSynced || (!character && !!id);

  const { badges } = useBadges(character);

  useEffect(() => {
    if (isConnecting) return;

    if (!isConnected) {
      navigate(HOME_PATH);
    }
  }, [isConnected, isConnecting, navigate]);

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

  const currentLevelKey =
    character && Number(character.level) > 0
      ? encodeUint256Key(BigInt(Math.max(0, Number(character.level) - 1)))
      : undefined;
  const currentLevelData = useGameValue('Levels', currentLevelKey);
  const currentLevelXpRequirement = toBigInt(currentLevelData?.experience);

  const nextLevelKey = character
    ? encodeUint256Key(BigInt(character.level))
    : undefined;
  const nextLevelData = useGameValue('Levels', nextLevelKey);
  const nextLevelXpRequirement = toBigInt(nextLevelData?.experience);

  const maxed = useMemo(() => {
    if (!character) return false;
    return Number(character.level) >= MAX_LEVEL;
  }, [character]);

  const levelPercent = useMemo(() => {
    if (!character) return 0;
    if (maxed) return 100;

    const xpEarnedSinceLastLevel =
      BigInt(character.experience) - currentLevelXpRequirement;
    const xpNeededSinceLastLevel =
      nextLevelXpRequirement - currentLevelXpRequirement;

    const percent =
      (100 * Number(xpEarnedSinceLastLevel)) / Number(xpNeededSinceLastLevel);
    return percent > 100 ? 100 : percent;
  }, [character, maxed, currentLevelXpRequirement, nextLevelXpRequirement]);

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
            order={{ base: 2, lg: 1 }}
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
                      label="This is your external wallet's $GOLD balance. You can use this to buy items in the Marketplace and various shops. To move Gold between your stash and carried supply, visit 0,0 on the map."
                      placement="top"
                      shouldWrapChildren
                    >
                      <IoMdInformationCircleOutline />
                    </Tooltip>
                  </HStack>
                  <Text size={{ base: 'sm', sm: 'md' }}>
                    {maxed ? (
                      <Text as="span" color="green" fontWeight="bold">
                        {character.experience.toString()} XP (MAX)
                      </Text>
                    ) : (
                      <>
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
                      </>
                    )}
                  </Text>
                </HStack>
              </VStack>
              <Level
                currentLevel={character.level}
                levelPercent={levelPercent}
                maxed={maxed}
                mt={10}
              />

            </PolygonalCard>
          </GridItem>
          <GridItem
            colSpan={{ base: 1, sm: 1, md: 1, lg: 1, xl: 1 }}
            colStart={{ base: 1, sm: 1, md: 1, lg: 2, xl: 2 }}
            order={{ base: 3, lg: 2 }}
          >
            <LevelingPanel canLevel={canLevel} character={character} />
          </GridItem>
          <GridItem
            colSpan={{ base: 1, sm: 1, md: 1, lg: 1, xl: 1 }}
            colStart={{ base: 1, sm: 1, md: 1, lg: 3, xl: 3 }}
            order={{ base: 1, lg: 3 }}
          >
            <PolygonalCard
              bgColor="#14120F"
              clipPath="none"
              color="white"
              p={6}
              position="relative"
            >
              {character.race !== Race.None && (
                <Box cursor="pointer" onClick={onOpenInspect} position="relative">
                  <Suspense fallback={null}>
                    <CharacterViewer
                      race={character.race}
                      height={220}
                      cellSize={4}
                      equippedItems={
                        equippedWeapons[0]
                          ? [{ name: equippedWeapons[0].name, socket: 'hand_R.socket' }]
                          : undefined
                      }
                    />
                  </Suspense>
                  {/* Rarity badges for equipped items */}
                  <HStack spacing={1.5} justify="center" mt={1}>
                    {equippedArmor[0] && (
                      <Box w="8px" h="8px" borderRadius="sm" bg={getRarityColor(equippedArmor[0].rarity)} />
                    )}
                    {[...equippedWeapons, ...equippedSpells].map((item, i) => (
                      <Box key={i} w="8px" h="8px" borderRadius="sm" bg={getRarityColor(item.rarity)} />
                    ))}
                  </HStack>
                  {/* Inspect hint */}
                  <Text
                    position="absolute"
                    bottom={1}
                    right={2}
                    fontFamily="mono"
                    fontSize="9px"
                    color="#5A5040"
                    opacity={0.7}
                  >
                    inspect
                  </Text>
                </Box>
              )}
              <HStack spacing={3} alignItems="center" mt={character.race !== Race.None ? 4 : 0}>
                <Avatar size={{ base: 'md', lg: 'lg' }} src={character.image} />
                <VStack alignItems="start" spacing={1}>
                  <HStack spacing={2} flexWrap="wrap">
                    <Text fontWeight={700} size={{ base: 'lg', sm: 'xl' }}>
                      {character.name}
                    </Text>
                    <ClassSymbol advancedClass={character.advancedClass} entityClass={character.entityClass} />
                  </HStack>
                  <BadgeIcons badges={badges} />
                </VStack>
                {isOwner && Number(character.level) >= 10 && !character.hasSelectedAdvancedClass && (
                  <Button size="xs" variant="outline" colorScheme="blue" onClick={onOpenClassModal}>
                    Choose Class
                  </Button>
                )}
              </HStack>
              <Text fontWeight={500} mt={6} mb={badges.length > 0 ? 4 : 12} size={{ base: 'sm', sm: 'md' }}>
                {character.description}
              </Text>
              {badges.length > 0 && (
                <Box mb={12}>
                  <BadgeShowcase badges={badges} />
                </Box>
              )}
              {isOwner ? (
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
              ) : (
                <IconButton
                  aria-label="Chat"
                  bottom={6}
                  icon={<IoChatbubble />}
                  left={6}
                  onClick={onOpenChat}
                  position="absolute"
                  size="sm"
                  variant="white"
                />
              )}
            </PolygonalCard>
          </GridItem>
          <GridItem
            colSpan={{ base: 1, sm: 1, md: 1, lg: 3, xl: 3 }}
            colStart={{ base: 1, sm: 1, md: 1, lg: 1, xl: 1 }}
            order={{ base: 4, lg: 4 }}
          >
            <ItemsPanel character={character} />
          </GridItem>
          {isOwner && SHOW_Z2 && (
            <GridItem
              colSpan={{ base: 1, sm: 1, md: 1, lg: 3, xl: 3 }}
              colStart={{ base: 1, sm: 1, md: 1, lg: 1, xl: 1 }}
              order={{ base: 5, lg: 5 }}
            >
              <PolygonalCard clipPath="none" p={6}>
                <RespecPanel />
              </PolygonalCard>
            </GridItem>
          )}
          {SHOW_Z2 && (
            <GridItem
              colSpan={{ base: 1, sm: 1, md: 1, lg: 3, xl: 3 }}
              colStart={{ base: 1, sm: 1, md: 1, lg: 1, xl: 1 }}
              order={{ base: 6, lg: 6 }}
            >
              <PolygonalCard clipPath="none" p={6}>
                <FragmentChainProgress />
              </PolygonalCard>
            </GridItem>
          )}
          <GridItem
            colSpan={{ base: 1, sm: 1, md: 1, lg: 3, xl: 3 }}
            colStart={{ base: 1, sm: 1, md: 1, lg: 1, xl: 1 }}
            order={{ base: 7, lg: 7 }}
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
                  <Text fontWeight="bold">{t('character.notExist')}</Text>
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
      {character && (
        <CharacterInspectOverlay
          isOpen={isInspectOpen}
          onClose={onCloseInspect}
          character={character}
          equippedArmor={equippedArmor}
          equippedWeapons={equippedWeapons}
          equippedSpells={equippedSpells}
          equippedConsumables={equippedConsumables}
        />
      )}
    </Box>
  );
};

const ItemsPanel = ({ character }: { character: Character }): JSX.Element => {
  const { t } = useTranslation('ui');
  const {
    armorTemplates,
    consumableTemplates,
    isLoading: isLoadingItemTemplates,
    questItemTemplates,
    spellTemplates,
    weaponTemplates,
  } = useItems();

  // Reactive table subscriptions — useMemo reads directly, no async effect needed
  const itemsOwnersTable = useGameTable('ItemsOwners');
  const equipmentData = useGameValue('CharacterEquipment', character.id);

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

  // Equipment IDs from reactive store — synchronous, no effect needed
  const equippedArmorIds = useMemo(() => {
    const ids = (equipmentData?.equippedArmor ?? []) as unknown[];
    return ids.map(toBigInt);
  }, [equipmentData?.equippedArmor]);

  const equippedWeaponIds = useMemo(() => {
    const ids = (equipmentData?.equippedWeapons ?? []) as unknown[];
    return ids.map(toBigInt);
  }, [equipmentData?.equippedWeapons]);

  const equippedSpellIds = useMemo(() => {
    const ids = (equipmentData?.equippedSpells ?? []) as unknown[];
    return ids.map(toBigInt);
  }, [equipmentData?.equippedSpells]);

  const equippedConsumableIds = useMemo(() => {
    const ids = (equipmentData?.equippedConsumables ?? []) as unknown[];
    return ids.map(toBigInt);
  }, [equipmentData?.equippedConsumables]);

  // Build inventory lists synchronously from reactive tables
  const ownerKey = useMemo(() => encodeAddressKey(character.owner), [character.owner]);

  const inventoryArmor = useMemo(() => {
    if (isLoadingItemTemplates) return [];
    return armorTemplates
      .map(armor => {
        const compositeKey = encodeCompositeKey(ownerKey, encodeUint256Key(BigInt(armor.tokenId)));
        const itemOwner = itemsOwnersTable[compositeKey];
        return {
          ...armor,
          balance: itemOwner ? toBigInt(itemOwner.balance) : BigInt(0),
          itemId: compositeKey,
          owner: character.owner,
        } as Armor;
      })
      .filter(a => a.balance !== BigInt(0))
      .sort((a, b) => {
        const rarityDiff = (b.rarity ?? 0) - (a.rarity ?? 0);
        if (rarityDiff !== 0) return rarityDiff;
        return Number(b.armorModifier - a.armorModifier);
      });
  }, [armorTemplates, itemsOwnersTable, ownerKey, character.owner, isLoadingItemTemplates]);

  const inventoryConsumables = useMemo(() => {
    if (isLoadingItemTemplates) return [];
    return consumableTemplates
      .map(consumable => {
        const compositeKey = encodeCompositeKey(ownerKey, encodeUint256Key(BigInt(consumable.tokenId)));
        const itemOwner = itemsOwnersTable[compositeKey];
        return {
          ...consumable,
          balance: itemOwner ? toBigInt(itemOwner.balance) : BigInt(0),
          itemId: compositeKey,
          owner: character.owner,
        } as Consumable;
      })
      .filter(c => c.balance !== BigInt(0))
      .sort((a, b) => {
        const rarityDiff = (b.rarity ?? 0) - (a.rarity ?? 0);
        if (rarityDiff !== 0) return rarityDiff;
        return Number(b.hpRestoreAmount - a.hpRestoreAmount);
      });
  }, [consumableTemplates, itemsOwnersTable, ownerKey, character.owner, isLoadingItemTemplates]);

  const inventorySpells = useMemo(() => {
    if (isLoadingItemTemplates) return [];
    return spellTemplates
      .map(spell => {
        const compositeKey = encodeCompositeKey(ownerKey, encodeUint256Key(BigInt(spell.tokenId)));
        const itemOwner = itemsOwnersTable[compositeKey];
        return {
          ...spell,
          balance: itemOwner ? toBigInt(itemOwner.balance) : BigInt(0),
          itemId: compositeKey,
          owner: character.owner,
        } as Spell;
      })
      .filter(s => s.balance !== BigInt(0))
      .sort((a, b) => {
        const rarityDiff = (b.rarity ?? 0) - (a.rarity ?? 0);
        if (rarityDiff !== 0) return rarityDiff;
        return Number(b.maxDamage - a.maxDamage);
      });
  }, [spellTemplates, itemsOwnersTable, ownerKey, character.owner, isLoadingItemTemplates]);

  const inventoryWeapons = useMemo(() => {
    if (isLoadingItemTemplates) return [];
    return weaponTemplates
      .map(weapon => {
        const compositeKey = encodeCompositeKey(ownerKey, encodeUint256Key(BigInt(weapon.tokenId)));
        const itemOwner = itemsOwnersTable[compositeKey];
        return {
          ...weapon,
          balance: itemOwner ? toBigInt(itemOwner.balance) : BigInt(0),
          itemId: compositeKey,
          owner: character.owner,
        } as Weapon;
      })
      .filter(w => w.balance !== BigInt(0))
      .sort((a, b) => {
        const rarityDiff = (b.rarity ?? 0) - (a.rarity ?? 0);
        if (rarityDiff !== 0) return rarityDiff;
        return Number(b.maxDamage - a.maxDamage);
      });
  }, [weaponTemplates, itemsOwnersTable, ownerKey, character.owner, isLoadingItemTemplates]);

  const inventoryQuestItems = useMemo(() => {
    if (isLoadingItemTemplates || questItemTemplates.length === 0) return [];
    return questItemTemplates
      .map(qi => {
        const compositeKey = encodeCompositeKey(ownerKey, encodeUint256Key(BigInt(qi.tokenId)));
        const itemOwner = itemsOwnersTable[compositeKey];
        return {
          ...qi,
          balance: itemOwner ? toBigInt(itemOwner.balance) : BigInt(0),
          itemId: compositeKey,
          owner: character.owner,
        };
      })
      .filter(qi => qi.balance !== BigInt(0))
      .sort((a, b) => (b.rarity ?? 0) - (a.rarity ?? 0));
  }, [questItemTemplates, itemsOwnersTable, ownerKey, character.owner, isLoadingItemTemplates]);

  // Equipped items derived from inventory + equipment IDs — fully synchronous
  const equippedArmor = useMemo(() =>
    equippedArmorIds.map(id => inventoryArmor.find(a => a.tokenId === id.toString())).filter(Boolean) as Armor[],
    [equippedArmorIds, inventoryArmor]);

  const equippedSpells = useMemo(() =>
    equippedSpellIds.map(id => inventorySpells.find(s => s.tokenId === id.toString())).filter(Boolean) as Spell[],
    [equippedSpellIds, inventorySpells]);

  const equippedWeapons = useMemo(() =>
    equippedWeaponIds.map(id => inventoryWeapons.find(w => w.tokenId === id.toString())).filter(Boolean) as Weapon[],
    [equippedWeaponIds, inventoryWeapons]);

  const maxArmorEquipped = equippedArmorIds.length === MAX_EQUIPPED_ARMOR;
  const totalMoveSlots = equippedWeaponIds.length + equippedSpellIds.length + equippedConsumableIds.length;
  const maxWeaponsEquipped = totalMoveSlots >= MAX_EQUIPPED_WEAPONS;

  const armorInInventory = useMemo(() => {
    return inventoryArmor
      .reduce((acc, item) => {
        return acc + item.balance;
      }, BigInt(0))
      .toString();
  }, [inventoryArmor]);

  const weaponsInInventory = useMemo(() =>
    inventoryWeapons.reduce((acc, item) => acc + item.balance, BigInt(0)).toString(),
    [inventoryWeapons]);

  const spellsInInventory = useMemo(() =>
    inventorySpells.reduce((acc, item) => acc + item.balance, BigInt(0)).toString(),
    [inventorySpells]);

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
        color="#E8DCC8"
        bgColor="#1C1814"
        h="68px"
        justifyContent="space-between"
        px={6}
      >
        <Text color="#E8DCC8" fontWeight={700} size={{ base: 'lg', sm: 'xl' }}>
          Items Inventory
        </Text>
        <Text color="#E8DCC8" fontWeight={500} size={{ base: 'md', sm: 'lg' }}>
          Total:{' '}
          {inventoryArmor.length +
            inventoryWeapons.length +
            inventorySpells.length +
            inventoryConsumables.length}
        </Text>
      </HStack>
      <PolygonalCard clipPath="none" p={6}>
        <Text fontFamily="heading" fontWeight="bold" color="#E8DCC8" mt={{ base: 8, lg: 0 }} size="lg">
          Armor ({armorInInventory})
          <Text as="span" fontFamily="body" fontWeight={400} size="sm" color="#8A7E6A" ml={2}>
            {equippedArmor.length}/{MAX_EQUIPPED_ARMOR} equipped
          </Text>
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
          {inventoryArmor.length === 0 && <Text color="#8A7E6A" fontStyle="italic" size="sm">{t('inventory.noArmor')}</Text>}
          {inventoryArmor.map((ar, i) => {
            const isEquipped = equippedArmorIds.includes(BigInt(ar.tokenId));
            return (
              <GridItem key={i}>
                <ItemCard
                  isEquipped={isEquipped}
                  onClick={() => {
                    setSelectedItem(ar);
                    onOpenItemModal();
                  }}
                  {...ar}
                />
              </GridItem>
            );
          })}
        </Grid>
        <Box h="1px" boxShadow={DARK_DIVIDER_SHADOW} my={{ base: 4, lg: 6 }} />
        <Text fontFamily="heading" fontWeight="bold" color="#E8DCC8" mt={{ base: 8, lg: 12 }} size="lg">
          Weapons ({weaponsInInventory})
          <Text as="span" fontFamily="body" fontWeight={400} size="sm" color="#8A7E6A" ml={2}>
            {totalMoveSlots}/{MAX_EQUIPPED_WEAPONS} action slots used
          </Text>
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
          {inventoryWeapons.length === 0 && <Text color="#8A7E6A" fontStyle="italic" size="sm">{t('inventory.noWeapons')}</Text>}
          {inventoryWeapons.map((item, i) => {
            const isEquipped = equippedWeaponIds.includes(
              BigInt(item.tokenId),
            );
            return (
              <GridItem key={i}>
                <ItemCard
                  isEquipped={isEquipped}
                  onClick={() => {
                    setSelectedItem(item);
                    onOpenItemModal();
                  }}
                  {...item}
                />
              </GridItem>
            );
          })}
        </Grid>
        <Box h="1px" boxShadow={DARK_DIVIDER_SHADOW} my={{ base: 4, lg: 6 }} />
        <Text fontFamily="heading" fontWeight="bold" color="#E8DCC8" mt={{ base: 8, lg: 12 }} size="lg">
          Spells ({spellsInInventory})
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
          {inventorySpells.length === 0 && <Text color="#8A7E6A" fontStyle="italic" size="sm">{t('inventory.noSpells')}</Text>}
          {inventorySpells.map((item, i) => {
            const isEquipped = equippedSpellIds.includes(
              BigInt(item.tokenId),
            );
            return (
              <GridItem key={i}>
                <ItemCard
                  isEquipped={isEquipped}
                  onClick={() => {
                    setSelectedItem(item);
                    onOpenItemModal();
                  }}
                  {...item}
                />
              </GridItem>
            );
          })}
        </Grid>
        <Box h="1px" boxShadow={DARK_DIVIDER_SHADOW} my={{ base: 4, lg: 6 }} />
        <Text fontFamily="heading" fontWeight="bold" color="#E8DCC8" mt={{ base: 8, lg: 12 }} size="lg">
          Consumables ({consumablesInInventory})
          <Text as="span" fontFamily="body" fontWeight={400} size="sm" color="#8A7E6A" ml={2}>
            {equippedConsumableIds.length} equipped — {totalMoveSlots}/{MAX_EQUIPPED_WEAPONS} action slots used
          </Text>
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
          {inventoryConsumables.length === 0 && <Text color="#8A7E6A" fontStyle="italic" size="sm">{t('inventory.noConsumables')}</Text>}
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
        {SHOW_Z2 && inventoryQuestItems.length > 0 && (
          <>
            <Box h="1px" boxShadow={DARK_DIVIDER_SHADOW} my={{ base: 4, lg: 6 }} />
            <Text fontFamily="heading" fontWeight="bold" color="#E8DCC8" mt={{ base: 8, lg: 12 }} size="lg">
              Quest Items ({inventoryQuestItems.length})
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
              {inventoryQuestItems.map((qi, i) => (
                <GridItem key={i}>
                  <Box
                    border="1px solid"
                    borderColor="#3A3428"
                    borderRadius="md"
                    p={3}
                    bg="rgba(155, 175, 191, 0.04)"
                  >
                    <Text fontWeight="bold" fontSize="sm" color="#E8DCC8">
                      {qi.name}
                    </Text>
                    {qi.description && (
                      <Text fontSize="xs" color="#8A7E6A" mt={1} fontStyle="italic" noOfLines={3}>
                        {qi.description}
                      </Text>
                    )}
                    <Text fontSize="2xs" color="#6A6055" mt={1}>
                      Permanent memento
                    </Text>
                  </Box>
                </GridItem>
              ))}
            </Grid>
          </>
        )}
        {selectedItem && (
          <ItemEquipModal
            isEquipped={
              equippedArmorIds.includes(BigInt(selectedItem?.tokenId ?? 0)) ||
              equippedWeaponIds.includes(BigInt(selectedItem?.tokenId ?? 0)) ||
              equippedSpellIds.includes(BigInt(selectedItem?.tokenId ?? 0))
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
