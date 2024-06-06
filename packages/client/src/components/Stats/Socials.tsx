import { Link, Spacer, Stack } from '@chakra-ui/react';
import { FaDiscord, FaTwitter } from 'react-icons/fa';

export const Socials = (): JSX.Element => {
  return (
    <Stack direction="row" padding="5px" w="100%">
      <Link>
        <FaDiscord />
      </Link>
      <Spacer></Spacer>
      <Link>
        <FaTwitter />
      </Link>
      <Spacer></Spacer>
      <Link fontWeight={700}>T&C</Link>
    </Stack>
  );
};
