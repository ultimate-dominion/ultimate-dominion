import { Link, Spacer, Stack } from '@chakra-ui/react';
import { FaDiscord, FaTwitter } from 'react-icons/fa';

export const Socials = (): JSX.Element => {
  return (
    <Stack direction="row" padding="5px" w="100%">
      <Link>
        <FaDiscord />
      </Link>
      <Spacer />
      <Link>
        <FaTwitter />
      </Link>
      <Spacer />
      <Link fontWeight="700">T&C</Link>
    </Stack>
  );
};
