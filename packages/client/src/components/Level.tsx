import { Box, HStack, Progress, Spacer, Text } from '@chakra-ui/react';

export const Level = ({
  experience,
  max,
}: {
  experience: number;
  max: number;
}): JSX.Element => {
  const percent = (experience / max) * 100;
  return (
    <Box fontSize="10px" mt={5} p={1} position="relative" w="100%">
      <Text position="absolute" right={100 - percent - 2 + '%'} top="-15px">
        {experience}
      </Text>
      <Text
        display={percent > 90 ? 'none' : 'block'}
        position="absolute"
        right="0%"
        top="-15px"
      >
        {max}
      </Text>
      <Progress h={2} value={percent} />
      <HStack mt={1}>
        <Text>Level 1</Text>
        <Spacer />
        <Text>Level 2</Text>
      </HStack>
    </Box>
  );
};
