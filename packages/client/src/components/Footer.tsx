import { Box, HStack, Link, Stack } from '@chakra-ui/react';
import { FaDiscord, FaTwitter } from 'react-icons/fa';

export const Footer = (): JSX.Element => {
  return (
    <Box bottom="0" fontSize="smaller" position="absolute" w="100%">
      <HStack>
        <Stack direction={['column', 'row']} w="50%">
          <Stack direction="row">
            <Link textDecoration="underline">About</Link>
            <Link textDecoration="underline">Guild Info</Link>
          </Stack>
          <Stack direction="row">
            <Link textDecoration="underline">Map Info</Link>
            <Link textDecoration="underline">Create Map</Link>
          </Stack>
        </Stack>
        <Stack
          direction="row"
          justifyContent="end"
          position="absolute"
          right="0"
          top="0"
        >
          <Link alignItems="center" display="flex">
            <FaDiscord />
          </Link>
          <Link alignItems="center" display="flex">
            <FaTwitter />
          </Link>
          <Link alignItems="center" display="flex">
            T&C
          </Link>
        </Stack>
      </HStack>
    </Box>
  );
};
