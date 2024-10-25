import { HStack, Spinner, Text } from '@chakra-ui/react';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
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
  const { renderError } = useToast();
  const {
    delegatorAddress,
    systemCalls: { createEncounter, restock },
  } = useMUD();
  const { character, refreshCharacter } = useCharacter();

  const [isRestocking, setIsRestocking] = useState(false);

  const onRestockAndEnter = useCallback(async () => {
    try {
      setIsRestocking(true);

      if (!delegatorAddress) {
        throw new Error('Missing delegation.');
      }

      if (!character) {
        throw new Error('Character not found.');
      }

      const { error: restockError, success: restockSuccess } =
        await restock(shopId);

      if (restockError && !restockSuccess) {
        throw new Error(restockError);
      }

      const { error: encounterError, success: encounterSuccess } =
        await createEncounter(EncounterType.World, [character.id], [shopId]);

      if (encounterError && !encounterSuccess) {
        throw new Error(encounterError);
      }

      refreshCharacter();
      navigate(`/shops/${shopId}`);
    } catch (e) {
      renderError((e as Error)?.message ?? 'Restock failed.', e);
    } finally {
      setIsRestocking(false);
    }
  }, [
    character,
    createEncounter,
    delegatorAddress,
    navigate,
    refreshCharacter,
    renderError,
    restock,
    shopId,
  ]);

  return (
    <HStack
      as="button"
      borderBottom="2px solid transparent"
      h={ROW_HEIGHT}
      disabled={isRestocking}
      justifyContent="space-between"
      onClick={onRestockAndEnter}
      px={{ base: 1, sm: 4 }}
      transition="all 0.3s ease"
      w="100%"
      _active={
        isRestocking
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
        isRestocking
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
        {isRestocking && <Spinner size="sm" />}
      </HStack>
    </HStack>
  );
};
