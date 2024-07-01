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
  name,
  description,
  image,
}: {
  name: string;
  description: string;
  image: string;
}): JSX.Element => {
  return (
    <Box height="100%" position="relative">
      <VStack>
        <HStack w="100%">
          <Center>
            <Avatar src={image} size={{ base: 'xl', sm: 'xl' }} />
            <Heading size={{ base: 'lg', sm: 'lg' }} margin="0px 20px">
              {name || 'Name'}
            </Heading>
          </Center>
          <Spacer></Spacer>
          <Center>
            <FaStarAndCrescent size={40}></FaStarAndCrescent>
          </Center>
        </HStack>
        <Spacer></Spacer>
        <Box w="100%" mt={3}>
          <Text as="p" size="sm" textAlign="left" overflow="hidden">
            {description ||
              `Emerges as a mystical warrior, my very presence an interplay of shadow
            and light. My armor, adorned with luminescent runes and forged from
            the rarest ores.
            `}
          </Text>
          <Box position="absolute" bottom="0" right="0" textAlign="right">
            <Link to="/">Edit Bio</Link>
          </Box>
        </Box>
      </VStack>
    </Box>
  );
};
