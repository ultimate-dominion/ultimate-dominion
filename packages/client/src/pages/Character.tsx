import {
  Avatar,
  Box,
  Button,
  Card,
  CardBody,
  Center,
  Grid,
  GridItem,
  Heading,
  HStack,
  Icon,
  IconProps,
  Spacer,
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
import { IoMdInformationCircleOutline } from 'react-icons/io';
import { IoChatbubble } from 'react-icons/io5';
import { useNavigate, useParams } from 'react-router-dom';
import { hexToBigInt, hexToString, zeroHash } from 'viem';
import { useAccount } from 'wagmi';

import { ClassSymbol } from '../components/ClassSymbol';
import { EditCharacterModal } from '../components/EditCharacterModal';
import { ItemCard } from '../components/ItemCard';
import { ItemConsumeModal } from '../components/ItemConsumeModal';
import { ItemEquipModal } from '../components/ItemEquipModal';
import { Level } from '../components/Level';
import { LevelingPanel } from '../components/LevelingPanel';
import { useCharacter } from '../contexts/CharacterContext';
import { useItems } from '../contexts/ItemsContext';
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

const MarketplaceIcon = (props: IconProps) => (
  <Icon
    {...props}
    width="26"
    height="26"
    viewBox="0 0 26 26"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M1.85814 22.3131H0.929069C0.415747 22.3131 0 21.9006 0 21.3913C0 20.882 0.415747 20.4696 0.929069 20.4696H15.7942C16.3075 20.4696 16.7232 20.882 16.7232 21.3913C16.7232 21.9006 16.3075 22.3131 15.7942 22.3131H14.8651V24.3409C14.8651 24.69 14.7316 25.0322 14.447 25.3225C14.087 25.6901 13.3798 26 12.5425 26H4.18084C3.34352 26 2.63627 25.6901 2.27626 25.3225C1.99174 25.0322 1.8582 24.69 1.8582 24.3409L1.85814 22.3131ZM19.586 9.14828L13.6735 15.0141C13.6886 15.1212 13.6967 15.2307 13.6967 15.3401C13.6967 15.9508 13.4517 16.5373 13.0162 16.9693L12.3589 17.6214C11.9234 18.0535 11.3334 18.2966 10.7179 18.2966C10.1013 18.2966 9.5113 18.0535 9.07465 17.6214L5.13302 13.7109C4.69753 13.2788 4.45246 12.6924 4.45246 12.0817C4.45246 11.4699 4.69751 10.8835 5.13302 10.4514L5.79032 9.80046C6.22581 9.36841 6.81694 9.12528 7.43244 9.12528C7.54277 9.12528 7.6531 9.13334 7.76111 9.14832L13.6736 3.28253C13.6585 3.17538 13.6503 3.06592 13.6503 2.95646C13.6503 2.34581 13.8954 1.75935 14.3309 1.3273L14.9882 0.675184C15.4237 0.243132 16.0136 0 16.6291 0C17.2458 0 17.8358 0.243109 18.2724 0.675184L22.2141 4.58571C22.6495 5.01776 22.8946 5.60422 22.8946 6.21487C22.8946 6.82666 22.6496 7.41313 22.2141 7.84518L21.5568 8.49614C21.1213 8.92938 20.5301 9.17133 19.9146 9.17133C19.8043 9.17133 19.694 9.16326 19.586 9.14828ZM20.047 11.5621L25.1743 16.6477C26.2752 17.74 26.2752 19.512 25.1743 20.6043L25.172 20.6066C24.0977 21.6723 22.3557 21.6723 21.2815 20.6066L16.1066 15.4726L20.047 11.5621Z"
      fill="black"
    />
  </Icon>
);

const LeaderboardIcon = (props: IconProps) => (
  <Icon
    {...props}
    width="27"
    height="26"
    viewBox="0 0 27 26"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M25.7159 9.58634H18.4534V1.26035C18.4534 1.11664 18.3261 1 18.1693 1H8.83068C8.67386 1 8.54659 1.11664 8.54659 1.26035V14H1V24H26L26 9.84669C26 9.70246 25.8722 9.58634 25.7159 9.58634ZM15.0347 7.94562C14.5506 7.80815 14.0813 7.62747 13.6352 7.40565C13.5932 7.3843 13.5466 7.37389 13.5 7.37389C13.4534 7.37389 13.4068 7.3843 13.3648 7.40565C12.9188 7.62747 12.4494 7.80815 11.9653 7.94562C11.958 7.48063 12.0011 7.01617 12.0932 6.55847C12.1108 6.47204 12.0795 6.38352 12.0102 6.3226C11.6426 6.00341 11.3097 5.65037 11.0176 5.27026C11.496 5.12082 11.992 5.01408 12.496 4.95472C12.5915 4.94326 12.6739 4.88755 12.7159 4.8084C12.9347 4.38767 13.1983 3.99038 13.5017 3.6186C13.8051 3.99038 14.0688 4.38872 14.2875 4.8084C14.329 4.88755 14.4119 4.94326 14.5074 4.95472C15.0114 5.01408 15.5074 5.12082 15.9858 5.27026C15.6938 5.65037 15.3608 6.00341 14.9932 6.3226C14.9239 6.38352 14.892 6.47204 14.9102 6.55847C14.9994 7.01617 15.042 7.48115 15.0347 7.94562Z"
      fill="black"
    />
  </Icon>
);

export const CharacterPage = (): JSX.Element => {
  const { id } = useParams();
  const { renderError } = useToast();
  const navigate = useNavigate();
  const { isConnected } = useAccount();

  const {
    components: {
      AdventureEscrow,
      Characters,
      CharactersTokenURI,
      EncounterEntity,
      GoldBalances,
      Levels,
      Stats,
      StatusEffectStats,
      StatusEffectValidity,
      WorldStatusEffects,
    },
    isSynced,
    network: { publicClient, worldContract },
  } = useMUD();
  const { character: userCharacter } = useCharacter();

  const {
    isOpen: isEditModalOpen,
    onClose: onCloseEditModal,
    onOpen: onOpenEditModal,
  } = useDisclosure();

  const [character, setCharacter] = useState<Character | null>(null);
  const [isLoadingCharacter, setIsLoadingCharacter] = useState(true);

  useEffect(() => {
    if (!isConnected) {
      navigate(HOME_PATH);
      window.location.reload();
    }
  }, [isConnected, navigate]);

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

      const externalGoldBalance =
        getComponentValue(GoldBalances, ownerEntity)?.value ?? BigInt(0);
      const escrowGoldBalance =
        getComponentValue(AdventureEscrow, id as Entity)?.balance ?? BigInt(0);

      const metadataURI = getComponentValueStrict(
        CharactersTokenURI,
        tokenIdEntity,
      ).tokenURI;

      const fetachedMetadata = await fetchMetadataFromUri(
        uriToHttp(`ipfs://${metadataURI}`)[0],
      );

      const { encounterId, pvpTimer } = getComponentValue(
        EncounterEntity,
        id as Entity,
      ) ?? { encounterId: zeroHash, pvpTimer: BigInt(0) };
      const inBattle = !!encounterId && encounterId !== zeroHash;

      const decodedBaseStats = decodeBaseStats(characterData.baseStats);

      const worldStatusEffectsComponent = getComponentValue(
        WorldStatusEffects,
        id as Entity,
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
        level: characterStats.level,
        locked: characterData.locked,
        maxHp: characterStats.maxHp,
        name: hexToString(characterData.name as `0x${string}`, {
          size: 32,
        }),
        owner: characterData.owner,
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
    StatusEffectStats,
    StatusEffectValidity,
    worldContract,
    WorldStatusEffects,
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

  const currentLevelXpRequirement =
    useComponentValue(
      Levels,
      character
        ? encodeEntity(
            { level: 'uint256' },
            { level: BigInt(Number(character.level) - 1) },
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
            border="6px solid #1A244E"
            colSpan={{ base: 1, sm: 1, md: 1, lg: 1, xl: 1 }}
            colStart={{ base: 1, sm: 1, md: 1, lg: 1, xl: 1 }}
            p={6}
            position="relative"
          >
            <Box
              border="solid 1px #3B82C4"
              bottom="5px"
              left="5px"
              position="absolute"
              right="5px"
              top="5px"
            />
            <VStack h="100%">
              <Box w="100%">
                <VStack alignItems="start" spacing={0}>
                  <HStack>
                    <Text color="#DCCD4D" fontWeight={700} fontSize="24px">
                      {etherToFixedNumber(character.externalGoldBalance)} $GOLD
                    </Text>
                    <Tooltip
                      bg="black"
                      hasArrow
                      label="This is your external wallet's $GOLD balance. You can use this to buy items in the Marketplace and various shops. To withdraw from or deposit $GOLD into your Adventure Escrow, visit 0,0 on the map."
                      placement="top"
                      shouldWrapChildren
                    >
                      <IoMdInformationCircleOutline />
                    </Tooltip>
                  </HStack>
                  <HStack>
                    <Text
                      color="#3D4247"
                      fontSize="xs"
                      fontWeight="bold"
                      textAlign="start"
                    >
                      Adventure Escrow balance:{' '}
                      {etherToFixedNumber(character.escrowGoldBalance)} $GOLD
                    </Text>
                    <Tooltip
                      bg="black"
                      hasArrow
                      label="Your Adventure Escrow is where $GOLD goes when you win battles. Leaving $GOLD in your escrow will help you level up faster, but in the Outer Realms, you run the risk of losing it all against other players. You can withdraw your $GOLD at 0,0 on the map."
                      placement="top"
                      shouldWrapChildren
                    >
                      <IoMdInformationCircleOutline />
                    </Tooltip>
                  </HStack>
                </VStack>
                <HStack justify="space-between" mt={4}>
                  <Text color="#3D4247" fontWeight="bold">
                    Level {character.level.toString()}
                  </Text>
                  <Text>
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
                <Level
                  currentLevel={character.level}
                  levelPercent={levelPercent}
                  maxed={maxed}
                />
              </Box>

              <Spacer />
              <Box alignSelf="start" w="100%">
                <Button
                  backgroundColor="#BAC2CA"
                  borderRadius="8px"
                  boxShadow="-10px -10px 20px 0px #54545440, 5px 5px 10px 0px #54545480;"
                  fontSize="14px"
                  height="50px"
                  leftIcon={isOwner ? <MarketplaceIcon /> : <IoChatbubble />}
                  m="5px 0"
                  w="100%"
                  onClick={() => {
                    if (isOwner) {
                      navigate(MARKETPLACE_PATH);
                    }
                  }}
                  variant="ghost"
                >
                  {isOwner ? <Text>{} Marketplace</Text> : <Text>Chat</Text>}
                </Button>
                <Button
                  backgroundColor="#BAC2CA"
                  borderRadius="8px"
                  boxShadow="-10px -10px 20px 0px #54545440, 5px 5px 10px 0px #54545480;"
                  fontSize="14px"
                  height="50px"
                  leftIcon={<LeaderboardIcon />}
                  m="5px 0"
                  onClick={() => navigate(LEADERBOARD_PATH)}
                  w="100%"
                  variant="ghost"
                >
                  Leader Board
                </Button>
              </Box>
            </VStack>
          </GridItem>
          <GridItem
            border="6px solid #1A244E"
            colSpan={{ base: 1, sm: 1, md: 1, lg: 1, xl: 1 }}
            colStart={{ base: 1, sm: 1, md: 1, lg: 2, xl: 2 }}
            position="relative"
          >
            <Box
              border="solid 1px #3B82C4"
              bottom="5px"
              left="5px"
              position="absolute"
              right="5px"
              top="5px"
            />
            <LevelingPanel canLevel={canLevel} character={character} />
          </GridItem>
          <GridItem
            border="6px solid #1A244E"
            colSpan={{ base: 1, sm: 1, md: 1, lg: 1, xl: 1 }}
            colStart={{ base: 1, sm: 1, md: 1, lg: 3, xl: 3 }}
            position="relative"
          >
            <Box
              border="solid 1px #3B82C4"
              bottom="5px"
              left="5px"
              position="absolute"
              right="5px"
              top="5px"
            ></Box>
            <Box h="100%" position="relative">
              <VStack>
                <HStack
                  color="white"
                  backgroundColor="#0C1539"
                  height="120px"
                  px={6}
                  w="100%"
                >
                  <Center>
                    <Avatar size="lg" src={character.image} />
                    <Heading fontSize="24px" margin="0px 20px" size="lg">
                      {character.name}
                    </Heading>
                    <ClassSymbol entityClass={character.entityClass} />
                  </Center>
                  <Spacer />
                </HStack>
                <Spacer />
                <Box p={6} w="100%">
                  <Text overflow="hidden" size="sm" textAlign="left">
                    {character.description}
                  </Text>
                  {isOwner && (
                    <Button
                      bottom={6}
                      onClick={onOpenEditModal}
                      position="absolute"
                      right={6}
                      size="sm"
                      variant="ghost"
                    >
                      Edit Character
                    </Button>
                  )}
                </Box>
              </VStack>
            </Box>
          </GridItem>
          <GridItem
            colSpan={{ base: 1, sm: 1, md: 1, lg: 3, xl: 3 }}
            colStart={{ base: 1, sm: 1, md: 1, lg: 1, xl: 1 }}
            pb={{ base: 12, lg: 0 }}
            border="6px solid #1A244E"
            position="relative"
          >
            <Box
              color="white"
              backgroundColor="#1A244E"
              display="table"
              fontSize="24px"
              fontWeight={700}
              h="68px"
              px="20px"
              w="100%"
            >
              <HStack h="100%">
                <Text color="white" size="24px" fontWeight="700">
                  Items Inventory
                </Text>{' '}
                <Spacer></Spacer>
                <Text color="white" size="24px" fontWeight="700">
                  1/50
                </Text>
              </HStack>{' '}
            </Box>
            <Box
              border="solid 1px #3B82C4"
              bottom="5px"
              left="5px"
              position="absolute"
              right="5px"
              top="5px"
            ></Box>
            <Box p={6}>
              <ItemsPanel character={character} />
            </Box>
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
    </Box>
  );
};

const ItemsPanel = ({ character }: { character: Character }): JSX.Element => {
  const { renderError } = useToast();
  const {
    components: { CharacterEquipment, ItemsOwners },
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
    if (isLoadingItemTemplates) return;

    const {
      equippedArmor: equippedArmorIds,
      equippedSpells: equippedSpellsIds,
      equippedWeapons: equippedWeaponsIds,
    } = getComponentValue(CharacterEquipment, character.id) ??
    ({ equippedArmor: [], equippedSpells: [], equippedWeapons: [] } as {
      equippedArmor: bigint[];
      equippedSpells: bigint[];
      equippedWeapons: bigint[];
    });

    fetchCharacterItems(
      character,
      equippedArmorIds,
      equippedSpellsIds,
      equippedWeaponsIds,
    );
  }, [
    character,
    CharacterEquipment,
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

  const maxArmorEquipped = equippedArmorIds.length === MAX_EQUIPPED_ARMOR;
  const maxWeaponsEquipped =
    equippedSpellsAndWeaponsIds.length === MAX_EQUIPPED_WEAPONS;

  if (isLoadingItemTemplates) {
    return (
      <Center h="100%">
        <Spinner size="lg" />
      </Center>
    );
  }

  return (
    <Box>
      <Text fontWeight="bold" mt={{ base: 8, lg: 0 }} size="lg">
        Armor {inventoryArmor.length} - {equippedArmor.length}/
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
        {inventoryArmor.length === 0 && <Text>No armor found</Text>}
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
        Weapons & Spells {spellsAndWeapons.length} -{' '}
        {equippedSpellsAndWeaponsIds.length}/{MAX_EQUIPPED_WEAPONS} equipped{' '}
      </Text>
      {maxWeaponsEquipped && <Text fontSize="sm">(Max weapons equipped)</Text>}
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
        {spellsAndWeapons.length === 0 && <Text>No weapons found</Text>}
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
        Consumables {inventoryConsumables.length}
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
        {/* {inventoryConsumables.length === 0 && <Text>No consumables found</Text>} */}
        {inventoryConsumables.map((consumable, i) => {
          return (
            <GridItem key={i}>
              <ItemCard
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
          isOpen={isConsumableModalOpen}
          onClose={() => {
            onCloseConsumableModal();
            setSelectedConsumable(null);
          }}
          {...selectedConsumable}
        />
      )}
    </Box>
  );
};
