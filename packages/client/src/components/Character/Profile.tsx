import {
  Avatar,
  Box,
  Center,
  Heading,
  HStack,
  Spacer,
  Text,
  VStack,
} from '@chakra-ui/react';
import { FaStarAndCrescent } from 'react-icons/fa';
import { Link } from 'react-router-dom';

export const Profile = ({
  description,
  image,
  name,
}: {
  description: string;
  image: string;
  name: string;
}): JSX.Element => {
  return (
    <Box height="100%" position="relative">
      <VStack>
        <HStack w="100%">
          <Center>
            <Avatar size={{ base: 'xl', sm: 'xl' }} src={image} />
            <Heading margin="0px 20px" size={{ base: 'lg', sm: 'lg' }}>
              {name || 'Name'}
            </Heading>
          </Center>
          <Spacer />
          <Center>
            <FaStarAndCrescent size={40}></FaStarAndCrescent>
          </Center>
        </HStack>
        <Spacer />
        <Box mt={3} w="100%">
          <Text as="p" overflow="hidden" size="sm" textAlign="left">
            {description}
          </Text>
          <Box bottom="0" position="absolute" right="0" textAlign="right">
            <Link to="/">Edit Bio</Link>
          </Box>
        </Box>
      </VStack>
    </Box>
  );
};
