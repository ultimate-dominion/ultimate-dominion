import {
  Avatar,
  Button,
  Grid,
  GridItem,
  HStack,
  Link,
  Spacer,
  Spinner,
  Text,
  useBreakpointValue,
  VStack,
} from '@chakra-ui/react';
import { useComponentValue } from '@latticexyz/react';
import { getComponentValue, getComponentValueStrict } from '@latticexyz/recs';
import { encodeEntity, singletonEntity } from '@latticexyz/store-sync/recs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { GiRogue } from 'react-icons/gi';
import { IoIosArrowForward } from 'react-icons/io';
import { useNavigate } from 'react-router-dom';

import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { LEADERBOARD_PATH } from '../Routes';
import { MAX_EQUIPPED_WEAPONS } from '../utils/constants';
import { fetchMetadataFromUri, uriToHttp } from '../utils/helpers';
import type { Character, StatsClasses, Weapon } from '../utils/types';
import { Level } from './Level';

const CURRENT_LEVEL = 1;

export const StatsPanel = (): JSX.Element => {
  const navigate = useNavigate();
  const { renderError } = useToast();
  const isDesktop = useBreakpointValue({ base: false, lg: true });
  const {
    components: {
      CharacterEquipment,
      ItemsBaseURI,
      ItemsOwners,
      ItemsTokenURI,
      Levels,
    },
    isSynced,
    network: { worldContract },
  } = useMUD();
  const { character } = useCharacter();

  const [items, setItems] = useState<Weapon[] | null>(null);

  const nextLevelXpRequirement = useComponentValue(
    Levels,
    encodeEntity({ level: 'uint256' }, { level: BigInt(CURRENT_LEVEL + 1) }),
  )?.experience;

  const levelPercent = useMemo(() => {
    if (!(character && nextLevelXpRequirement)) return 0;
    return (
      (100 * Number(character.experience)) / Number(nextLevelXpRequirement)
    );
  }, [character, nextLevelXpRequirement]);

  const fetchCharacterItems = useCallback(
    async (_character: Character, _equippedWeapons: bigint[]) => {
      try {
        if (_equippedWeapons.length === 0) {
          setItems([]);
          return;
        }

        const _items = _equippedWeapons
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

        const fullItems = await Promise.all(
          _items.map(async item => {
            const itemTemplateStats =
              await worldContract.read.UD__getWeaponStats([
                BigInt(item.tokenId),
              ]);

            const tokenIdEntity = encodeEntity(
              { tokenId: 'uint256' },
              { tokenId: BigInt(item.tokenId) },
            );

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
      } catch (error) {
        renderError(error, 'Failed to fetch character data');
      }
    },
    [ItemsBaseURI, ItemsOwners, ItemsTokenURI, renderError, worldContract],
  );

  useEffect(() => {
    if (!isSynced) return;
    (async (): Promise<void> => {
      if (!character) return;
      const equippedWeapons =
        getComponentValue(CharacterEquipment, character.characterId)
          ?.equippedWeapons ?? [];
      await fetchCharacterItems(character, equippedWeapons);
    })();
  }, [character, CharacterEquipment, fetchCharacterItems, isSynced]);

  if (!(character && items)) {
    return (
      <VStack h="100%" justify="center">
        <Spinner size="lg" />
      </VStack>
    );
  }

  const {
    agility,
    baseHitPoints,
    experience,
    goldBalance,
    image,
    intelligence,
    name,
    strength,
  } = character;

  return (
    <VStack alignItems="start" h="100%" p={2} spacing={4}>
      <HStack
        as="button"
        onClick={() => navigate(`/characters/${character.characterId}`)}
        spacing={4}
        _hover={{ cursor: 'pointer', textDecoration: 'underline' }}
      >
        <Avatar src={image} />
        <Text fontWeight="700">{name}</Text>
        <IoIosArrowForward size={20} />
      </HStack>

      <Grid
        alignSelf="start"
        columnGap={2}
        templateColumns="repeat(2, 1fr)"
        w="75%"
      >
        <GridItem>
          <Text fontWeight="bold" size="lg">
            HP
          </Text>
        </GridItem>
        <GridItem>
          <Text>{baseHitPoints}</Text>
        </GridItem>
        <GridItem>
          <Text fontWeight="bold" size="lg">
            STR
          </Text>
        </GridItem>
        <GridItem>
          <Text>{strength}</Text>
        </GridItem>
        <GridItem>
          <Text fontWeight="bold" size="lg">
            AGI
          </Text>
        </GridItem>
        <GridItem>
          <Text>{agility}</Text>
        </GridItem>
        <GridItem>
          <Text fontWeight="bold" size="lg">
            INT
          </Text>
        </GridItem>
        <GridItem>
          <Text>{intelligence}</Text>
        </GridItem>
      </Grid>

      <Level levelPercent={levelPercent} />

      <HStack alignItems="start" w="100%">
        <Text fontWeight="bold">{goldBalance} $GOLD</Text>
        <Spacer />
        <Text>
          {experience}/{nextLevelXpRequirement?.toString() ?? '0'}
        </Text>
      </HStack>

      <VStack align="stretch" alignItems="start" mt={4} spacing={2} w="100%">
        <HStack fontWeight="bold" w="100%">
          <Text>Active Items</Text>
          <Spacer />
          <Text>
            {items.length}/{MAX_EQUIPPED_WEAPONS}
          </Text>
        </HStack>
        {items.map((item, index) => (
          <HStack
            fontSize="xs"
            justify="space-between"
            key={`equipped-item-${index}`}
            pl={2}
            w="100%"
          >
            <Text>{item.name}</Text>
            <Button
              onClick={() => navigate(`/characters/${character.characterId}`)}
              p="0 2px"
              size="sm"
              variant="ghost"
            >
              <GiRogue size={12} />
            </Button>
          </HStack>
        ))}
        {Array.from({
          length: MAX_EQUIPPED_WEAPONS - items.length,
        }).map((_, index) => (
          <HStack
            key={`empty-weapon-${index}`}
            justify="space-between"
            fontSize="xs"
            pl={2}
            w="100%"
          >
            <Text>Empty Slot</Text>
            <Button
              onClick={() => navigate(`/characters/${character.characterId}`)}
              p="0 2px"
              size="sm"
              variant="ghost"
            >
              +
            </Button>
          </HStack>
        ))}
      </VStack>

      <HStack justify="space-between" fontWeight="bold" mt={4} w="100%">
        <Text>Health Potion</Text>
        <Text>0</Text>
      </HStack>

      {isDesktop && (
        <>
          <VStack alignSelf="start" alignItems="start">
            <Link
              borderBottom="2px solid"
              borderColor="grey400"
              fontSize={{ base: 'xs', sm: 'sm', md: 'md' }}
              pb={1}
              textAlign="left"
              _hover={{
                borderColor: 'grey500',
                textDecoration: 'none',
              }}
            >
              Auction House
            </Link>
            <Link
              borderBottom="2px solid"
              borderColor="grey400"
              fontSize={{ base: 'xs', sm: 'sm', md: 'md' }}
              href={LEADERBOARD_PATH}
              pb={1}
              _hover={{
                borderColor: 'grey500',
                textDecoration: 'none',
              }}
            >
              Leader Board
            </Link>
          </VStack>
        </>
      )}
    </VStack>
  );
};
