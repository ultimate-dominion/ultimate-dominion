import { HStack, Text } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';

const ROW_HEIGHT = { base: 5, md: 8, lg: 10 };

export const ShopRow = (): JSX.Element => {
  const navigate = useNavigate();

  return (
    <HStack
      as="button"
      border="1px solid transparent"
      h={ROW_HEIGHT}
      justifyContent="space-between"
      onClick={() => navigate('/shops')}
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
