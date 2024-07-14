import {
  Box,
  Card,
  CardBody,
  Center,
  Grid,
  GridItem,
  Spinner,
  Text,
} from '@chakra-ui/react';
import { useComponentValue } from '@latticexyz/react';
import {
  Entity,
  getComponentValue,
  getComponentValueStrict,
  Has,
  NotValue,
  runQuery,
} from '@latticexyz/recs';
import {
  decodeEntity,
  encodeEntity,
  singletonEntity,
} from '@latticexyz/store-sync/recs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { formatEther, hexToString } from 'viem';

import { ItemCard } from '../components/Character/Card/ItemCard';
import { Misc } from '../components/Character/Misc';
import { Profile } from '../components/Character/Profile';
import { Stats as StatsPanel } from '../components/Character/Stats';
import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { fetchMetadataFromUri, uriToHttp } from '../utils/helpers';
import type { Character, StatsClasses, Weapon } from '../utils/types';

export const CharacterPage = (): JSX.Element => {
  const { characterId } = useParams();
  const { renderError } = useToast();
  const {
    components: {
      Characters,
      CharactersTokenURI,
      GoldBalances,
      ItemsBaseURI,
      ItemsOwners,
      ItemsTokenURI,
      Stats,
      UltimateDominionConfig,
    },
    isSynced,
    network: { publicClient, worldContract },
  } = useMUD();
  const { character: userCharacter } = useCharacter();

  const ultimateDominionConfig = useComponentValue(
    UltimateDominionConfig,
    singletonEntity,
  );

  const [character, setCharacter] = useState<Character | null>(null);
  const [isLoadingCharacter, setIsLoadingCharacter] = useState(true);
  const [items, setItems] = useState<Weapon[] | null>(null);
  const [isLoadingItems, setIsLoadingItems] = useState(true);

  const fetchCharacter = useCallback(async () => {
    try {
      if (
        !(
          characterId &&
          publicClient &&
          ultimateDominionConfig &&
          worldContract
        )
      )
        return null;
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
        getComponentValueStrict(GoldBalances, ownerEntity)?.value ?? BigInt(0);
      const metadataURI = getComponentValueStrict(
        CharactersTokenURI,
        tokenIdEntity,
      ).tokenURI;

      const fetachedMetadata = await fetchMetadataFromUri(
        uriToHttp(`ipfs://${metadataURI}`)[0],
      );

      const _character = {
        ...fetachedMetadata,
        agility: characterStats.agility.toString(),
        baseHitPoints: characterStats.baseHitPoints.toString(),
        characterClass: characterStats.class,
        characterId: characterId as Entity,
        experience: characterStats.experience.toString(),
        goldBalance: formatEther(goldBalance as bigint).toString(),
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
    } catch (error) {
      renderError(error, 'Failed to fetch character data');
      return null;
    } finally {
      setIsLoadingCharacter(false);
    }
  }, [
    characterId,
    Characters,
    CharactersTokenURI,
    GoldBalances,
    Stats,
    publicClient,
    renderError,
    ultimateDominionConfig,
    worldContract,
  ]);

  const fetchCharacterItems = useCallback(
    async (_character: Character) => {
      try {
        const _items = Array.from(
          runQuery([
            Has(ItemsOwners),
            NotValue(ItemsOwners, { balance: BigInt(0) }),
          ]),
        )
          .map(entity => {
            const itemOwner = getComponentValueStrict(ItemsOwners, entity);
            const { owner, tokenId } = decodeEntity(
              { owner: 'address', tokenId: 'uint256' },
              entity,
            );

            return {
              balance: itemOwner.balance.toString(),
              itemId: entity,
              owner,
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
      } finally {
        setIsLoadingItems(false);
      }
    },
    [ItemsBaseURI, ItemsOwners, ItemsTokenURI, renderError, worldContract],
  );

  useEffect(() => {
    if (!isSynced) return;
    (async (): Promise<void> => {
      const _character = await fetchCharacter();

      if (!_character) return;
      await fetchCharacterItems(_character);
    })();
  }, [fetchCharacter, fetchCharacterItems, isSynced]);

  const isOwner = useMemo(
    () => character?.owner === userCharacter?.owner,
    [character, userCharacter],
  );

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
          h={{ base: 'calc(100vh - 100px)', lg: 'calc(100vh - 100px)' }}
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
            <Profile
              description={character.description!}
              image={character.image}
              isOwner={isOwner}
              name={character.name}
            />
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
            <StatsPanel
              agility={character.agility}
              baseHitPoints={character.baseHitPoints}
              intelligence={character.intelligence}
              strength={character.strength}
            />
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
            <Misc
              experience={character.experience}
              goldBalance={character.goldBalance}
              isPlayer={isOwner}
              max={'100'}
            />
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
                  Items {items.length} - 1/{items.length} equipped
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
                  {items.map(function (item, i) {
                    return (
                      <GridItem key={i}>
                        {/* TODO: we should only use one general modal, which gets passed the item data when clicked */}
                        <ItemCard {...item} />
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
    </Box>
  );
};
