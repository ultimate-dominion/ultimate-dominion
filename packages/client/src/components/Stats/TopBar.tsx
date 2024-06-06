import { Avatar, Box, Flex, Text } from '@chakra-ui/react';
import { IoIosArrowForward } from 'react-icons/io';

export const TopBar = (): JSX.Element => {
  return (
    <Flex padding="5px" w="100%" textAlign="center" alignItems="center">
      <Box>
        <Avatar size="sm"></Avatar>
      </Box>
      <Box w="100%">
        <Text>0lffaa_08 ※</Text>
      </Box>
      <Box textAlign="right">
        <IoIosArrowForward />
      </Box>
    </Flex>
  );
};
