import { Grid, GridItem, HStack, Link, Stack, VStack } from '@chakra-ui/react';
import { FaDiscord, FaTwitter } from 'react-icons/fa';

export const Footer = (): JSX.Element => {
  return (
    <HStack alignItems="center" as="footer" h="150px">
      <Grid
        alignItems="center"
        templateColumns="repeat(4, 1fr)"
        h="90px"
        w="100%"
      >
        <GridItem colSpan={{ base: 3, sm: 2, md: 3 }}>
          <HStack spacing={{ base: 4, md: 10 }}>
            <Stack
              direction={{ base: 'column', md: 'row' }}
              spacing={{ base: 4, md: 10 }}
            >
              <Link
                alignSelf="start"
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
              </Link>
              <Link
                alignSelf="start"
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
            </Stack>
            <Stack
              direction={{ base: 'column', md: 'row' }}
              spacing={{ base: 4, md: 10 }}
            >
              <Link
                alignSelf="start"
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
                alignSelf="start"
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
            </Stack>
          </HStack>
        </GridItem>
        <GridItem colSpan={{ base: 1, sm: 2, md: 1 }} h="100%">
          <VStack
            alignItems="end"
            h="100%"
            justifyContent={{ base: 'start', md: 'center' }}
          >
            <Stack
              alignItems="center"
              direction={{ base: 'column', sm: 'row' }}
              spacing={{ base: 3, md: 10 }}
            >
              <Link>
                <FaDiscord />
              </Link>
              <Link>
                <FaTwitter />
              </Link>
              <Link fontWeight={700}>T&C</Link>
            </Stack>
          </VStack>
        </GridItem>
      </Grid>
    </HStack>
  );
};
