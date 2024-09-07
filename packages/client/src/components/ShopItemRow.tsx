import {
  Avatar,
  Box,
  Button,
  Flex,
  Grid,
  GridItem,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalOverlay,
  Text,
  useDisclosure,
  VStack,
} from '@chakra-ui/react';
import { IoIosArrowForward } from 'react-icons/io';
import { IoAdd, IoRemove } from 'react-icons/io5';

import { getEmoji, removeEmoji } from '../utils/helpers';

export const ShopItemRow = ({
  agiModifier,
  description,
  hpModifier,
  intModifier,
  minLevel,
  name,
  statRestrictions,
  strModifier,
}: {
  agiModifier: string | number | bigint | undefined;
  description: string | number | bigint | undefined;
  hpModifier: string | number | bigint | undefined;
  intModifier: string | number | bigint | undefined;
  minLevel: string | number | bigint | undefined;
  name: string | number | bigint | undefined;
  statRestrictions: {
    minIntelligence: string | number | bigint | undefined;
    minStrength: string | number | bigint | undefined;
  };
  strModifier: string | number | bigint | undefined;
}): JSX.Element => {
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <Flex
      border="2px solid"
      borderColor="grey400"
      borderRadius={2}
      justify="space-between"
      w="100%"
      _hover={{
        cursor: 'pointer',
        button: {
          bgColor: 'grey300',
        },
      }}
      _active={{
        button: {
          bgColor: 'grey400',
        },
      }}
      onClick={onOpen}
    >
      <Flex>
        <Avatar backgroundColor={'grey300'} borderRadius={0} name=" " size="lg">
          {name ? getEmoji(name.toString()) : ''}
        </Avatar>
        <VStack align="start" justify="center" ml={4}>
          <HStack w="100%">
            <Text size={{ base: '2xs', lg: 'sm' }}>
              {name ? removeEmoji(name.toString()) : ''}
            </Text>
          </HStack>
        </VStack>
      </Flex>
      <HStack>
        <HStack w="100%">
          <Text
            fontWeight={500}
            size={{ base: 'xs', lg: 'md' }}
            textAlign="center"
            w="75px"
          ></Text>
          <Text
            fontWeight={500}
            size={{ base: 'xs', lg: 'md' }}
            textAlign="center"
            w="75px"
          >
            {0}
          </Text>
          <Text
            display={{ base: 'none', lg: 'block' }}
            fontWeight={500}
            size={{ base: 'xs', lg: 'md' }}
            textAlign="center"
            w="100%"
          >
            {0}
          </Text>
        </HStack>
        <Modal isCentered isOpen={isOpen} onClose={onClose}>
          <ModalOverlay />
          <ModalContent>
            <ModalCloseButton />
            <ModalBody>
              <Text fontWeight={700} fontSize={24}>
                Buy {name ? removeEmoji(name.toString()) : ''}
              </Text>
              <Grid
                gap={10}
                p={5}
                templateColumns="repeat(2,1fr)"
                templateRows="2fr"
              >
                <GridItem>
                  <Avatar
                    backgroundColor={'grey300'}
                    borderRadius={0}
                    name={' '}
                    size="lg"
                  >
                    {name ? getEmoji(name.toString()) : ''}
                  </Avatar>

                  <Text fontWeight={400} fontSize={14} mt={8}>
                    {description ? description.toString() : ''}
                  </Text>
                </GridItem>
                <GridItem>
                  <Text fontWeight={700} fontSize={14}>
                    Stats
                  </Text>
                  <Text fontWeight={400} fontSize={14}>
                    INT {intModifier ? intModifier.toString() : 0} HIT{' '}
                    {hpModifier ? hpModifier.toString() : 0} STR{' '}
                    {strModifier ? strModifier.toString() : 0} AGI{' '}
                    {agiModifier ? agiModifier.toString() : 0}
                  </Text>
                  <Text mt={8} fontWeight={700} fontSize={14}>
                    Restrictions
                  </Text>
                  <Text fontWeight={400} fontSize={14}>
                    - LVL {minLevel ? minLevel.toString() : 0}
                  </Text>
                  <Text fontWeight={400} fontSize={14}>
                    -{' '}
                    {statRestrictions['minIntelligence']
                      ? statRestrictions.minIntelligence.toString()
                      : 0}{' '}
                    INT
                  </Text>
                  <Text fontWeight={400} fontSize={14}>
                    -{' '}
                    {statRestrictions['minStrength']
                      ? statRestrictions.minIntelligence?.toString()
                      : 0}{' '}
                    STR
                  </Text>
                </GridItem>
                <GridItem colSpan={2} textAlign="center">
                  <VStack>
                    <Text>AMOUNT (MAX 5) </Text>
                    <HStack>
                      <Button size="xs">
                        <IoRemove />
                      </Button>
                      <Input min={1} p={2} size="sm" value={0} w={10} />
                      <Button size="xs">
                        <IoAdd />
                      </Button>
                    </HStack>
                    <Button>Buy</Button>
                  </VStack>
                </GridItem>
              </Grid>
            </ModalBody>
          </ModalContent>
        </Modal>
        <Box display={{ base: 'none', md: 'block' }} w="30px">
          <Button onClick={onOpen} p={3} variant="ghost">
            <IoIosArrowForward />
          </Button>
        </Box>
      </HStack>
    </Flex>
  );
};
