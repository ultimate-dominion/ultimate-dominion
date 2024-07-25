import {
  Box,
  Button,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  Grid,
  GridItem,
  Heading,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Spacer,
  Stack,
  Text,
  useDisclosure,
} from '@chakra-ui/react';
import { getComponentValueStrict, Has, runQuery } from '@latticexyz/recs';
import {
  decodeEntity,
  encodeEntity,
  singletonEntity,
} from '@latticexyz/store-sync/recs';
// import { Entity } from '@latticexyz/recs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FaSearch } from 'react-icons/fa';
import { GiMagicLamp } from 'react-icons/gi';
import { PiBackpackDuotone } from 'react-icons/pi';

import { AuctionHouseCard } from '../components/AuctionHouseCard';
import { ItemCard } from '../components/ItemCard';
import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { fetchMetadataFromUri, uriToHttp } from '../utils/helpers';
import { Character, ItemType, StatsClasses, Weapon } from '../utils/types';
// import { Character } from '../utils/types';

// const createDummyData = (num: number = 1) => {
//   const result: Character[] = [];
//   for (let i = 0; i < num; i++) {
//     result[result.length] = {
//       // characterClass: Math.floor(Math.random() * 3) as StatsClasses,
//       characterId: (Math.random() + 1).toString(36).substring(7) as Entity,
//       goldBalance: Math.floor(Math.random() * (1000 - 100) + 100) / 100 + '',
//       locked: Math.random() < 0.5,
//       owner: (Math.random() + 1).toString(36).substring(7),
//       tokenId: i + '',
//       agility: Math.floor(Math.random() * 10) + 1 + '',
//       baseHitPoints: Math.floor(Math.random() * 10) + 1 + '',
//       experience: Math.floor(Math.random() * 10) + 1 + '',
//       intelligence: Math.floor(Math.random() * 10) + 1 + '',
//       level: Math.floor(Math.random() * 10) + 1 + '',
//       strength: Math.floor(Math.random() * 10) + 1 + '',
//       description: (Math.random() + 1).toString(36).substring(7),
//       image:
//         'http://example.com/' + (Math.random() + 1).toString(36).substring(7),
//       name: (Math.random() + 1).toString(36).substring(7),
//     };
//   }
//   return result;
// };

// const DUMMY_CHARACTER: Character[] = createDummyData(50);
// const PER_PAGE = 10;

