import { Box, HStack, Progress, Spacer, Text } from '@chakra-ui/react';

export const Level = (): JSX.Element => {
  return (
    <Box padding="5px" w="100%">
      <Progress value={23} />
      <HStack>
        <Text fontSize="small">Level 1</Text>
        <Spacer></Spacer>
        <Text fontSize="small">Level 2</Text>
      </HStack>
    </Box>
  );
};
