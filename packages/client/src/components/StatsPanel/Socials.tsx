import { Link, Spacer, Stack } from '@chakra-ui/react';
import { FaDiscord, FaTwitter } from 'react-icons/fa';

export const Socials = (): JSX.Element => {
  return (
    <Stack direction="row" padding="5px" w="100%">
      <Link>
        <FaDiscord size={20} />
      </Link>
      <Spacer />
      <Link>
        <FaTwitter size={20} />
      </Link>
      <Spacer />
      <Link fontWeight="700">T&C</Link>
    </Stack>
  );
};
