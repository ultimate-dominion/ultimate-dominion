import { Link, VStack } from '@chakra-ui/react';

export const Navigation = (): JSX.Element => {
  return (
    <VStack align="baseline" padding="5px" w="100%">
      <Link
        borderBottom="2px solid"
        borderColor="grey400"
        fontSize={{ base: 'xs', sm: 'sm', md: 'md' }}
        pb={1}
        textAlign="left"
        _hover={{
          borderColor: 'grey500',
          textDecoration: 'none',
        }}
      >
        Auction House
      </Link>
      <Link
        borderBottom="2px solid"
        borderColor="grey400"
        fontSize={{ base: 'xs', sm: 'sm', md: 'md' }}
        pb={1}
        _hover={{
          borderColor: 'grey500',
          textDecoration: 'none',
        }}
      >
        Leader Board
      </Link>
      {/* <Link
        borderBottom="2px solid"
        borderColor="grey400"
        fontSize={{ base: 'xs', sm: 'sm', md: 'md' }}
        pb={1}
        _hover={{
          borderColor: 'grey500',
          textDecoration: 'none',
        }}
      >
        Guild Info
      </Link>
      <Link
        borderBottom="2px solid"
        borderColor="grey400"
        fontSize={{ base: 'xs', sm: 'sm', md: 'md' }}
        pb={1}
        _hover={{
          borderColor: 'grey500',
          textDecoration: 'none',
        }}
      >
        Map Info
      </Link>
      <Link
        borderBottom="2px solid"
        borderColor="grey400"
        fontSize={{ base: 'xs', sm: 'sm', md: 'md' }}
        pb={1}
        _hover={{
          borderColor: 'grey500',
          textDecoration: 'none',
        }}
      >
        Create Map
      </Link>
      <Link
        borderBottom="2px solid"
        borderColor="grey400"
        fontSize={{ base: 'xs', sm: 'sm', md: 'md' }}
        pb={1}
        _hover={{
          borderColor: 'grey500',
          textDecoration: 'none',
        }}
      >
        About
      </Link> */}
    </VStack>
  );
};
