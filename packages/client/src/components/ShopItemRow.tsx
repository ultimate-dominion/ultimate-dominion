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
// import { FaHatWizard } from 'react-icons/fa';
import { GiAxeSword /* GiRogue */ } from 'react-icons/gi';
import { IoIosArrowForward } from 'react-icons/io';
import { IoAdd, IoRemove } from 'react-icons/io5';
// import { useNavigate } from 'react-router-dom';

// import { SHOP_PATH } from '../Routes';
export const ShopItemRow = ({ name }: { name: string }): JSX.Element => {
  // const navigate = useNavigate();
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
          name={' '}
          size="lg"
        ></Avatar>
        <VStack align="start" justify="center" ml={4}>
          <HStack w="100%">
            <Text size={{ base: '2xs', lg: 'sm' }}>{name}</Text>
          </HStack>
          {/* <Text size={{ base: '3xs', sm: '2xs', lg: 'sm' }}>
            HP {hitPointModifier} • STR {strModifier} • AGI {agiModifier} • INT{' '}
            {intModifier}
          </Text> */}
        </VStack>
      </Flex>
      <HStack>
        <HStack
          w="100%" /*  w={{ base: '130px', sm: '215px', md: '300px', lg: '450px' }} */
        >
          <Text
            fontWeight={500}
            size={{ base: 'xs', lg: 'md' }}
            textAlign="center"
            w="100%"
          >
            {/* <Center>
              {itemClass == '0' && <GiAxeSword size={15} />}
              {itemClass == '1' && <GiRogue size={15} />}
              {itemClass == '2' && <FaHatWizard size={15} />}
            </Center> */}
            <GiAxeSword size={15} />
          </Text>
          <Text
            fontWeight={500}
            size={{ base: 'xs', lg: 'md' }}
            textAlign="center"
            w="100%"
          >
            {/* {Number(minLevel).toLocaleString()} */}
            {0}
          </Text>
          <Text
            display={{ base: 'none', lg: 'block' }}
            fontWeight={500}
            size={{ base: 'xs', lg: 'md' }}
            textAlign="center"
            w="100%"
          >
            {/* {Number(floor) == 0 ? 'N/A' : Number(floor).toLocaleString()} */}
            {0}
          </Text>
        </HStack>
        <Modal isCentered isOpen={isOpen} onClose={onClose}>
          <ModalOverlay />
          <ModalContent>
            <ModalCloseButton />
            <ModalBody>
              <Text fontWeight={700} fontSize={24}>
                Buy Light Chainmail
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
                  ></Avatar>

                  <Text fontWeight={400} fontSize={14}>
                    This is the item description lalala bluh bluh bluh.
                  </Text>
                </GridItem>
                <GridItem>
                  <Text fontWeight={700} fontSize={14}>
                    Stats
                  </Text>
                  <Text fontWeight={400} fontSize={14}>
                    INT+2 ARM+3 STR+0 AGI-4
                  </Text>
                  <Text fontWeight={700} fontSize={14}>
                    Restrictions
                  </Text>
                  <Text fontWeight={400} fontSize={14}>
                    LVL 3 - 13 INT - 5 STR
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
            {/* <ModalFooter>
              <Button onClick={onClose}>Close</Button>
            </ModalFooter> */}
          </ModalContent>
        </Modal>
        <Box display={{ base: 'none', md: 'block' }} w="50px">
          <Button onClick={onOpen} p={3} variant="ghost">
            <IoIosArrowForward />
          </Button>
        </Box>
      </HStack>
    </Flex>
  );
};
