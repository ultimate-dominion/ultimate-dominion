import { Box, HStack, Progress, Spacer, Text } from '@chakra-ui/react';

export const Level = (): JSX.Element => {
  const percent = 50;
  return (
    <Box padding="5px" position="relative" w="100%">
      <Text position="absolute" right={100 - percent - 2 + '%'} top="-20px">
        {percent}
      </Text>
      <Text
        display={percent > 90 ? 'none' : 'block'}
        position="absolute"
        right="0%"
        top="-20px"
      >
        100
      </Text>
      <Progress value={percent} />
      <HStack>
        <Text fontSize="small">Level 1</Text>
        <Spacer />
        <Text fontSize="small">Level 2</Text>
      </HStack>
    </Box>
  );
};
