import { Box, HStack, Text, VStack } from '@chakra-ui/react';
import { IoIosArrowForward } from 'react-icons/io';

export const SafeZone = (): JSX.Element => {
  return (
    <Box>
      <Text size="lg">Safe Zone</Text>
      <VStack>
        <HStack fontWeight="bold">
          <Text>Level 1</Text>
          <IoIosArrowForward />
        </HStack>
        <HStack fontWeight="bold">
          <Text>Level 2</Text>
          <IoIosArrowForward />
        </HStack>
        <HStack fontWeight="bold">
          <Text>Level 1</Text>
          <IoIosArrowForward />
        </HStack>
        <HStack fontWeight="bold">
          <Text>Level 2</Text>
          <IoIosArrowForward />
        </HStack>
        <HStack fontWeight="bold">
          <Text>Level 1</Text>
          <IoIosArrowForward />
        </HStack>
      </VStack>
    </Box>
  );
};
