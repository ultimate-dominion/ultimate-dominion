import {
  Avatar,
  Box,
  Button,
  ButtonGroup,
  Center,
  FormControl,
  Heading,
  HStack,
  Input,
  Link,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  useBreakpointValue,
  VStack,
} from '@chakra-ui/react';

export const CharacterCreation = (): JSX.Element => {
  const isSmallScreen = useBreakpointValue({ base: true, md: false });

  return (
    <Box>
      <Stack
        as="form"
        direction={{ base: 'column', lg: 'row' }}
        gap={{ base: 4, sm: 6 }}
        justifyContent="center"
        maxW="1800px"
        mx="auto"
        my={4}
        w="100%"
      >
        <Box
          border="2px solid"
          p={{ base: 4, sm: 10 }}
          width={{ base: '100%', lg: '50%' }}
        >
          <VStack spacing={8}>
            <Stack
              alignItems="start"
              direction={{ base: 'column-reverse', sm: 'row' }}
              gap={{ base: 4, sm: 8 }}
              w="100%"
            >
              <Center>
                <Avatar size={{ base: 'lg', sm: 'xl' }} />
              </Center>
              <VStack w="100%">
                <FormControl isRequired>
                  <Input placeholder="Name" />
                </FormControl>
                <Button alignSelf="start" size="sm" type="button">
                  Upload Avatar
                </Button>
              </VStack>
            </Stack>
            <FormControl isRequired>
              <Textarea
                height={{ base: '200px', sm: '350px' }}
                placeholder="Bio"
              />
            </FormControl>
          </VStack>
        </Box>
        <Box
          border="2px solid"
          p={{ base: 4, sm: 10 }}
          width={{ base: '100%', lg: '50%' }}
        >
          <VStack alignItems="left" spacing={6}>
            <Heading size="sm" textAlign="left">
              Choose your Character
            </Heading>
            <ButtonGroup justifyContent="space-between" variant="solid">
              <Button size="sm" w="150px">
                Warrior
              </Button>
              <Button size="sm" w="150px">
                Mage
              </Button>
              <Button size="sm" w="150px">
                Rogue
              </Button>
            </ButtonGroup>
          </VStack>
          <SimpleGrid
            columns={{ base: 1, xl: 2 }}
            mt={{ base: 12, sm: 20 }}
            spacing={{ base: 12, sm: 16 }}
          >
            <VStack spacing={8}>
              <HStack justify="space-between" w="100%">
                <Heading size="sm">Stats</Heading>
                <Button size="sm">Roll Stats</Button>
              </HStack>
              <VStack w="100%">
                <HStack justify="space-between" w="100%">
                  <Text>HP - Hit</Text>
                  <Text>1</Text>
                </HStack>
                <HStack justify="space-between" w="100%">
                  <Text>STR - Strength</Text>
                  <Text>2</Text>
                </HStack>
                <HStack justify="space-between" w="100%">
                  <Text>AGI - Agility</Text>
                  <Text>3</Text>
                </HStack>
                <HStack justify="space-between" w="100%">
                  <Text>INT - Intelligence</Text>
                  <Text>4</Text>
                </HStack>
              </VStack>
            </VStack>
            <VStack spacing={5}>
              <HStack justify="space-between" w="100%">
                <Heading size="sm">$Gold</Heading>
                <Text>5</Text>
              </HStack>
              <HStack justify="space-between" w="100%">
                <Heading size="sm">Items</Heading>
                <Text>1</Text>
              </HStack>
              <HStack border="1px solid" borderColor="grey400" w="100%">
                <Box bgColor="grey400" h="50px" w="50px" />
                <Box>
                  <Text size="xs">Rusty Dagger</Text>
                  <Text size="xs">STR+1 AGI+3 INT+4</Text>
                </Box>
              </HStack>
              <Link
                alignSelf="end"
                color="grey500"
                fontSize="18px"
                fontWeight={700}
              >
                Auction House ▶
              </Link>
            </VStack>
          </SimpleGrid>
          {!isSmallScreen && (
            <Button mt={16} width="100%">
              Wake Up
            </Button>
          )}
        </Box>
        {isSmallScreen && <Button width="100%">Wake Up</Button>}
      </Stack>
    </Box>
  );
};
