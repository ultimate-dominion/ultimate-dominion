import { Box, Button, Heading, Stack } from '@chakra-ui/react';
import { useLocation } from 'react-router-dom';

const PAGES_WITHOUT_HEADER = ['/'];

export const Header = ({
  onOpenWalletDetailsModal,
}: {
  onOpenWalletDetailsModal: () => void;
}): JSX.Element => {
  const { pathname } = useLocation();
  if (PAGES_WITHOUT_HEADER.includes(pathname)) {
    return <Box />;
  }

  return (
    <Stack
      as="header"
      bgColor={{ base: 'white', lg: 'grey300' }}
      direction={{ base: 'column-reverse', lg: 'row' }}
      justify="space-between"
      mt={8}
      padding={{ base: 1, lg: 2 }}
    >
      <Button
        alignSelf={{ base: 'start', lg: 'center' }}
        bgColor="white"
        onClick={onOpenWalletDetailsModal}
        size="xs"
        variant="outline"
      >
        Wallet Details
      </Button>
      <Heading
        size={{ base: 'sm', sm: 'md' }}
        textAlign={{ base: 'left', lg: 'right' }}
      >
        Ultimate Dominion
      </Heading>
    </Stack>
  );
};
