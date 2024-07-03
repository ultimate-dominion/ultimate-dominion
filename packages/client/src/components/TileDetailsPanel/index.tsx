import {
  Box,
  Flex,
  Grid,
  GridItem,
  HStack,
  Text,
  useBreakpointValue,
} from '@chakra-ui/react';
import { useComponentValue, useEntityQuery } from '@latticexyz/react';
import {
  Entity,
  getComponentValueStrict,
  Has,
  HasValue,
} from '@latticexyz/recs';
import { decodeEntity, encodeEntity } from '@latticexyz/store-sync/recs';
import { useEffect, useState } from 'react';
import { IoIosArrowForward } from 'react-icons/io';
import { formatEther, getContract, hexToString } from 'viem';

import { useCharacter } from '../../contexts/CharacterContext';
import { useMUD } from '../../contexts/MUDContext';
import { fetchMetadataFromUri, uriToHttp } from '../../utils/helpers';
import type { Character } from '../../utils/types';
import { MONSTERS } from './data';

const ROW_HEIGHT = { base: 5, md: 8, lg: 10 };

export const TileDetailsPanel = (): JSX.Element => {
  const {
    components: { Characters, CharacterStats, Position, Spawned },
    delegatorAddress,
    network: { publicClient, worldContract },
  } = useMUD();
  const { character } = useCharacter();

  const [otherPlayers, setOtherPlayers] = useState<Character[]>([]);

  const characterPosition = useComponentValue(
    Position,
    encodeEntity(
      { characterId: 'uint256' },
      { characterId: BigInt(character?.characterId ?? 0) },
    ),
  );

  const characterEntities = useEntityQuery([
    Has(Spawned),
    Has(Characters),
    Has(CharacterStats),
    HasValue(Position, {
      x: characterPosition?.x,
      y: characterPosition?.y,
    }),
  ]);

  useEffect(() => {
    (async (): Promise<void> => {
      if (!(delegatorAddress && publicClient && worldContract)) return;

      const characters = await Promise.all(
        characterEntities.map(async (entity: Entity) => {
          const characterData = getComponentValueStrict(Characters, entity);
          const characterStats = getComponentValueStrict(
            CharacterStats,
            entity,
          );

          const characterId = decodeEntity(
            { characterId: 'uint256' },
            entity,
          ).characterId.toString();

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
            BigInt(characterId),
          ]);

          const fetachedMetadata = await fetchMetadataFromUri(
            uriToHttp(metadataURI)[0],
          );

          const goldTokenAddress = await worldContract.read.UD__getGoldToken();

          const goldToken = getContract({
            address: goldTokenAddress,
            abi: [
              {
                type: 'function',
                name: 'balanceOf',
                inputs: [
                  {
                    name: 'account',
                    type: 'address',
                    internalType: 'address',
                  },
                ],
                outputs: [
                  {
                    name: '',
                    type: 'uint256',
                    internalType: 'uint256',
                  },
                ],
                stateMutability: 'view',
              },
            ],
            client: publicClient,
          });

          const goldBalance = await goldToken.read.balanceOf([
            delegatorAddress,
          ]);

          return {
            ...fetachedMetadata,
            goldBalance: formatEther(BigInt(goldBalance)).toString(),
            agility: characterStats?.agility.toString() ?? '0',
            experience: characterStats?.experience.toString() ?? '0',
            characterClass: characterData.class,
            characterId,
            hitPoints: characterStats?.hitPoints.toString() ?? '0',
            intelligence: characterStats?.intelligence.toString() ?? '0',
            locked: characterData.locked,
            name: hexToString(characterData.name as `0x${string}`, {
              size: 32,
            }),
            owner: characterData.owner,
            strength: characterStats?.strength.toString() ?? '0',
          };
        }),
      );

      setOtherPlayers(characters.filter(c => c.owner !== delegatorAddress));
    })();
  }, [
    character,
    characterEntities,
    characterPosition,
    Characters,
    CharacterStats,
    delegatorAddress,
    Position,
    publicClient,
    Spawned,
    worldContract,
  ]);

  return (
    <Box>
      <Grid gap={5} templateColumns="repeat(4, 1fr)">
        <GridItem colSpan={2}>
          <Text fontWeight="bold" size={{ base: 'sm', lg: 'lg' }}>
            Monsters
          </Text>
        </GridItem>
        <GridItem colSpan={1}>
          <Text fontWeight="bold" size={{ base: 'sm', lg: 'lg' }}>
            Players
          </Text>
        </GridItem>
        {otherPlayers.length > 0 && (
          <GridItem colSpan={1}>
            <Text mt={1} size={{ base: '2xs', lg: 'sm' }}>
              Safe Zone
            </Text>
          </GridItem>
        )}
      </Grid>
      <Grid gap={5} mt={1} templateColumns="repeat(4, 1fr)">
        <GridItem colSpan={2}>
          {MONSTERS.map((monster, i) => (
            <MonsterRow
              key={`tile-monster-${i}-${monster.name}`}
              monster={monster}
            />
          ))}
        </GridItem>

        {otherPlayers.length > 0 && (
          <>
            <GridItem colSpan={1}>
              {otherPlayers.length > 0 &&
                otherPlayers.map((player, i) => (
                  <PlayerRow
                    key={`tile-player-${i}-${player.name}`}
                    player={player}
                  />
                ))}
            </GridItem>
            <GridItem colSpan={1}>
              {otherPlayers.map((player, i) => (
                <PlayerLevelRow
                  key={`tile-player-level-${i}-${player.name}`}
                  player={player}
                />
              ))}
            </GridItem>
          </>
        )}
        {otherPlayers.length === 0 && (
          <GridItem colSpan={2}>
            <Text size={{ base: '2xs', lg: 'sm' }}>
              No players in this area
            </Text>
          </GridItem>
        )}
      </Grid>
    </Box>
  );
};

