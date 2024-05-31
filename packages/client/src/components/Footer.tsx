import { Box, Center, HStack, Link, Stack } from '@chakra-ui/react';
import { FaDiscord, FaTwitter } from 'react-icons/fa';

export const Footer = (): JSX.Element => {
  return (
    <Box
      bottom="0"
      fontSize="smaller"
      padding="20px"
      position="absolute"
      w="100%"
    >
      <HStack>
        <Stack direction={['column', 'row']} w="50%">
          <Stack direction="row">
            <Link>About</Link>
            <Link>Guild Info</Link>
          </Stack>
          <Stack direction="row">
            <Link>Map Info</Link>
            <Link>Create Map</Link>
          </Stack>
        </Stack>
        <Stack direction="row" justifyContent="end" w="50%">
          <Link>
            <FaDiscord />
          </Link>
          <Link>
            <FaTwitter />
          </Link>
          <Center>
            <Link>T&C</Link>
          </Center>
        </Stack>
      </HStack>
    </Box>
  );
};
