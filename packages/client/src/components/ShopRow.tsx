import { HStack, Text } from '@chakra-ui/react';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';

const ROW_HEIGHT = { base: 5, md: 8, lg: 10 };

export const ShopRow = ({ shopId }: { shopId: string }): JSX.Element => {
  const navigate = useNavigate();
  const { renderSuccess, renderError } = useToast();
  const {
    systemCalls: { restock },
  } = useMUD();

  const restockAndEnter = useCallback(async () => {
    try {
      await restock(shopId);
    } catch (e) {
      renderError((e as Error)?.message ?? 'Restock failed', e);
    } finally {
      navigate(`/shops/${shopId}`);
    }
  }, [navigate, renderError, renderSuccess, restock, shopId]);
  return (
    <HStack
      as="button"
      border="1px solid transparent"
      h={ROW_HEIGHT}
      justifyContent="space-between"
      onClick={restockAndEnter}
      px={{ base: 1, sm: 2, md: 4 }}
      transition="all 0.3s ease"
      w="100%"
      _active={{
        bg: 'transparent',
        border: '1px solid',
        cursor: 'pointer',
      }}
      _hover={{
        border: '1px solid',
        cursor: 'pointer',
      }}
    >
      <HStack justifyContent="start" spacing={4}>
        <Text size={{ base: '3xs', sm: '2xs', md: 'sm', lg: 'md' }}>
          General Store 🏪
        </Text>
      </HStack>
    </HStack>
  );
};
