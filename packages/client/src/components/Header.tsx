import { Box, Heading, Stack } from '@chakra-ui/react';
import { useLocation } from 'react-router-dom';

const PAGES_WITHOUT_HEADER = ['/'];

export const Header = (): JSX.Element => {
  const { pathname } = useLocation();

  if (PAGES_WITHOUT_HEADER.includes(pathname)) {
    return <Box />;
  }

  return (
    <Box>
      <Stack backgroundColor="lightgray" direction="row" padding="10px">
        <Heading as="h1" margin="10px" w="50%">
          Ultimate Dominion
        </Heading>
      </Stack>
    </Box>
  );
};