const itemClasses = {
  warrior: ['Rusty Sword 🗡️'],
  rogue: ['Cracked Dagger 🔪'],
  mage: ['Cobbled Wand 🪄'],
};
export const AuctionHouse = (): JSX.Element => {
  const { renderError } = useToast();
  const { character: userCharacter } = useCharacter();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const btnRef = useRef();

  // const [entries, setEntries] = useState(DUMMY_CHARACTER);
  const [filter, setFilter] = useState({ filtered: 'all' });
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Weapon[] | null>(null);

  // const [page, setPage] = useState(1);
  // const [pageLimit, setPageLimit] = useState(0);
  // const [total, setTotal] = useState(0);
  const rub = async function () {
    const to = userCharacter?.characterId as `0x${string}`;
    // (character?.owner as Address) ||
    // ('0x147914732644F7F984783634db2085039FC2F190' as Address);
    const item = BigInt(Math.floor(Math.random() * (3 - 1 + 1) + 1));
    await worldContract.write.UD__adminDropItem([to, item, BigInt(1)]);
  };
  const {
    components: { Characters, Items, ItemsBaseURI, ItemsOwners, ItemsTokenURI },
    network: { worldContract },
  } = useMUD();

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
        renderError('Failed to fetch character data.', e);
      } finally {
        // setIsLoadingItems(false);
      }
    },
    [
      Items,
      ItemsBaseURI,
      ItemsOwners,
      ItemsTokenURI,
      renderError,
      worldContract.read,
    ],
  );

  useEffect(() => {
    (async (): Promise<void> => {
      await fetchCharacterItems(userCharacter!);
    })();
  }, [Characters, fetchCharacterItems, userCharacter]);

  return (
    <Box>
      <Drawer
        isOpen={isOpen}
        placement="right"
        onClose={onClose}
        initialFocusRef={btnRef}
      >
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader>Inventory</DrawerHeader>

          <DrawerBody>
            <Grid
              templateColumns={{
                base: 'repeat(1, 1fr)',
              }}
              gap={2}
              mt={4}
            >
              {items
                ?.filter(item => item.owner == userCharacter?.owner)
                ?.map(function (item, i) {
                  return (
                    <GridItem key={i}>
                      <ItemCard {...item} isEquipped={false} />
                    </GridItem>
                  );
                })}
            </Grid>
          </DrawerBody>

          <DrawerFooter></DrawerFooter>
        </DrawerContent>
      </Drawer>
      <Grid templateRows="repeat(10, 1fr)" templateColumns="repeat(5, 1fr)">
        <GridItem backgroundColor="mintcream" p={5} rowSpan={2} colSpan={5}>
          <Stack direction="row" my={5}>
            <Stack direction="row">
              <Button size="sm" ref={btnRef} onClick={onOpen}>
                <PiBackpackDuotone />
              </Button>
              <Button size="sm" variant="outline" onClick={rub}>
                <GiMagicLamp />
              </Button>
            </Stack>
            <Spacer />
            <Heading>{userCharacter?.goldBalance} $GOLD</Heading>
          </Stack>
          <Stack direction="row" mb={8} spacing={8} w="100%">
            <InputGroup w="100%">
              <InputLeftElement h="100%" pointerEvents="none">
                <FaSearch />
              </InputLeftElement>
              <Input
                onChange={e => setQuery(e.target.value)}
                placeholder="Search"
                value={query}
              />
            </InputGroup>
            <HStack>
              <Button
                onClick={() => setFilter({ filtered: 'all' })}
                size="sm"
                variant={filter.filtered == 'all' ? 'solid' : 'outline'}
              >
                All
              </Button>
              <Button
                onClick={() => setFilter({ filtered: 'byWarrior' })}
                size="sm"
                variant={filter.filtered == 'byWarrior' ? 'solid' : 'outline'}
              >
                STR
              </Button>
              <Button
                onClick={() =>
                  setFilter({
                    filtered: 'byRogue',
                  })
                }
                size="sm"
                variant={filter.filtered == 'byRogue' ? 'solid' : 'outline'}
              >
                AGI
              </Button>
              <Button
                onClick={() => setFilter({ filtered: 'byMage' })}
                size="sm"
                variant={filter.filtered == 'byMage' ? 'solid' : 'outline'}
              >
                INT
              </Button>
            </HStack>
          </Stack>
        </GridItem>
        <GridItem
          backgroundColor="lavender"
          p={5}
          rowSpan={8}
          rowStart={3}
          colSpan={5}
        >
          <Heading size="lg" mb={5} borderBottom="solid">
            Warrior
          </Heading>

          <Grid templateColumns="repeat(3, 1fr)" gap={5}>
            {items
              ?.filter(item => itemClasses.warrior.indexOf(item.name) > -1)
              ?.map(function (item, i) {
                return (
                  <GridItem key={i}>
                    <AuctionHouseCard
                      name={item.name}
                      image={''}
                      agi={item.agiModifier}
                      int={item.intModifier}
                      hit={item.hitPointModifier}
                      str={item.strModifier}
                    />
                  </GridItem>
                );
              })}
          </Grid>
          <Heading size="lg" mb={5} borderBottom="solid">
            Rogue
          </Heading>

          <Grid templateColumns="repeat(3, 1fr)" gap={5}>
            {items
              ?.filter(item => itemClasses.rogue.indexOf(item.name) > -1)
              ?.map(function (item, i) {
                return (
                  <GridItem key={i}>
                    <AuctionHouseCard
                      name={item.name}
                      image={''}
                      agi={item.agiModifier}
                      int={item.intModifier}
                      hit={item.hitPointModifier}
                      str={item.strModifier}
                    />
                  </GridItem>
                );
              })}
          </Grid>

          <Heading size="lg" mb={5} borderBottom="solid">
            Mage
          </Heading>

          <Grid templateColumns="repeat(3, 1fr)" gap={5}>
            {items ? (
              items
                ?.filter(item => itemClasses.mage.indexOf(item.name) > -1)
                ?.map(function (item, i) {
                  return (
                    <GridItem key={i}>
                      <AuctionHouseCard
                        name={item.name}
                        image={''}
                        agi={item.agiModifier}
                        int={item.intModifier}
                        hit={item.hitPointModifier}
                        str={item.strModifier}
                      />
                    </GridItem>
                  );
                })
            ) : (
              <Text textAlign="center">Error loading items</Text>
            )}
          </Grid>
        </GridItem>
      </Grid>
    </Box>
  );
};
