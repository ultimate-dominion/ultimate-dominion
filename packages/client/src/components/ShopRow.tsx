import { HStack, Spinner, Text } from '@chakra-ui/react';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { useTransaction } from '../hooks/useTransaction';
import { EncounterType } from '../utils/types';

const ROW_HEIGHT = { base: 5, md: 8 };

export const ShopRow = ({
  shopId,
  shopName,
}: {
  shopId: string;
  shopName: string;
}): JSX.Element => {
  const navigate = useNavigate();
  const {
    delegatorAddress,
    systemCalls: { createEncounter, endShopEncounter, restock },
  } = useMUD();
  const { character, refreshCharacter } = useCharacter();

  const restockTx = useTransaction({ actionName: 'entering shop' });

  const onRestockAndEnter = useCallback(async () => {
    if (!delegatorAddress) return;
    if (!character) return;

    // If already in an encounter with THIS shop, just navigate directly
    if (character.worldEncounter?.shopId === shopId) {
      navigate(`/shops/${shopId}`);
      return;
    }

    // If stuck in an encounter (same or different entity), end it first.
    // endShopEncounter now awaits the receipt, so the encounter is truly
    // cleared on-chain before we proceed to create a new one.
    if (character.worldEncounter?.encounterId) {
      const endResult = await endShopEncounter(character.worldEncounter.encounterId);
      if (!endResult.success) {
        console.error('[ShopRow] Cannot clear existing encounter:', endResult.error);
        return;
      }
      await refreshCharacter();
    }

    const result = await restockTx.execute(async () => {
      const { error: restockError, success: restockSuccess } =
        await restock(shopId);
      if (restockError && !restockSuccess) throw new Error(restockError);

      const { error: encounterError, success: encounterSuccess } =
        await createEncounter(EncounterType.World, [character.id], [shopId]);
      if (encounterError && !encounterSuccess) throw new Error(encounterError);
    });

    if (result !== undefined) {
      await refreshCharacter();
      navigate(`/shops/${shopId}`);
    }
  }, [
    character,
    createEncounter,
    delegatorAddress,
    endShopEncounter,
    navigate,
    refreshCharacter,
    restock,
    restockTx,
    shopId,
  ]);

  return (
    <HStack
      as="button"
      borderBottom="2px solid transparent"
      h={ROW_HEIGHT}
      disabled={restockTx.isLoading}
      justifyContent="space-between"
      onClick={onRestockAndEnter}
      px={{ base: 1, sm: 4 }}
      transition="all 0.3s ease"
      w="100%"
      _active={
        restockTx.isLoading
          ? {
              cursor: 'not-allowed',
            }
          : {
              bg: 'grey300',
              borderBottom: '2px solid white',
              cursor: 'pointer',
            }
      }
      _hover={
        restockTx.isLoading
          ? {
              cursor: 'not-allowed',
            }
          : {
              borderBottom: '2px solid white',
              cursor: 'pointer',
            }
      }
    >
      <HStack justifyContent="start" spacing={4}>
        <Text size={{ base: '3xs', sm: '2xs', md: 'sm', lg: 'md' }}>
          {shopName} 🏪
        </Text>
        {restockTx.isLoading && <Spinner size="sm" />}
      </HStack>
    </HStack>
  );
};
