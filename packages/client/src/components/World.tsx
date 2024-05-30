import { Container, Heading, Text, VStack } from '@chakra-ui/react';

export const World = (): JSX.Element => {
  return (
    <Container maxW="800px">
      <VStack
        justifyContent="center"
        mb={10}
        mt={{ base: 20, sm: 32 }}
        spacing={{ base: 12, sm: 20 }}
      >
        <Heading px={4} textAlign="center">
          World
        </Heading>
        <VStack spacing={6} textAlign="center">
          <Text size={{ base: 'xs', sm: 'sm', md: 'md' }}>
            As you awaken, your eyes flutter open to the stark, eerie ambiance
            of a dimly lit cave. Confusion clouds your mind; the cold, hard
            ground beneath you offers no comfort. Glimpses of blood and bruises
            on your body only deepen the mystery, painting a silent story of
            unseen struggles.
          </Text>
          <Text size={{ base: 'xs', sm: 'sm', md: 'md' }}>
            Where are you? How did you end up here?
          </Text>
          <Text size={{ base: 'xs', sm: 'sm', md: 'md' }}>
            The shadows around you hold secrets, whispering tales of survival
            and discovery. Gathering your strength, you rise, the weight of
            uncertainty heavy on your shoulders yet igniting a spark of
            determination within. With a deep breath, you take your first step
            into the unknown, embarking on a journey where every choice carves
            your path through the darkness.
          </Text>
        </VStack>
      </VStack>
    </Container>
  );
};
