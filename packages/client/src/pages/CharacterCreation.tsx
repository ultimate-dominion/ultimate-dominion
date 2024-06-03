import {
  Avatar,
  Box,
  Button,
  ButtonGroup,
  Card,
  CardBody,
  Center,
  Flex,
  FormControl,
  Heading,
  Input,
  Link,
  Stack,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react';

export const CharacterCreation = (): JSX.Element => {
  return (
    <Stack
      as="form"
      direction={['column', 'row']}
      gap={6}
      justifyContent="center"
      maxW="1800px"
      mx="auto"
      my={20}
      px={12}
    >
      <Box border="2px solid" p={10} width="50%">
        <VStack spacing={10}>
          <Flex gap={10} w="100%">
            <Center>
              <Avatar size="xl"></Avatar>
            </Center>
            <VStack w="100%">
              <FormControl isRequired>
                <Input placeholder="Name" />
              </FormControl>
              <Button alignSelf="start" size="sm" type="button">
                Upload Avatar
              </Button>
            </VStack>
          </Flex>
          <FormControl isRequired>
            <Textarea height="250px" placeholder="Bio" />
          </FormControl>
        </VStack>
      </Box>
      <Box border="2px solid" padding="20px" width="50%">
        <VStack textAlign="left">
          <Heading textAlign="left" width="100%">
            Choose your Character
          </Heading>
          <ButtonGroup spacing="6" variant="outline">
            <Button>Warrior</Button>
            <Button>Mage</Button>
            <Button>Rogue</Button>
          </ButtonGroup>
        </VStack>
        <Stack direction="row" w="full">
          <Heading textAlign="left">Stats</Heading>
          <Button size="sm" variant="outline">
            Roll Stats
          </Button>
          <Text>$Gold</Text>
          <Text>00,00</Text>
        </Stack>
        <Stack direction="row">
          <Stack direction="column">
            <Stack direction="row">
              <Text width="50%">HP - Hit</Text>
              <Text align="right">1</Text>
            </Stack>
            <Stack direction="row">
              <Text width="50%">STR - Strength</Text>
              <Text align="right">2</Text>
            </Stack>
            <Stack direction="row">
              <Text width="50%">AGI - Agility</Text>
              <Text align="right">3</Text>
            </Stack>
            <Stack direction="row">
              <Text width="50%">INT - Intelligence</Text>
              <Text align="right">4</Text>
            </Stack>
          </Stack>
          <Stack direction="column" w="50%">
            <Text>Items - 1</Text>
            <Card>
              <CardBody>A Card</CardBody>
            </Card>
            <Link>Auction House ▶</Link>
          </Stack>
        </Stack>
        <Button width="100%">Wake Up</Button>
      </Box>
    </Stack>
  );
};
