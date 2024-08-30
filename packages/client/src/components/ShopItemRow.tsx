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
import { type ArmorTemplate, type WeaponTemplate } from '../utils/types';

export const ShopItemRow = ({
  agiModifier,
  description,
  hpModifier,
  intModifier,
  minLevel,
  name,
  statRestrictions,
  strModifier,
}: ArmorTemplate | WeaponTemplate): JSX.Element => {
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
        <Avatar
          backgroundColor={'grey300'}
          borderRadius={0}
          name={removeEmoji(name)}
          size="lg"
        >
          {getEmoji(name)}
        </Avatar>
        <VStack align="start" justify="center" ml={4}>
          <HStack w="100%">
            <Text size={{ base: '2xs', lg: 'sm' }}>{removeEmoji(name)}</Text>
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
            {minLevel}
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
                Buy {removeEmoji(name)}
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
                    name={removeEmoji(name)}
                    size="lg"
                  >
                    {getEmoji(name)}
                  </Avatar>

                  <Text fontWeight={400} fontSize={14} mt={8}>
                    {description}
                  </Text>
                </GridItem>
                <GridItem>
                  <Text fontWeight={700} fontSize={14}>
                    Stats
                  </Text>
                  <Text fontWeight={400} fontSize={14}>
                    INT {intModifier} HIT {hpModifier} STR {strModifier} AGI{' '}
                    {agiModifier}
                  </Text>
                  <Text mt={8} fontWeight={700} fontSize={14}>
                    Restrictions
                  </Text>
                  <Text fontWeight={400} fontSize={14}>
                    - LVL {minLevel}
                  </Text>
                  <Text fontWeight={400} fontSize={14}>
                    - {statRestrictions.minIntelligence} INT
                  </Text>
                  <Text fontWeight={400} fontSize={14}>
                    - {statRestrictions.minStrength} STR
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
