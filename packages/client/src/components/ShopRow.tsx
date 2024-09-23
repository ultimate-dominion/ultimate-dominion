import { HStack, Spinner, Text } from '@chakra-ui/react';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';

const ROW_HEIGHT = { base: 5, md: 8, lg: 10 };

export const ShopRow = ({ shopId }: { shopId: string }): JSX.Element => {
  const navigate = useNavigate();
  const { renderError } = useToast();
  const {
    delegatorAddress,
    systemCalls: { restock },
  } = useMUD();

  const [isRestocking, setIsRestocking] = useState(false);

  const onRestockAndEnter = useCallback(async () => {
    try {
      setIsRestocking(true);

      if (!delegatorAddress) {
        throw new Error('Missing delegation.');
      }

      const { error, success } = await restock(shopId);

      if (error && !success) {
        throw new Error(error);
      }
      navigate(`/shops/${shopId}`);
    } catch (e) {
      renderError((e as Error)?.message ?? 'Restock failed.', e);
    } finally {
      setIsRestocking(false);
    }
  }, [delegatorAddress, navigate, renderError, restock, shopId]);

  return (
    <HStack
      as="button"
      border="1px solid transparent"
      h={ROW_HEIGHT}
      disabled={isRestocking}
      justifyContent="space-between"
      onClick={onRestockAndEnter}
      px={{ base: 1, sm: 2, md: 4 }}
      transition="all 0.3s ease"
      w="100%"
      _active={
        isRestocking
          ? {
              cursor: 'not-allowed',
            }
          : {
              bg: 'transparent',
              border: '1px solid',
              cursor: 'pointer',
            }
      }
      _hover={
        isRestocking
          ? {
              cursor: 'not-allowed',
            }
          : {
              border: '1px solid',
              cursor: 'pointer',
            }
      }
    >
      <HStack justifyContent="start" spacing={4}>
        <Text size={{ base: '3xs', sm: '2xs', md: 'sm', lg: 'md' }}>
          General Store 🏪
        </Text>
        {isRestocking && <Spinner size="sm" />}
      </HStack>
    </HStack>
  );
};
