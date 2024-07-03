import {
  Box,
  Card,
  CardBody,
  Center,
  Grid,
  GridItem,
  Heading,
} from '@chakra-ui/react';
import { useComponentValue } from '@latticexyz/react';
import { encodeEntity, singletonEntity } from '@latticexyz/store-sync/recs';
// import {
//   useCallback,
// } from 'react';
import { useParams } from 'react-router-dom';
import { Address, formatEther, hexToString } from 'viem';
import { useReadContracts } from 'wagmi';

import { CharacterCard } from '../components/Character/Card/CharacterCard';
import { Misc } from '../components/Character/Misc';
import { Profile } from '../components/Character/Profile';
import { Stats } from '../components/Character/Stats';
import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
// import { fetchMetadataFromUri, uriToHttp } from '../utils/helpers';

export const Character = (): JSX.Element => {
  const character = {
    id: '',
    isPlayer: false,
    description:
      'Emerges as a mystical warrior, my very presence an interplay of shadow and light. My armor, adorned with luminescent runes and forged from the rarest ores.',
    name: 'Character',
    image: '',
    owner: '',
    gold: 0,
    exists: false,
    stats: {
      agi: 0,
      exp: 0,
      dmg: 0,
      hp: 0,
      int: 0,
      str: 0,
    },
  };
  const { characterId } = useParams();
  character.id = characterId || '';
  const {
    components: { Characters, CharacterStats, UltimateDominionConfig },
  } = useMUD();

  const { character: player } = useCharacter();
  character.isPlayer = player?.characterId == character.id;

  const { multicall } = useComponentValue(
    UltimateDominionConfig,
    singletonEntity,
  ) ?? { multicall: null };

  const { characterToken } = useComponentValue(
    UltimateDominionConfig,
    singletonEntity,
  ) ?? { characterToken: null };

  const { goldToken } = useComponentValue(
    UltimateDominionConfig,
    singletonEntity,
  ) ?? { goldToken: null };
  const ERC721ABI = [
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
  ];
  const ERC20ABI = [
    {
      constant: true,
      inputs: [
        {
          name: '_owner',
          type: 'address',
        },
      ],
      name: 'balanceOf',
      outputs: [
        {
          name: 'balance',
          type: 'uint256',
        },
      ],
      payable: false,
      stateMutability: 'view',
      type: 'function',
    },
  ];
  const characterInfo = useComponentValue(
    Characters,
    encodeEntity(
      { characterId: 'uint256' },
      { characterId: BigInt(characterId!) },
    ),
  );
  character.exists = characterInfo ? true : false;
  character.name = characterInfo
    ? (hexToString(characterInfo?.name as Address) as string)
    : character.name;
  character.owner = characterInfo?.owner || character.owner;

  const stats = useComponentValue(
    CharacterStats,
    encodeEntity(
      { characterId: 'uint256' },
      { characterId: BigInt(characterId!) },
    ),
  );
  character.stats.agi = Number(stats?.agility.toString());
  character.stats.dmg = Number(stats?.damageTaken.toString());
  character.stats.exp = Number(stats?.experience.toString());
  character.stats.hp = Number(stats?.hitPoints.toString());
  character.stats.int = Number(stats?.intelligence.toString());
  character.stats.str = Number(stats?.strength.toString());
  const characterMetadata = useReadContracts({
    contracts: [
      {
        address: characterToken as Address,
        abi: ERC721ABI,
        functionName: 'tokenURI',
        args: [character.id],
      },
      {
        address: goldToken as Address,
        abi: ERC20ABI,
        functionName: 'balanceOf',
        args: [character.owner],
      },
    ],
    multicallAddress: multicall as Address,
  });
  const metadata = characterMetadata?.data?.[0].result;
  // const getCharacterData = useCallback(async () => {
  //   if (uri) {
  //     const metadata = await fetchMetadataFromUri(uriToHttp(uri as string)[0]);
  //     console.log('Metadata: ' + metadata);
  //   }
  // });
  // getCharacterData();

  character.gold =
    Number(
      formatEther(
        BigInt((characterMetadata?.data?.[1]?.result as number) || 0),
      ),
    ) ?? 0;

  return (
    <Box>
      {character.exists ? (
        ''
      ) : (
        <Grid>
          <GridItem>
            <Center left="0" position="absolute" right="0" top="50%">
              <Card
                background="black"
                color="white"
                margin="0 auto"
                variant="filled"
              >
                <CardBody>
                  <Heading>This character does not exist</Heading>
                </CardBody>
              </Card>
            </Center>
          </GridItem>
        </Grid>
      )}
      <Box
        userSelect={character.exists ? 'all' : 'none'}
        pointerEvents={character.exists ? 'all' : 'none'}
      >
        <Grid
          gap={2}
          h={{ base: 'calc(100vh - 100px)', lg: 'calc(100vh - 100px)' }}
          mt={4}
          rowGap={10}
          sx={{
            filter: character.exists ? 'blur(0px)' : 'blur(10px)',
          }}
          templateColumns={{
            sm: 'repeat(3, 1fr)',
            base: 'repeat(1, 1fr)',
          }}
          templateRows={{
            sm: 'repeat(2, 1fr)',
            base: 'repeat(4, 1fr)',
          }}
        >
          <GridItem
            border="solid"
            colSpan={{ sm: 1, base: 1 }}
            colStart={{ sm: 1, base: 1 }}
            padding={5}
            rowStart={{ sm: 1, base: 1 }}
          >
            <Profile
              description={character.description}
              image={character.image}
              isPlayer={character.isPlayer}
              name={character.name}
            />
          </GridItem>
          <GridItem
            border="solid"
            colSpan={{ sm: 1, base: 1 }}
            colStart={{ sm: 2, base: 1 }}
            padding={5}
            rowStart={{ sm: 1, base: 2 }}
          >
            <Stats
              agi={character.stats.agi}
              hp={character.stats.hp}
              int={character.stats.int}
              str={character.stats.str}
            />
          </GridItem>
          <GridItem
            border="solid"
            colSpan={{ sm: 1, base: 1 }}
            colStart={{ sm: 3, base: 1 }}
            rowStart={{ sm: 1, base: 3 }}
            padding={5}
          >
            <Misc
              experience={character.stats.exp}
              gold={character.gold}
              isPlayer={character.isPlayer}
              max={100}
            />
          </GridItem>
          <GridItem
            colSpan={{ sm: 3, base: 1 }}
            colStart={{ sm: 0, base: 1 }}
            rowSpan={{ sm: 1, base: 1 }}
            rowStart={{ sm: 2, base: 4 }}
          >
            <Heading>Items 30 - 3/3 Active</Heading>
            {/* {'CharacterMetadata' +
              JSON.stringify(
                characterMetadata,
                (key, value) =>
                  typeof value === 'bigint' ? value.toString() : value, // return everything else unchanged
              )} */}
            <Grid
              templateColumns={{
                base: 'repeat(1, 1fr)',
                sm: 'repeat(1, 1fr)',
                md: 'repeat(2, 1fr)',
                lg: 'repeat(3, 1fr)',
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
                    <CharacterCard
                      agi={item.agi}
                      disabled={item.disabled}
                      icon={item.icon}
                      int={item.int}
                      image={item.image}
                      isPlayer={character.isPlayer}
                      name={item.name}
                      str={item.str}
                    />
                  </GridItem>
                );
              })}
            </Grid>
          </GridItem>
        </Grid>
      </Box>
    </Box>
  );
};
