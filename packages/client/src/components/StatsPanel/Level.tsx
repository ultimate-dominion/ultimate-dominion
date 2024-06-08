import { Box, HStack, Progress, Spacer, Text } from '@chakra-ui/react';

export const Level = (): JSX.Element => {
  const percent = 50;
  return (
    <Box
      marginTop="20px"
      padding="5px"
      position="relative"
      w="100%"
      fontSize="10px"
    >
      <Text position="absolute" right={100 - percent - 2 + '%'} top="-10px">
        {percent}
      </Text>
      <Text
        display={percent > 90 ? 'none' : 'block'}
        position="absolute"
        right="0%"
        top="-10px"
      >
        100
      </Text>
      <Progress value={percent} />
      <HStack>
        <Text>Level 1</Text>
        <Spacer />
        <Text>Level 2</Text>
      </HStack>
    </Box>
  );
};
