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
import { Entity, getComponentValue } from '@latticexyz/recs';
import { singletonEntity } from '@latticexyz/store-sync/recs';
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
import { BALANCE_OF_ABI, TOKEN_URI_ABI } from '../utils/constants';
import { fetchMetadataFromUri, uriToHttp } from '../utils/helpers';
import type { Character, CharacterStats } from '../utils/types';

export const CharacterPage = (): JSX.Element => {
  const { characterId } = useParams();
  const { renderError } = useToast();
  const {
    components: { Characters, Stats, UltimateDominionConfig },
    network: { publicClient, worldContract },
  } = useMUD();
  const { character: userCharacter } = useCharacter();

  const ultimateDominionConfig = useComponentValue(
    UltimateDominionConfig,
    singletonEntity,
  );

  const [character, setCharacter] = useState<
    (Character & CharacterStats) | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);

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
        return;
      setIsLoading(true);

      const characterData = getComponentValue(
        Characters,
        characterId as Entity,
      );
      const characterStats = getComponentValue(Stats, characterId as Entity);

      if (!(characterData && characterStats)) return;

      const { characterToken, goldToken, multicall } = ultimateDominionConfig;

      const characterContract = {
        address: characterToken as `0x${string}`,
        abi: TOKEN_URI_ABI,
      };

      const goldTokenContract = {
        address: goldToken as `0x${string}`,
        abi: BALANCE_OF_ABI,
      };

      const [{ result: metadataURI }, { result: goldBalance }] =
        await publicClient.multicall({
          contracts: [
            {
              ...characterContract,
              functionName: 'tokenURI',
              args: [characterData.tokenId],
            },
            {
              ...goldTokenContract,
              functionName: 'balanceOf',
              args: [characterData.owner],
            },
          ],
          multicallAddress: multicall as `0x${string}`,
        });

      const fetachedMetadata = await fetchMetadataFromUri(
        uriToHttp(metadataURI as string)[0],
      );

      setCharacter({
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
      });
    } catch (error) {
      renderError(error, 'Failed to fetch character data');
    } finally {
      setIsLoading(false);
    }
  }, [
    characterId,
    Characters,
    Stats,
    publicClient,
    renderError,
    ultimateDominionConfig,
    worldContract,
  ]);

  useEffect(() => {
    (async (): Promise<void> => {
      await fetchCharacter();
    })();
  }, [fetchCharacter]);

  const isOwner = useMemo(
    () => character?.owner === userCharacter?.owner,
    [character, userCharacter],
  );

  if (isLoading) {
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
            <Text fontWeight="bold" mt={{ base: 8, lg: 0 }} size="lg">
              Items 30 - 3/3 Equipped
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
              {[
                {
                  agi: 3,
                  disabled: false,
                  icon: 'fire',
                  image: 'door-closed',
                  int: 4,
                  name: 'Rusty Dagger',
                  str: 1,
                },
                {
                  agi: 3,
                  disabled: false,
                  icon: 'shield',
                  image: 'scribd',
                  int: 4,
                  name: 'Copper Knife',
                  str: 1,
                },
                {
                  agi: 3,
                  disabled: false,
                  icon: 'road',
                  image: 'database',
                  int: 4,
                  name: 'Iron Axe',
                  str: 1,
                },
                {
                  agi: 3,
                  disabled: true,
                  icon: 'fire',
                  image: 'search',
                  int: 4,
                  name: 'Rusty Dagger',
                  str: 1,
                },
                {
                  agi: 3,
                  disabled: true,
                  icon: 'shield',
                  image: 'book',
                  int: 4,
                  name: 'Rusty Dagger',
                  str: 1,
                },
                {
                  agi: 3,
                  disabled: true,
                  icon: 'road',
                  image: 'pizza-slice',
                  int: 4,
                  name: 'Rusty Dagger',
                  str: 1,
                },
                {
                  agi: 3,
                  disabled: true,
                  icon: 'fire',
                  image: 'star-crescent',
                  int: 4,
                  name: 'Rusty Dagger',
                  str: 1,
                },
                {
                  agi: 3,
                  disabled: true,
                  icon: 'shield',
                  image: 'bug',
                  int: 4,
                  name: 'Rusty Dagger',
                  str: 1,
                },
                {
                  agi: 3,
                  disabled: true,
                  icon: 'road',
                  image: 'socks',
                  int: 4,
                  name: 'Rusty Dagger',
                  str: 1,
                },
              ].map(function (item, i) {
                return (
                  <GridItem key={i}>
                    {/* TODO: we should only use one general modal, which gets passed the item data when clicked */}
                    <ItemCard
                      agi={item.agi}
                      disabled={item.disabled}
                      icon={item.icon}
                      int={item.int}
                      image={item.image}
                      name={item.name}
                      str={item.str}
                    />
                  </GridItem>
                );
              })}
            </Grid>
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
