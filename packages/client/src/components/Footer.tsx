import { Box, Link, Stack } from '@chakra-ui/react';

export const Footer = (): JSX.Element => {
  return (
    <Box fontSize="smaller" margin-top="50px" padding="20px">
      <Stack direction={['column', 'row']} float="left">
        <Stack direction="row">
          <Link>About</Link>
          <Link>Map Info</Link>
        </Stack>
        <Stack direction="row">
          <Link>Create Map</Link>
          <Link>Guild Info</Link>
        </Stack>
      </Stack>

      <Stack direction="row" float="right">
        <Link>Discord</Link>
        <Link>Twitter</Link>
        <Link>T&C</Link>
      </Stack>
    </Box>
  );
};
