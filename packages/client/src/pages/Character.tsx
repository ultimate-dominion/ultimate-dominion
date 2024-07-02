import { Grid, GridItem, Heading } from '@chakra-ui/react';
import { useComponentValue } from '@latticexyz/react';
import { encodeEntity, singletonEntity } from '@latticexyz/store-sync/recs';
import { useParams } from 'react-router-dom';
import { Address, formatEther, hexToString } from 'viem';
import { useReadContracts } from 'wagmi';

import { CharacterCard } from '../components/Character/Card/CharacterCard';
import { Misc } from '../components/Character/Misc';
import { Profile } from '../components/Character/Profile';
import { Stats } from '../components/Character/Stats';
import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
export const Character = (): JSX.Element => {
  const { characterId } = useParams();
  const {
    components: { Characters, CharacterStats, UltimateDominionConfig },
  } = useMUD();

  const { character: player } = useCharacter();

  const { multicall } = useComponentValue(
    UltimateDominionConfig,
    singletonEntity,
  ) ?? { multicall: null };

  const { goldToken } = useComponentValue(
    UltimateDominionConfig,
    singletonEntity,
  ) ?? { goldToken: null };

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
  const multicallTest = useReadContracts({
    contracts: [
      {
        address: goldToken as Address,
        abi: ERC20ABI,
        functionName: 'balanceOf',
        args: [goldToken!],
      },
      {
        address: goldToken as Address,
        abi: ERC20ABI,
        functionName: 'balanceOf',
        args: [multicall!],
      },
    ],
    multicallAddress: multicall! as Address,
  });

  const character = useComponentValue(
    Characters,
    encodeEntity(
      { characterId: 'uint256' },
      { characterId: BigInt(characterId!) },
    ),
  );
  const stats = useComponentValue(
    CharacterStats,
    encodeEntity(
      { characterId: 'uint256' },
      { characterId: BigInt(characterId!) },
    ),
  );

  const owner = player?.owner;

  // const equiptment = useReadContracts({
  //   contracts: [
  //     {
  //       address: goldToken as Address,
  //       abi: ERC20ABI,
  //       functionName: 'balanceOf',
  //       args: [owner!],
  //     },
  //   ],
  //   multicallAddress: '0xca11bde05977b3631167028862be2a173976ca11',
  // });
  const gold = useReadContracts({
    contracts: [
      {
        address: goldToken as Address,
        abi: ERC20ABI,
        functionName: 'balanceOf',
        args: [owner!],
      },
    ],
    // multicallAddress: '0xca11bde05977b3631167028862be2a173976ca11',
  });

  return (
    <Grid
      gap={2}
      h={{ base: 'calc(100vh - 100px)', lg: 'calc(100vh - 100px)' }}
      mt={4}
      rowGap={10}
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
        {/* <Profile
          description={player?.description as string}
          image={player?.image as string}
          name={hexToString(character?.name as Address) as string}
        /> */}
      </GridItem>
      <GridItem
        border="solid"
        colSpan={{ sm: 1, base: 1 }}
        colStart={{ sm: 2, base: 1 }}
        padding={5}
        rowStart={{ sm: 1, base: 2 }}
      >
        {/* <Stats
          agi={Number(stats?.agility.toString())}
          hp={Number(stats?.hitPoints.toString())}
          int={Number(stats?.intelligence.toString())}
          str={Number(stats?.strength.toString())}
        /> */}
      </GridItem>
      <GridItem
        border="solid"
        colSpan={{ sm: 1, base: 1 }}
        colStart={{ sm: 3, base: 1 }}
        rowStart={{ sm: 1, base: 3 }}
        padding={5}
      >
        {/* <Misc
          experience={Number(stats?.experience.toString())}
          gold={
            Number(formatEther(BigInt(gold?.data?.[0]?.result as number))) ?? 0
          }
          max={100}
        /> */}
      </GridItem>
      <GridItem
        colSpan={{ sm: 3, base: 1 }}
        colStart={{ sm: 0, base: 1 }}
        rowSpan={{ sm: 1, base: 1 }}
        rowStart={{ sm: 2, base: 4 }}
      >
        <Heading>Items 30 - 3/3 Active</Heading>
        {console.log(
          'MulticallTest' +
            JSON.stringify(
              multicallTest,
              (key, value) =>
                typeof value === 'bigint' ? value.toString() : value, // return everything else unchanged
            ),
        )}
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
                  name={item.name}
                  str={item.str}
                />
              </GridItem>
            );
          })}
        </Grid>
      </GridItem>
    </Grid>
  );
};
