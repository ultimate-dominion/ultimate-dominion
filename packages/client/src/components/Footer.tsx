import {
  Box,
  Flex,
  Heading,
  Image,
  Link,
  List,
  ListItem,
  VStack,
} from '@chakra-ui/react';

export const Footer = (): JSX.Element => {
  return (
    <Box padding={'10px'} margin-top={'50px'}>
      <VStack alignItems="start" h="100%" p={4} w="100%">
        <Flex height="100%" width="100%">
          <Box width="25%" padding={'5px'}>
            <Link href="https://raidguild.org">
              <Image src="/images/raidguild.webp"></Image>
            </Link>
          </Box>
          <Box width="25%" padding={'5px'}>
            <List>
              <ListItem>
                <Heading as={'h4'}>Documentation</Heading>
              </ListItem>
              <ListItem>
                <Link href="https://raidguild.org">Link</Link>
              </ListItem>
              <ListItem>
                <Link href="https://raidguild.org">Link</Link>
              </ListItem>
              <ListItem>
                <Link href="https://raidguild.org">Link</Link>
              </ListItem>
              <ListItem>
                <Link href="https://raidguild.org">Link</Link>
              </ListItem>
            </List>
          </Box>
          <Box width="25%" padding={'5px'}>
            <List>
              <ListItem>
                <Heading as={'h4'}>Policy</Heading>
              </ListItem>
              <ListItem>
                <Link href="https://raidguild.org">Link</Link>
              </ListItem>
              <ListItem>
                <Link href="https://raidguild.org">Link</Link>
              </ListItem>
              <ListItem>
                <Link href="https://raidguild.org">Link</Link>
              </ListItem>
              <ListItem>
                <Link href="https://raidguild.org">Link</Link>
              </ListItem>
            </List>
          </Box>
          <Box flex="1" padding={'5px'}>
            <List>
              <ListItem>
                <Heading as={'h4'}>Socials</Heading>
              </ListItem>
              <ListItem>
                <Link href="https://raidguild.org">Link</Link>
              </ListItem>
              <ListItem>
                <Link href="https://raidguild.org">Link</Link>
              </ListItem>
              <ListItem>
                <Link href="https://raidguild.org">Link</Link>
              </ListItem>
              <ListItem>
                <Link href="https://raidguild.org">Link</Link>
              </ListItem>
            </List>
          </Box>
        </Flex>
      </VStack>
    </Box>
  );
};
