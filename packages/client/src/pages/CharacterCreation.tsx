import {
  Avatar,
  Box,
  Button,
  ButtonGroup,
  Card,
  CardBody,
  Center,
  Flex,
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
      direction={['column', 'row']}
      gap={6}
      justifyContent="center"
      my={20}
      px={12}
    >
      <Box border="2px solid" padding="20px" width="50%">
        <VStack>
          <Flex height="100%" width="100%">
            <Center margin="10px auto" width="40%">
              <Avatar size="lg"></Avatar>
            </Center>
            <Box alignContent="left" margin="10px auto" width="60%">
              <Stack spacing={3}>
                <Input placeholder="Outline" variant="outline" />
                <Input placeholder="Outline" variant="outline" />
              </Stack>
            </Box>
          </Flex>
        </VStack>
        <VStack>
          <Box width="100%">
            <Textarea placeholder="Here is a sample placeholder" />
          </Box>
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
