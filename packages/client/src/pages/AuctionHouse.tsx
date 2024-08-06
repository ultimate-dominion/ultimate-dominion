import {
  Box,
  Button,
  Center,
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
  Skeleton,
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
import { useNavigate } from 'react-router-dom';

import { AuctionHouseCard } from '../components/AuctionHouseCard';
import { ItemCard } from '../components/ItemCard';
import { AuctionHouseCardSkeleton } from '../components/Skeletons/AuctionHouseCardSkeleton';
import { ItemCardSkeleton } from '../components/Skeletons/ItemCardSkeleton';
import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { fetchMetadataFromUri, uriToHttp } from '../utils/helpers';
import { ItemType, StatsClasses, Weapon } from '../utils/types';
const itemClasses = {
  warrior: ['Rusty Sword 🗡️'],
  rogue: ['Cracked Dagger 🔪'],
  mage: ['Cobbled Wand 🪄'],
};
export const AuctionHouse = (): JSX.Element => {
  const { renderError } = useToast();
  const navigate = useNavigate();
  const { character: userCharacter } = useCharacter();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const btnRef = useRef();

  const [filter, setFilter] = useState({ filtered: 'all' });
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Weapon[] | null>(null);

  // const [page, setPage] = useState(1);
  // const [pageLimit, setPageLimit] = useState(0);
  // const [total, setTotal] = useState(0);
  const rub = async function () {
    if (userCharacter) {
      const to = userCharacter.characterId as `0x${string}`;
      // (character?.owner as Address) ||
      // ('0x147914732644F7F984783634db2085039FC2F190' as Address);
      const item = BigInt(Math.floor(Math.random() * (3 - 1 + 1) + 1));
      await worldContract.write.UD__adminDropItem([to, item, BigInt(1)]);
    }
  };
  const {
    components: { Characters, Items, ItemsBaseURI, ItemsOwners, ItemsTokenURI },
    network: { worldContract },
  } = useMUD();

  const fetchCharacterItems = useCallback(
    async (/*_character: Character*/) => {
      try {
        const _items = Array.from(runQuery([Has(ItemsOwners)]))
          .map(entity => {
            // const itemdBalance = getComponentValueStrict(
            //   ItemsOwners,
            //   entity,
            // ).balance;

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
              // balance: itemdBalance.toString(),
              itemId: entity,
              itemType: itemTemplate.itemType,
              owner,
              tokenId: tokenId.toString(),
              tokenIdEntity,
            };
          })
          //remove duplicate objects
          .filter(
            (item1, i, arr) =>
              arr.findIndex(item2 => item2.tokenId === item1.tokenId) === i,
          )
          .filter(
            item =>
              // item.owner === _character.owner &&
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
              // balance: item.balance,
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
      if (userCharacter) {
        await fetchCharacterItems();
      }
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
            {userCharacter ? (
              <Heading textAlign="right">
                {userCharacter?.goldBalance} $GOLD
              </Heading>
            ) : (
              <Skeleton>
                <Heading textAlign="right"> $GOLD</Heading>
              </Skeleton>
            )}

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
              <ItemCardSkeleton
                agiModifier={''}
                classRestrictions={[]}
                hitPointModifier={''}
                intModifier={''}
                maxDamage={''}
                minDamage={''}
                minLevel={''}
                strModifier={''}
                description={''}
                image={''}
                name={''}
                // balance={''}
                itemId={'undefined'}
                owner={''}
                tokenId={''}
              ></ItemCardSkeleton>
            </Grid>
          </DrawerBody>

          <DrawerFooter></DrawerFooter>
        </DrawerContent>
      </Drawer>
      <Grid templateRows="repeat(10, 1fr)" templateColumns="repeat(5, 1fr)">
        <GridItem backgroundColor="mintcream" p={5} rowSpan={2} colSpan={5}>
          <Stack direction="row" my={5}>
            <Stack direction="row" w="100%">
              <Button
                size="sm"
                variant="outline"
                onClick={rub}
                visibility={userCharacter ? 'visible' : 'hidden'}
              >
                <GiMagicLamp />
              </Button>
              <Button size="sm" ref={btnRef} onClick={onOpen}>
                <PiBackpackDuotone />
              </Button>
            </Stack>
            <Spacer />
            {userCharacter ? (
              <Heading minW={200} textAlign="right">
                {userCharacter?.goldBalance} $GOLD
              </Heading>
            ) : (
              <Skeleton>
                <Heading> $GOLD</Heading>
              </Skeleton>
            )}
          </Stack>
          <Stack
            direction={{ base: 'column', md: 'row' }}
            mb={8}
            spacing={8}
            w="100%"
          >
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
          <Heading size="lg" borderBottom="solid">
            Warrior
          </Heading>

          <Grid
            templateColumns={{ base: 'repeat(1, 1fr)', lg: 'repeat(3, 1fr)' }}
            gap={5}
            my={5}
          >
            {items != null &&
            items.filter(item => itemClasses.warrior.indexOf(item.name) > -1)
              .length == 0 ? (
              <GridItem colSpan={3}>
                <Center>
                  <Text m={12}>No Items</Text>
                </Center>
              </GridItem>
            ) : (
              ''
            )}
            {items ? (
              items
                .filter(item => itemClasses.warrior.indexOf(item.name) > -1)
                .map(function (item, i) {
                  return (
                    <GridItem
                      key={i}
                      onClick={() => navigate('/items/' + item.tokenId)}
                    >
                      <AuctionHouseCard
                        name={item.name}
                        image="https://placehold.jp/500x500.png"
                        agi={item.agiModifier}
                        int={item.intModifier}
                        hit={item.hitPointModifier}
                        str={item.strModifier}
                      />
                    </GridItem>
                  );
                })
            ) : (
              <AuctionHouseCardSkeleton
                name={''}
                image={''}
                agi={''}
                int={''}
                hit={''}
                str={''}
              ></AuctionHouseCardSkeleton>
            )}
          </Grid>
          <Heading size="lg" borderBottom="solid">
            Rogue
          </Heading>

          <Grid
            templateColumns={{ base: 'repeat(1, 1fr)', lg: 'repeat(3, 1fr)' }}
            gap={5}
            my={5}
          >
            {items != null &&
            items.filter(item => itemClasses.rogue.indexOf(item.name) > -1)
              .length == 0 ? (
              <GridItem colSpan={3}>
                <Center>
                  <Text m={12}>No Items</Text>
                </Center>
              </GridItem>
            ) : (
              ''
            )}
            {items ? (
              items
                .filter(item => itemClasses.rogue.indexOf(item.name) > -1)
                .map(function (item, i) {
                  return (
                    <GridItem
                      key={i}
                      onClick={() => navigate('/items/' + item.tokenId)}
                    >
                      <AuctionHouseCard
                        name={item.name}
                        image="https://placehold.jp/500x500.png"
                        agi={item.agiModifier}
                        int={item.intModifier}
                        hit={item.hitPointModifier}
                        str={item.strModifier}
                      />
                    </GridItem>
                  );
                })
            ) : (
              <AuctionHouseCardSkeleton
                name={''}
                image={''}
                agi={''}
                int={''}
                hit={''}
                str={''}
              ></AuctionHouseCardSkeleton>
            )}
          </Grid>

          <Heading size="lg" borderBottom="solid">
            Mage
          </Heading>

          <Grid
            templateColumns={{ base: 'repeat(1, 1fr)', lg: 'repeat(3, 1fr)' }}
            gap={5}
            my={5}
          >
            {items != null &&
            items.filter(item => itemClasses.mage.indexOf(item.name) > -1)
              .length == 0 ? (
              <GridItem colSpan={3}>
                <Center>
                  <Text m={12}>No Items</Text>
                </Center>
              </GridItem>
            ) : (
              ''
            )}
            {items ? (
              items
                ?.filter(item => itemClasses.mage.indexOf(item.name) > -1)
                ?.map(function (item, i) {
                  return (
                    <GridItem
                      key={i}
                      onClick={() => navigate('/items/' + item.tokenId)}
                    >
                      <AuctionHouseCard
                        name={item.name}
                        image="https://placehold.jp/500x500.png"
                        agi={item.agiModifier}
                        int={item.intModifier}
                        hit={item.hitPointModifier}
                        str={item.strModifier}
                      />
                    </GridItem>
                  );
                })
            ) : (
              <AuctionHouseCardSkeleton
                name={''}
                image={''}
                agi={''}
                int={''}
                hit={''}
                str={''}
              ></AuctionHouseCardSkeleton>
            )}
          </Grid>
        </GridItem>
      </Grid>
    </Box>
  );
};
