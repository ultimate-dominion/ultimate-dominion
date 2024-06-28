import { Grid, GridItem, Heading } from '@chakra-ui/react';

// import { useComponentValue, useEntityQuery } from '@latticexyz/react';
// import { getComponentValueStrict, Has, HasValue, runQuery } from '@latticexyz/recs';
// import { useParams } from 'react-router-dom';
import { CharacterCard } from '../components/Character/Card/CharacterCard';
import { Misc } from '../components/Character/Misc';
import { Profile } from '../components/Character/Profile';
import { Stats } from '../components/Character/Stats';
// import { useCharacter } from '../contexts/CharacterContext';
// import { useMUD } from '../contexts/MUDContext';

export const Character = (): JSX.Element => {
  // const { characterId } = useParams();

  // const {
  //   components: { Characters,  },
  // } = useMUD();

  // const { character: player } = useCharacter();
  // const isSelf = player?.characterId == characterId;
  // const c = useEntityQuery([
  //   HasValue(Characters, { characterId: 1 }),
  // ]);

  return (
    <Grid
      rowGap={10}
      gap={2}
      h={{ base: 'calc(100vh - 100px)', lg: 'calc(100vh - 100px)' }}
      mt={4}
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
        padding="10px"
        rowStart={{ sm: 1, base: 1 }}
      >
        <Profile></Profile>
      </GridItem>
      <GridItem
        border="solid"
        colSpan={{ sm: 1, base: 1 }}
        colStart={{ sm: 2, base: 1 }}
        padding="10px"
        rowStart={{ sm: 1, base: 2 }}
      >
        <Stats hp={0} str={0} agi={0} int={0}></Stats>
      </GridItem>
      <GridItem
        border="solid"
        colSpan={{ sm: 1, base: 1 }}
        colStart={{ sm: 3, base: 1 }}
        rowStart={{ sm: 1, base: 3 }}
        padding="10px"
      >
        <Misc></Misc>
      </GridItem>
      <GridItem
        colSpan={{ sm: 3, base: 1 }}
        colStart={{ sm: 0, base: 1 }}
        rowSpan={{ sm: 1, base: 1 }}
        rowStart={{ sm: 2, base: 4 }}
      >
        <Heading>Items 30 - 3/3 Active</Heading>
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
              name: 'Rusty Dagger',
              icon: 'fire',
              image: 'door-closed',
              disabled: false,
              str: 1,
              agi: 3,
              int: 4,
            },
            {
              name: 'Copper Knife',
              icon: 'shield',
              image: 'scribd',
              disabled: false,
              str: 1,
              agi: 3,
              int: 4,
            },
            {
              name: 'Iron Axe',
              icon: 'road',
              image: 'database',
              disabled: false,
              str: 1,
              agi: 3,
              int: 4,
            },
            {
              name: 'Rusty Dagger',
              icon: 'fire',
              image: 'search',
              disabled: true,
              str: 1,
              agi: 3,
              int: 4,
            },
            {
              name: 'Rusty Dagger',
              icon: 'shield',
              image: 'book',
              disabled: true,
              str: 1,
              agi: 3,
              int: 4,
            },
            {
              name: 'Rusty Dagger',
              icon: 'road',
              image: 'pizza-slice',
              disabled: true,
              str: 1,
              agi: 3,
              int: 4,
            },
            {
              name: 'Rusty Dagger',
              icon: 'fire',
              image: 'star-crescent',
              disabled: true,
              str: 1,
              agi: 3,
              int: 4,
            },
            {
              name: 'Rusty Dagger',
              icon: 'shield',
              image: 'bug',
              disabled: true,
              str: 1,
              agi: 3,
              int: 4,
            },
            {
              name: 'Rusty Dagger',
              icon: 'road',
              image: 'socks',
              disabled: true,
              str: 1,
              agi: 3,
              int: 4,
            },
          ].map(function (item, i) {
            return (
              <GridItem key={i}>
                <CharacterCard
                  name={item.name}
                  image={item.image}
                  disabled={item.disabled}
                  str={item.str}
                  int={item.int}
                  agi={item.agi}
                  icon={item.icon}
                ></CharacterCard>
              </GridItem>
            );
          })}
        </Grid>
      </GridItem>
    </Grid>
  );
};
