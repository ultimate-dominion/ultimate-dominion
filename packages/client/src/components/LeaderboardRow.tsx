import {
  Avatar,
  Box,
  Button,
  Center,
  Flex,
  HStack,
  Icon,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { etherToFixedNumber } from '../utils/helpers';
import { type Character, StatsClasses } from '../utils/types';

export const LeaderboardRow = ({
  character: {
    agility,
    entityClass,
    externalGoldBalance,
    id,
    image,
    intelligence,
    level,
    maxHp,
    name,
    strength,
  },
  index,
  top,
}: {
  character: Character;
  index: number;
  top: boolean;
}): JSX.Element => {
  const navigate = useNavigate();

  const totalStats = useMemo(
    () => Number(agility) + Number(strength) + Number(intelligence),
    [agility, strength, intelligence],
  );

  return (
    <Box w="100%">
      <Flex
        backgroundColor={top ? '#b1b8be' : '#a2a9b0'}
        borderRadius={2}
        dropShadow={''}
        boxShadow={
          top
            ? '-5px -5px 10px 0px #B3B9BE,5px 5px 10px 0px #949CA380, 2px 2px 4px 0px #88919980'
            : 'box-shadow: -5px -5px 10px 0px #B3B9BE inset,5px 5px 10px 0px #949CA380 inset,2px 2px 4px 0px #88919980 inset'
        }
        h="78px"
        justify="space-between"
        onClick={() => navigate(`/characters/${id}`)}
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
      >
        <Flex>
          <HStack ml={4}>
            <Text
              color="#283570"
              fontSize="16px"
              fontWeight={700}
              justifySelf="center"
            >
              {index + 1}
            </Text>
            <Avatar borderRadius="100%" size="md" src={image} />
          </HStack>
          <VStack align="start" justify="center" ml={4}>
            <HStack w="100%">
              <Text
                color="black"
                fontWeight={700}
                size={{ base: 'sm', lg: 'xl' }}
              >
                {name}
              </Text>
              <Center>
                {entityClass == StatsClasses.Warrior && (
                  <Icon>
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M18.9538 4.84326L14.9306 6.93991L18.2601 4.35745C16.8035 3.46254 15.0347 3.0023 13.7168 2.74661L12 2L10.2486 2.74661C8.96532 3.0023 7.19653 3.48811 5.7052 4.38302L9.03468 6.96548L5.01156 4.86883C3.83237 5.76374 3 7.01662 3 8.70417C3 14.2526 3 16.8606 3 16.8606C3 16.8606 5.01156 20.5681 8.86127 22V14.1503L4.9422 12.0281V9.4968L10.2486 11.4145V14.5083L12.0173 15.8123L13.7861 14.5083V11.3889L19.0925 9.47123V12.0026L15.1734 14.1248V21.9744C18.9884 20.5426 21 16.8606 21 16.8606C21 16.8606 21 14.227 21 8.70417C21 6.99105 20.1329 5.73817 18.9538 4.84326Z"
                        fill="black"
                      />
                    </svg>
                  </Icon>
                )}
                {entityClass == StatsClasses.Rogue && (
                  <Icon>
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <g clipPath="url(#clip0_128_242)">
                        <path
                          d="M1.2973 12.1899C1.31558 9.39851 2.9122 7.6119 5.36198 6.55361C6.70265 5.97393 8.18957 5.60828 9.64908 5.40614C12.6656 4.98401 15.676 5.15048 18.5645 6.19688C20.7736 6.99952 22.5012 8.33725 23.1503 10.6827C23.9577 13.599 22.2362 16.8987 19.4055 17.8886C17.5012 18.5545 15.6242 17.9927 14.4146 16.3933C14.0855 15.9563 13.7899 15.4896 13.4548 15.0556C12.8149 14.2232 11.8947 14.2143 11.2274 15.0348C11.008 15.3053 10.8161 15.5996 10.6302 15.8939C8.49732 19.3125 4.48445 18.4088 2.68368 16.1823C1.74826 15.017 1.31863 13.813 1.2973 12.1899ZM7.78433 9.90982C6.67827 9.88306 5.48386 10.4152 4.93235 11.2327C4.7861 11.4497 4.76172 11.9224 4.90798 12.1245C6.142 13.8279 8.87515 13.8784 10.228 12.2672C10.5784 11.851 10.5632 11.4794 10.1975 11.087C9.51806 10.3617 8.67405 9.98116 7.78433 9.90982ZM17.1294 9.90685C16.0508 9.90982 14.9447 10.4509 14.3658 11.1584C14.0672 11.521 14.0428 11.8272 14.3506 12.2077C15.6699 13.8487 18.3939 13.8606 19.6615 12.175C19.823 11.961 19.829 11.4378 19.6706 11.2238C19.0307 10.3557 18.0953 9.96035 17.1294 9.90685Z"
                          fill="black"
                        />
                      </g>
                      <defs>
                        <clipPath id="clip0_128_242">
                          <rect
                            width="22.0541"
                            height="12.973"
                            fill="white"
                            transform="translate(1.2973 5.18919)"
                          />
                        </clipPath>
                      </defs>
                    </svg>
                  </Icon>
                )}
                {entityClass == StatsClasses.Mage && (
                  <Icon>
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <g clipPath="url(#clip0_128_241)">
                        <path
                          d="M19.4738 -4.66383e-06C18.8685 1.839 18.3216 3.50236 17.7713 5.16573C17.503 5.97503 17.2726 6.79466 16.9596 7.58674C16.5813 8.55445 16.681 9.45673 17.0869 10.39C18.3869 13.3792 19.6595 16.3823 20.9734 19.4576H11.3637C11.6526 17.4774 13.5959 17.4188 14.9235 16.4615C13.9605 15.9724 12.8392 15.6728 12.1307 14.9668C11.3981 14.2402 11.0645 13.1106 10.4936 12.0396C9.9811 13.0383 9.67843 14.1575 8.96648 14.867C8.24077 15.5936 7.1161 15.9242 6.10492 16.4615C7.36029 17.4223 9.32762 17.4533 9.64748 19.4679H3.02667C3.69047 17.9561 4.34396 16.4615 5.00776 14.9668C6.01205 12.7077 7.04731 10.4658 8.01721 8.19285C8.66038 6.68446 9.67156 5.56177 11.0886 4.7628C13.8332 3.21997 16.5641 1.65303 19.4704 -0.00344849L19.4738 -4.66383e-06Z"
                          fill="#1C1C1C"
                        />
                        <path
                          d="M11.9553 24C8.40929 24 4.86329 24 1.31729 24C0.189175 24 0.0103269 23.8071 0.0034481 22.6362C-0.00687005 21.1554 0.127266 20.966 1.27602 20.966C8.42649 20.9625 15.5735 20.9625 22.724 20.966C23.8693 20.966 24.0069 21.1623 24 22.6397C23.9931 23.8003 23.804 24 22.6793 24C19.1058 24 15.5288 24 11.9553 24Z"
                          fill="#1C1C1C"
                        />
                      </g>
                      <defs>
                        <clipPath id="clip0_128_241">
                          <rect width="24" height="24" fill="white" />
                        </clipPath>
                      </defs>
                    </svg>
                  </Icon>
                )}
              </Center>
            </HStack>
            <Text
              color="#121B45"
              fontWeight={500}
              size={{ base: 'xs', lg: 'md' }}
            >
              HP {maxHp.toString()} • STR {strength.toString()} • AGI{' '}
              {agility.toString()} • INT {intelligence.toString()}
            </Text>
          </VStack>
        </Flex>
        <HStack>
          <HStack w={{ base: '130px', sm: '215px', md: '300px', lg: '450px' }}>
            <Text
              color="#121B45"
              display={{ base: 'none', lg: 'block' }}
              fontWeight={500}
              size={{ base: 'xs', lg: 'md' }}
              textAlign="center"
              w="100%"
            >
              {totalStats}
            </Text>
            <Text
              color="black"
              fontWeight={500}
              size={{ base: 'xs', lg: 'md' }}
              textAlign="center"
              w="100%"
            >
              {level.toString()}
            </Text>
            <Text
              color="#EFD31C"
              fontWeight={500}
              size={{ base: 'xs', lg: 'md' }}
              textAlign="center"
              w="100%"
            >
              {etherToFixedNumber(externalGoldBalance)}
            </Text>
          </HStack>
          <Box display={{ base: 'none', md: 'block' }} w="50px">
            <Button p={3} variant="none">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M7.36612 4.33474C7.85427 3.88842 8.64573 3.88842 9.13388 4.33474L16.6339 11.1919C17.122 11.6382 17.122 12.3618 16.6339 12.8081L9.13388 19.6653C8.64573 20.1116 7.85427 20.1116 7.36612 19.6653C6.87796 19.219 6.87796 18.4953 7.36612 18.049L13.9822 12L7.36612 5.95098C6.87796 5.50467 6.87796 4.78105 7.36612 4.33474Z"
                  fill="black"
                />
              </svg>
            </Button>
          </Box>
        </HStack>
      </Flex>
      <Box
        backgroundColor="#F5F5FA1F"
        boxShadow="-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset"
        w="100%"
        height="7px"
      ></Box>
    </Box>
  );
};
