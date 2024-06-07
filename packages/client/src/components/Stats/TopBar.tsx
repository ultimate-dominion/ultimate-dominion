import { Avatar, Box, Flex, Text } from '@chakra-ui/react';
import { IoIosArrowForward } from 'react-icons/io';

export const TopBar = (): JSX.Element => {
  return (
    <Flex alignItems="center" padding="5px" textAlign="center" w="100%">
      <Box>
        <Avatar size="sm" />
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