const MonsterRow = ({ monster }: { monster: (typeof MONSTERS)[0] }) => {
  const { color, level, name } = monster;

  const isFighting = monster.name === 'Green Slime';

  return (
    <HStack
      as="button"
      bg={isFighting ? 'grey300' : 'transparent'}
      border="1px solid transparent"
      h={ROW_HEIGHT}
      justifyContent="space-between"
      px={{ base: 1, sm: 2, md: 4 }}
      transition="all 0.3s ease"
      w="100%"
      _active={{
        bg: 'grey300',
        border: '1px solid',
        cursor: 'pointer',
      }}
      _hover={{
        border: '1px solid',
        cursor: 'pointer',
      }}
    >
      <Text color={color} size={{ base: '3xs', sm: '2xs', md: 'sm', lg: 'md' }}>
        {name}
      </Text>
      <Text
        fontWeight="bold"
        size={{ base: '3xs', sm: '2xs', md: 'sm', lg: 'md' }}
      >
        Level {level}
      </Text>
    </HStack>
  );
};

const PlayerRow = ({ player }: { player: Character }) => {
  const { name } = player;

  return (
    <HStack h={ROW_HEIGHT} justifyContent="start">
      <Text size={{ base: '3xs', sm: '2xs', md: 'sm', lg: 'md' }}>{name}</Text>
    </HStack>
  );
};

// TODO: Remove when character level is dynamic
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PlayerLevelRow = ({ player }: { player: Character }) => {
  const isMobile = useBreakpointValue({ base: true, md: false });

  return (
    <HStack h={ROW_HEIGHT}>
      <Flex
        alignItems="center"
        as="button"
        borderBottom="1px solid transparent"
        fontWeight="bold"
        gap={2}
        _hover={{ borderBottom: '1px solid', cursor: 'pointer' }}
      >
        <Text size={{ base: '4xs', sm: '3xs', md: 'xs', lg: 'sm' }}>
          {/* TODO: Make level dynamic */}
          Level 1
        </Text>
        <IoIosArrowForward size={isMobile ? 10 : 20} />
      </Flex>
    </HStack>
  );
};
