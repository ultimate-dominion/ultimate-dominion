import { Box, CloseButton, HStack, Link, Text } from '@chakra-ui/react';
import { useCallback, useState } from 'react';

const DISMISSED_KEY = 'ud_beta_banner_dismissed';

export const BetaBanner = (): JSX.Element | null => {
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(DISMISSED_KEY) === '1',
  );

  const dismiss = useCallback(() => {
    sessionStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  }, []);

  if (dismissed) return null;

  return (
    <Box
      bg="linear-gradient(90deg, #3A2A10 0%, #2A1E0E 50%, #3A2A10 100%)"
      borderBottom="1px solid #C87A2A"
      px={4}
      py={2}
      w="100%"
    >
      <HStack justify="center" maxW="1200px" mx="auto" spacing={2}>
        <Text
          color="#D4A54A"
          fontFamily="Cinzel, serif"
          fontSize={{ base: 'xs', md: 'sm' }}
          fontWeight="bold"
          textAlign="center"
        >
          Early Access — Expect rough edges.{' '}
          <Link
            color="#E8DCC8"
            href="https://tavern.ultimatedominion.com/c/beta-feedback"
            isExternal
            textDecoration="underline"
            _hover={{ color: '#fff' }}
          >
            Report issues
          </Link>
        </Text>
        <CloseButton
          color="#8A7E6A"
          onClick={dismiss}
          size="sm"
          _hover={{ color: '#D4A54A' }}
        />
      </HStack>
    </Box>
  );
};
