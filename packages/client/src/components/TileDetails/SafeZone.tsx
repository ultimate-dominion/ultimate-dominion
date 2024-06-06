import { Box, Heading, HStack, Text, VStack } from '@chakra-ui/react';
import { IoIosArrowForward } from 'react-icons/io';

export const SafeZone = (): JSX.Element => {
  return (
    <Box>
      <Heading>Safe Zone</Heading>
      <VStack>
        <HStack>
          <Text>Level 1</Text>
          <IoIosArrowForward></IoIosArrowForward>
        </HStack>
        <HStack>
          <Text>Level 2</Text>
          <IoIosArrowForward></IoIosArrowForward>
        </HStack>
        <HStack>
          <Text>Level 1</Text>
          <IoIosArrowForward></IoIosArrowForward>
        </HStack>
        <HStack>
          <Text>Level 2</Text>
          <IoIosArrowForward></IoIosArrowForward>
        </HStack>
        <HStack>
          <Text>Level 1</Text>
          <IoIosArrowForward></IoIosArrowForward>
        </HStack>
      </VStack>
    </Box>
  );
};
