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
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Address, formatEther, hexToString } from 'viem';
import { useReadContracts } from 'wagmi';

import { CharacterCard } from '../components/Character/Card/CharacterCard';
import { Misc } from '../components/Character/Misc';
import { Profile } from '../components/Character/Profile';
import { Stats } from '../components/Character/Stats';
import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { fetchMetadataFromUri, uriToHttp } from '../utils/helpers';

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

  // fetchMetadataFromUri(uriToHttp(metadata as string)[0]).then(data => {
  //   character.description = data['description'];
  //   character.image = data['image'];
  // });

  character.gold =
    Number(
      formatEther(
        BigInt((characterMetadata?.data?.[1]?.result as number) || 0),
      ),
    ) ?? 0;

  const [description, setDescription] = useState<string>();
  const [image, setImage] = useState<string>();

  useEffect(() => {
    (async (): Promise<void> => {
      if (metadata) {
        const data = await fetchMetadataFromUri(
          uriToHttp(metadata as string)[0],
        );
        setDescription(data['description'] || '');
        setImage(data['image'] || '');
      } else {
        setDescription(character.description);
        setImage(character.image);
      }
    })();
  });
  return (
    <Box>
      {character.exists ? (
        ''
      ) : (
        <Grid>
          <GridItem>
            <Center
              left="0"
              position="absolute"
              right="0"
              top="50%"
              zIndex={100}
            >
              <Card
                background="black"
                color="white"
                margin={'0 auto'}
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
            p={5}
            rowStart={{ base: 1, sm: 1, md: 1, lg: 1, xl: 1 }}
          >
            <Profile
              description={description!}
              image={image!}
              isPlayer={character.isPlayer}
              name={character.name}
            />
          </GridItem>
          <GridItem
            border="solid"
            colSpan={{ base: 1, sm: 1, md: 1, lg: 1, xl: 1 }}
            colStart={{ base: 1, sm: 1, md: 1, lg: 2, xl: 2 }}
            p={5}
            rowStart={{ base: 2, sm: 2, md: 2, lg: 1, xl: 1 }}
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
            colSpan={{ base: 1, sm: 1, md: 1, lg: 1, xl: 1 }}
            colStart={{ base: 1, sm: 1, md: 1, lg: 3, xl: 3 }}
            rowStart={{ base: 3, sm: 3, md: 3, lg: 1, xl: 1 }}
            p={5}
          >
            <Misc
              experience={character.stats.exp}
              gold={character.gold}
              isPlayer={character.isPlayer}
              max={100}
            />
          </GridItem>
          <GridItem
            colSpan={{ base: 1, sm: 1, md: 1, lg: 3, xl: 3 }}
            colStart={{ base: 1, sm: 1, md: 1, lg: 1, xl: 1 }}
            rowSpan={{ base: 1, sm: 1, md: 1, lg: 1, xl: 1 }}
            rowStart={{ base: 4, sm: 4, md: 4, lg: 2, xl: 2 }}
          >
            <Heading>Items 30 - 3/3 Equipped</Heading>
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
