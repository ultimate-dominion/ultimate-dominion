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
import { useComponentValue } from '@latticexyz/react';
import {
  Entity,
  getComponentValue,
  getComponentValueStrict,
  Has,
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

import { Misc } from '../components/Character/Misc';
import { Profile } from '../components/Character/Profile';
import { Stats as StatsPanel } from '../components/Character/Stats';
import { ItemCard } from '../components/ItemCard';
import { ItemEquipModal } from '../components/ItemEquipModal';
import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { MAX_EQUIPPED_WEAPONS } from '../utils/constants';
import { fetchMetadataFromUri, uriToHttp } from '../utils/helpers';
import {
  type Character,
  ItemType,
  type StatsClasses,
  type Weapon,
} from '../utils/types';

export const CharacterPage = (): JSX.Element => {
  const { characterId } = useParams();
  const { renderError } = useToast();
  const {
    components: {
      CharacterEquipment,
      Characters,
      CharactersTokenURI,
      GoldBalances,
      Items,
      ItemsBaseURI,
      ItemsOwners,
      ItemsTokenURI,
      Stats,
    },
    isSynced,
    network: { publicClient, worldContract },
  } = useMUD();
  const { character: userCharacter } = useCharacter();

  const { isOpen, onClose, onOpen } = useDisclosure();

  const [character, setCharacter] = useState<Character | null>(null);
  const [isLoadingCharacter, setIsLoadingCharacter] = useState(true);
  const [items, setItems] = useState<Weapon[] | null>(null);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [selectedItem, setSelectedItem] = useState<Weapon | null>(null);

  const equippedWeapons =
    useComponentValue(CharacterEquipment, characterId as Entity | undefined)
      ?.equippedWeapons ?? [];

  const fetchCharacter = useCallback(async () => {
    try {
      if (!(characterId && publicClient && worldContract)) return null;
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
    worldContract,
  ]);

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
      } catch (error) {
        renderError(error, 'Failed to fetch character data');
      } finally {
        setIsLoadingItems(false);
      }
    },
    [
      Items,
      ItemsBaseURI,
      ItemsOwners,
      ItemsTokenURI,
      renderError,
      worldContract,
    ],
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

  const maxItemsEquipped = equippedWeapons.length === MAX_EQUIPPED_WEAPONS;

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
