import { HStack, Link } from '@chakra-ui/react';
import { FaDiscord, FaTwitter } from 'react-icons/fa';

export const Socials = (): JSX.Element => {
  return (
    <HStack justifyContent="space-between" pb={4} w="100%">
      <Link>
        <FaDiscord size={20} />
      </Link>
      <Link>
        <FaTwitter size={20} />
      </Link>
      <Link fontWeight="700">T&C</Link>
    </HStack>
  );
};
