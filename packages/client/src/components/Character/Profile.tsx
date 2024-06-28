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

import { useCharacter } from '../../contexts/CharacterContext';

export const Profile = (): JSX.Element => {
  const { character } = useCharacter();

  return (
    <Box>
      <VStack>
        <HStack w="100%">
          <Center>
            <Avatar size={{ base: 'xl', sm: 'xl' }} />
            <Heading size={{ base: 'lg', sm: 'lg' }} margin="0px 20px">
              {character?.name || 'Name'}
            </Heading>
          </Center>
          <Spacer></Spacer>
          <Center>
            <FaStarAndCrescent size={40}></FaStarAndCrescent>
          </Center>
        </HStack>
        <Spacer></Spacer>
        <Box>
          <Text size="sm">
            {character?.description ||
              `Emerges as a mystical warrior, my very presence an interplay of shadow
            and light. My armor, adorned with luminescent runes and forged from
            the rarest ores.`}
          </Text>
          <Box textAlign="right">
            <Link to="/">Edit Bio</Link>
          </Box>
        </Box>
      </VStack>
    </Box>
  );
};
