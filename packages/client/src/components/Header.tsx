import { Box, Heading } from '@chakra-ui/react';
import { useLocation } from 'react-router-dom';

const PAGES_WITHOUT_HEADER = ['/'];

export const Header = (): JSX.Element => {
  const { pathname } = useLocation();

  if (PAGES_WITHOUT_HEADER.includes(pathname)) {
    return <Box />;
  }

  return (
    <Box bgColor="grey300" mt={8} padding="10px">
      <Heading textAlign="right">Ultimate Dominion</Heading>
    </Box>
  );
};
