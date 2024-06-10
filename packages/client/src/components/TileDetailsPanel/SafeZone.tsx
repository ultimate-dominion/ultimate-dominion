import { Box, HStack, Text, VStack } from '@chakra-ui/react';
import { IoIosArrowForward } from 'react-icons/io';

export const SafeZone = (): JSX.Element => {
  return (
    <Box>
      <Text p="10px" size="sm">
        Safe Zone
      </Text>
      <VStack alignItems="start" mt={4} p="0 10px" gap={4}>
        <HStack fontWeight="bold">
          <Text size="sm">Level 1</Text>
          <IoIosArrowForward />
        </HStack>
        <HStack fontWeight="bold">
          <Text size="sm">Level 2</Text>
          <IoIosArrowForward />
        </HStack>
        <HStack fontWeight="bold">
          <Text size="sm">Level 1</Text>
          <IoIosArrowForward />
        </HStack>
        <HStack fontWeight="bold">
          <Text size="sm">Level 2</Text>
          <IoIosArrowForward />
        </HStack>
        <HStack fontWeight="bold">
          <Text size="sm">Level 1</Text>
          <IoIosArrowForward />
        </HStack>
      </VStack>
    </Box>
  );
};
