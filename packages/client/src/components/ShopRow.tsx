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

    // If there's any existing world encounter (valid or stale), end it first.
    // This handles ghost encounters where EncounterEntity was cleared but
    // WorldEncounter wasn't, as well as encounters with different entities.
    // Always create a fresh encounter to ensure consistent on-chain state.
    if (character.worldEncounter?.encounterId) {
      const endResult = await endShopEncounter(character.worldEncounter.encounterId);
      if (!endResult.success) {
        console.error('[ShopRow] Cannot clear existing encounter:', endResult.error);
        // Don't return — the encounter may already be ended on-chain.
        // Proceed to create a fresh encounter; createEncounter will fail
        // with AlreadyInEncounter if it truly can't be created.
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
