import {
  Box,
  Card,
  CardBody,
  Center,
  Grid,
  GridItem,
  Spinner,
  Text,
  useDisclosure,
} from '@chakra-ui/react';
import { Entity, getComponentValueStrict } from '@latticexyz/recs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { formatEther, hexToString } from 'viem';

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
    components: { Characters, Stats },
    network: { publicClient, worldContract },
  } = useMUD();
  const { character: userCharacter } = useCharacter();

  const [character, setCharacter] = useState<
    (Character & CharacterStats) | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCharacter = useCallback(async () => {
    try {
      if (!(characterId && publicClient && worldContract)) return;
      setIsLoading(true);

      const characterData = getComponentValueStrict(
        Characters,
        characterId as Entity,
      );
      const characterStats = getComponentValueStrict(
        Stats,
        characterId as Entity,
      );

      const characterTokenAddress =
        await worldContract.read.UD__getCharacterToken();

      const characterToken = getContract({
        address: characterTokenAddress,
        abi: [
          {
            type: 'function',
            name: 'tokenURI',
            inputs: [
              {
                name: 'tokenId',
                type: 'uint256',
                internalType: 'uint256',
              },
            ],
            outputs: [
              {
                name: '',
                type: 'string',
                internalType: 'string',
              },
            ],
            stateMutability: 'view',
          },
        ],
        client: publicClient,
      });

      const metadataURI = await characterToken.read.tokenURI([
        BigInt(characterData.tokenId),
      ]);

      const fetachedMetadata = await fetchMetadataFromUri(
        uriToHttp(`ipfs://${metadataURI}`)[0],
      );

      const _character = {
        ...fetachedMetadata,
        goldBalance: formatEther(BigInt(goldBalance)).toString(),
        agility: characterStats?.agility.toString() ?? '0',
        experience: characterStats?.experience.toString() ?? '0',
        characterClass: characterData.class,
        characterId: characterId as Entity,
        intelligence: characterStats?.intelligence.toString() ?? '0',
        level: characterStats?.level.toString() ?? '0',
        locked: characterData.locked,
        maxHitPoints: characterStats?.maxHitPoints.toString() ?? '0',
        name: hexToString(characterData.name as `0x${string}`, {
          size: 32,
        }),
        owner: characterData.owner,
        strength: characterStats?.strength.toString() ?? '0',
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
              intelligence={character.intelligence}
              maxHitPoints={character.maxHitPoints}
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
                                  onOpen();
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
      <ItemEquipModal
        isEquipped={equippedWeapons.includes(
          BigInt(selectedItem?.tokenId ?? 0),
        )}
        isOpen={isOpen}
        onClose={() => {
          onClose();
          setSelectedItem(null);
        }}
        {...(selectedItem as Weapon)}
      />
    </Box>
  );
};
