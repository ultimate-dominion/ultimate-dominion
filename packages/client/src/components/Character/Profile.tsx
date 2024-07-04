import {
  Avatar,
  Box,
  Button,
  Center,
  Heading,
  HStack,
  Spacer,
  Text,
  VStack,
} from '@chakra-ui/react';
import { FaStarAndCrescent } from 'react-icons/fa';

export const Profile = ({
  description,
  image,
  isOwner,
  name,
}: {
  description: string;
  image: string;
  isOwner: boolean;
  name: string;
}): JSX.Element => {
  return (
    <Box h="100%" position="relative">
      <VStack>
        <HStack w="100%">
          <Center>
            <Avatar size="lg" src={image} />
            <Heading margin="0px 20px" size="lg">
              {name}
            </Heading>
          </Center>
          <Spacer />
          <Center>
            <FaStarAndCrescent size={40} />
          </Center>
        </HStack>
        <Spacer />
        <Box mt={3} w="100%">
          <Text overflow="hidden" size="sm" textAlign="left">
            {description}
          </Text>
          {isOwner && (
            <Button
              bottom="0"
              position="absolute"
              right="0"
              size="sm"
              variant="ghost"
            >
              Edit Character
            </Button>
          )}
        </Box>
      </VStack>
    </Box>
  );
};
