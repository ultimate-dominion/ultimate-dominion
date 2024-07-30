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
  Spacer,
  Spinner,
  Text,
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
import {
  decodeEntity,
  encodeEntity,
  singletonEntity,
} from '@latticexyz/store-sync/recs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FaHatWizard } from 'react-icons/fa';
import { GiAxeSword, GiRogue } from 'react-icons/gi';
import { useNavigate, useParams } from 'react-router-dom';
import { formatEther, hexToString, zeroHash } from 'viem';

import { EditCharacterModal } from '../components/EditCharacterModal';
import { ItemCard } from '../components/ItemCard';
import { ItemEquipModal } from '../components/ItemEquipModal';
import { Level } from '../components/Level';
import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { LEADERBOARD_PATH } from '../Routes';
import { MAX_EQUIPPED_WEAPONS } from '../utils/constants';
import {
  decodeCharacterId,
  fetchMetadataFromUri,
  uriToHttp,
} from '../utils/helpers';
import {
  type Character,
  ItemType,
  StatsClasses,
  type Weapon,
} from '../utils/types';

export const CharacterPage = (): JSX.Element => {
  const { characterId } = useParams();
  const { renderError } = useToast();
  const navigate = useNavigate();

  const {
    components: {
      CharacterEquipment,
      Characters,
      CharactersTokenURI,
      GoldBalances,
      Items,
      ItemsBaseURI,
      ItemsOwners,
      ItemsTokenURI,
      Levels,
      MatchEntity,
      Stats,
    },
    isSynced,
    network: { publicClient, worldContract },
  } = useMUD();
  const { character: userCharacter } = useCharacter();

  const {
    isOpen: isItemModalOpen,
    onClose: onCloseItemModal,
    onOpen: onOpenItemModal,
  } = useDisclosure();
  const {
    isOpen: isEditModalOpen,
    onClose: onCloseEditModal,
    onOpen: onOpenEditModal,
  } = useDisclosure();

  const [character, setCharacter] = useState<Character | null>(null);
  const [isLoadingCharacter, setIsLoadingCharacter] = useState(true);
  const [items, setItems] = useState<Weapon[] | null>(null);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [selectedItem, setSelectedItem] = useState<Weapon | null>(null);

  const equippedWeapons =
    useComponentValue(CharacterEquipment, characterId as Entity | undefined)
      ?.equippedWeapons ?? [];

  const fetchCharacter = useCallback(async () => {
    try {
      if (!(characterId && publicClient && worldContract)) return null;
      setIsLoadingCharacter(true);

      const characterData = getComponentValue(
        Characters,
        characterId as Entity,
      );
      const characterStats = getComponentValue(Stats, characterId as Entity);

      if (!(characterData && characterStats)) return null;

      const ownerEntity = encodeEntity(
        { address: 'address' },
        { address: characterData.owner as `0x${string}` },
      );
      const tokenIdEntity = encodeEntity(
        { tokenId: 'uint256' },
        { tokenId: characterData.tokenId },
      );

      const goldBalance =
        getComponentValue(GoldBalances, ownerEntity)?.value ?? BigInt(0);
      const metadataURI = getComponentValueStrict(
        CharactersTokenURI,
        tokenIdEntity,
      ).tokenURI;

      const fetachedMetadata = await fetchMetadataFromUri(
        uriToHttp(`ipfs://${metadataURI}`)[0],
      );

      const encounterId = getComponentValue(
        MatchEntity,
        characterId as Entity,
      )?.encounterId;
      const inBattle = !!encounterId && encounterId !== zeroHash;

      const _character = {
        ...fetachedMetadata,
        agility: characterStats.agility.toString(),
        baseHp: characterStats.baseHp.toString(),
        entityClass: characterStats.class,
        characterId: characterId as Entity,
        currentHp: characterStats.currentHp.toString(),
        experience: characterStats.experience.toString(),
        goldBalance: formatEther(goldBalance as bigint).toString(),
        inBattle,
        intelligence: characterStats.intelligence.toString(),
        level: characterStats.level.toString(),
        locked: characterData.locked,
        name: hexToString(characterData.name as `0x${string}`, {
          size: 32,
        }),
        owner: characterData.owner,
        strength: characterStats.strength.toString(),
        tokenId: characterData.tokenId.toString(),
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
    characterId,
    Characters,
    CharactersTokenURI,
    GoldBalances,
    MatchEntity,
    renderError,
    Stats,
    publicClient,
    worldContract,
  ]);

  const fetchCharacterItems = useCallback(
    async (_character: Character) => {
      try {
        const _items = Array.from(runQuery([Has(ItemsOwners)]))
          .map(entity => {
            const itemdBalance = getComponentValueStrict(
              ItemsOwners,
              entity,
            ).balance;

            const { owner, tokenId } = decodeEntity(
              { owner: 'address', tokenId: 'uint256' },
              entity,
            );

            const tokenIdEntity = encodeEntity(
              { tokenId: 'uint256' },
              { tokenId },
            );

            const itemTemplate = getComponentValueStrict(Items, tokenIdEntity);

            return {
              balance: itemdBalance.toString(),
              itemId: entity,
              itemType: itemTemplate.itemType,
              owner,
              tokenId: tokenId.toString(),
              tokenIdEntity,
            };
          })
          .filter(
            item =>
              item.owner === _character.owner &&
              item.itemType === ItemType.Weapon,
          )
          .sort((a, b) => {
            return Number(a.tokenId) - Number(b.tokenId);
          });

        const fullItems = await Promise.all(
          _items.map(async item => {
            const itemTemplateStats =
              await worldContract.read.UD__getWeaponStats([
                BigInt(item.tokenId),
              ]);

            const baseURI = getComponentValueStrict(
              ItemsBaseURI,
              singletonEntity,
            ).uri;

            const tokenURI = getComponentValueStrict(
              ItemsTokenURI,
              item.tokenIdEntity,
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

        setItems(fullItems);
      } catch (e) {
        renderError(
          (e as Error)?.message ?? 'Failed to fetch character items.',
          e,
        );
      } finally {
        setIsLoadingItems(false);
      }
    },
    [
      Items,
      ItemsBaseURI,
      ItemsOwners,
      ItemsTokenURI,
      renderError,
      worldContract,
    ],
  );

  const isOwner = useMemo(() => {
    if (!(userCharacter && characterId)) return false;
    const { ownerAddress } = decodeCharacterId(characterId as `0x${string}`);
    return userCharacter.owner.toLowerCase() === ownerAddress;
  }, [userCharacter, characterId]);

  useEffect(() => {
    if (!isSynced) return;
    (async (): Promise<void> => {
      if (isOwner && userCharacter) {
        setCharacter(userCharacter);
        await fetchCharacterItems(userCharacter);
        setIsLoadingCharacter(false);
        return;
      }
      const _character = await fetchCharacter();

      if (!_character) return;
      await fetchCharacterItems(_character);
    })();
  }, [fetchCharacter, fetchCharacterItems, isOwner, isSynced, userCharacter]);

  const maxItemsEquipped = equippedWeapons.length === MAX_EQUIPPED_WEAPONS;

  const nextLevelXpRequirement =
    useComponentValue(
      Levels,
      encodeEntity(
        { level: 'uint256' },
        { level: BigInt(Number(character?.level ?? 0) + 1) },
      ),
    )?.experience ?? BigInt(0);

  const levelPercent = useMemo(() => {
    if (!character) return 0;
    const percent =
      (100 * Number(character.experience)) / Number(nextLevelXpRequirement);
    return percent > 100 ? 100 : percent;
  }, [character, nextLevelXpRequirement]);

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
          mt={4}
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
          templateRows={{
            base: 'repeat(4, 1fr)',
            sm: 'repeat(4, 1fr)',
            lg: 'repeat(2, 1fr)',
            xl: 'repeat(2, 1fr)',
          }}
        >
          <GridItem
            border="solid"
            colSpan={{ base: 1, sm: 1, md: 1, lg: 1, xl: 1 }}
            colStart={{ base: 1, sm: 1, md: 1, lg: 1, xl: 1 }}
            pb={6}
            pt={{ base: 6, md: 12 }}
            px={6}
            rowStart={{ base: 1, sm: 1, md: 1, lg: 1, xl: 1 }}
          >
            <Box h="100%" position="relative">
              <VStack>
                <HStack w="100%">
                  <Center>
                    <Avatar size="lg" src={character.image} />
                    <Heading margin="0px 20px" size="lg">
                      {character.name}
                    </Heading>
                  </Center>
                  <Spacer />
                  <Center>
                    {character.entityClass === StatsClasses.Warrior && (
                      <GiAxeSword size={28} />
                    )}
                    {character.entityClass === StatsClasses.Rogue && (
                      <GiRogue size={28} />
                    )}
                    {character.entityClass === StatsClasses.Mage && (
                      <FaHatWizard size={28} />
                    )}
                  </Center>
                </HStack>
                <Spacer />
                <Box mt={3} w="100%">
                  <Text overflow="hidden" size="sm" textAlign="left">
                    {character.description}
                  </Text>
                  {isOwner && (
                    <Button
                      bottom="0"
                      onClick={onOpenEditModal}
                      position="absolute"
                      right="0"
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
            border="solid"
            colSpan={{ base: 1, sm: 1, md: 1, lg: 1, xl: 1 }}
            colStart={{ base: 1, sm: 1, md: 1, lg: 2, xl: 2 }}
            pb={6}
            pt={{ base: 6, md: 12 }}
            px={6}
            rowStart={{ base: 2, sm: 2, md: 2, lg: 1, xl: 1 }}
          >
            <VStack>
              <HStack justify="space-between" w="100%">
                <Text alignSelf="start" fontWeight="bold">
                  My Stats
                </Text>
                <Text alignSelf="start" fontWeight="bold">
                  Ability Points: 3
                </Text>
              </HStack>
              <Text alignSelf="end" mt={4} size="xs">
                Base
              </Text>
              <VStack w="100%">
                <HStack justify="space-between" w="100%">
                  <Text size="lg">HP - Hit</Text>
                  <Text size="lg">
                    {character.currentHp}/{character.baseHp}
                  </Text>
                </HStack>

                <HStack justify="space-between" w="100%">
                  <Text size="lg">STR - Strength</Text>
                  <Text size="lg">{character.strength}</Text>
                </HStack>

                <HStack justify="space-between" w="100%">
                  <Text size="lg">AGI - Agility</Text>
                  <Text size="lg">{character.agility}</Text>
                </HStack>

                <HStack justify="space-between" w="100%">
                  <Text size="lg">INT - Intelligence</Text>
                  <Text size="lg">{character.intelligence}</Text>
                </HStack>
              </VStack>
            </VStack>
          </GridItem>
          <GridItem
            border="solid"
            colSpan={{ base: 1, sm: 1, md: 1, lg: 1, xl: 1 }}
            colStart={{ base: 1, sm: 1, md: 1, lg: 3, xl: 3 }}
            rowStart={{ base: 3, sm: 3, md: 3, lg: 1, xl: 1 }}
            pb={6}
            pt={{ base: 6, md: 12 }}
            px={6}
          >
            <VStack h="100%">
              <Box w="100%">
                <HStack alignItems="start">
                  <Box>
                    <Text fontWeight="bold">
                      {Number(character.goldBalance).toLocaleString('en', {
                        useGrouping: true,
                      })}{' '}
                      $GOLD
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
                        {BigInt(character.experience) >= nextLevelXpRequirement
                          ? nextLevelXpRequirement.toString()
                          : character.experience}
                      </Text>
                      /{nextLevelXpRequirement.toString()}
                    </Text>
                  </Box>
                  <Spacer />
                  <Text fontWeight="bold">Level 1</Text>
                </HStack>
                <Level
                  currentLevel={character.level}
                  levelPercent={levelPercent}
                />
              </Box>

              <Spacer />
              <Box alignSelf="start" w="100%">
                <Button m="5px 0" w="100%">
                  {isOwner ? 'Auction House' : 'Chat'}
                </Button>
                <Button
                  m="5px 0"
                  onClick={() => navigate(LEADERBOARD_PATH)}
                  w="100%"
                >
                  Leaderboard
                </Button>
              </Box>
            </VStack>
          </GridItem>
          <GridItem
            colSpan={{ base: 1, sm: 1, md: 1, lg: 3, xl: 3 }}
            colStart={{ base: 1, sm: 1, md: 1, lg: 1, xl: 1 }}
            pb={{ base: 12, lg: 0 }}
            rowSpan={{ base: 1, sm: 1, md: 1, lg: 1, xl: 1 }}
            rowStart={{ base: 4, sm: 4, md: 4, lg: 2, xl: 2 }}
          >
            {items ? (
              <>
                <Text fontWeight="bold" mt={{ base: 8, lg: 0 }} size="lg">
                  Items {items.length} - {equippedWeapons.length}/
                  {MAX_EQUIPPED_WEAPONS} equipped{' '}
                </Text>
                {maxItemsEquipped && (
                  <Text fontSize="sm">(Max items equipped)</Text>
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
                  {items.map(function (item, i) {
                    const isEquipped = equippedWeapons.includes(
                      BigInt(item.tokenId),
                    );
                    return (
                      <GridItem key={i}>
                        <ItemCard
                          {...item}
                          isEquipped={isEquipped}
                          onClick={
                            maxItemsEquipped && !isEquipped
                              ? undefined
                              : () => {
                                  setSelectedItem(item);
                                  onOpenItemModal();
                                }
                          }
                        />
                      </GridItem>
                    );
                  })}
                </Grid>
              </>
            ) : isLoadingItems ? (
              <Center h="100%">
                <Spinner size="lg" />
              </Center>
            ) : (
              <Text textAlign="center">Error loading items</Text>
            )}
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
      <ItemEquipModal
        isEquipped={equippedWeapons.includes(
          BigInt(selectedItem?.tokenId ?? 0),
        )}
        isOpen={isItemModalOpen}
        onClose={() => {
          onCloseItemModal();
          setSelectedItem(null);
        }}
        {...(selectedItem as Weapon)}
      />
    </Box>
  );
};
