import {
  Box,
  HStack,
  Text,
  Tooltip,
  VStack,
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { FaCheck, FaCircle } from 'react-icons/fa';
import { useGameTable, encodeCompositeKey } from '../lib/gameStore';
import { useCharacter } from '../contexts/CharacterContext';
import { getRomanNumeral } from '../utils/fragmentNarratives';

/** Fragment chain names for types IX-XVI */
const CHAIN_NAMES: Record<number, string> = {
  9: 'First Light',
  10: "The Blade's Edge",
  11: 'Divided Ground',
  12: "The Director's Instruments",
  13: "The Storm's Memory",
  14: 'What Grows in the Dark',
  15: "The Baker's Stand",
  16: 'The Lights Below',
};

const Z2_FRAGMENT_TYPES = [9, 10, 11, 12, 13, 14, 15, 16];

interface ChainStepProps {
  stepIndex: number;
  totalSteps: number;
  currentStep: number;
  completed: boolean;
}

const ChainStep = ({ stepIndex, currentStep, completed }: ChainStepProps): JSX.Element => {
  const isDone = completed || stepIndex < currentStep;
  const isCurrent = !completed && stepIndex === currentStep;

  return (
    <Box
      w="18px"
      h="18px"
      borderRadius="full"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg={isDone ? '#C8A96E' : isCurrent ? '#3A3428' : '#1A1714'}
      border="1px solid"
      borderColor={isDone ? '#C8A96E' : isCurrent ? '#C8A96E' : '#3A3428'}
    >
      {isDone ? (
        <FaCheck size={8} color="#0C0A09" />
      ) : isCurrent ? (
        <FaCircle size={6} color="#C8A96E" />
      ) : null}
    </Box>
  );
};

export const FragmentChainProgress = (): JSX.Element | null => {
  const { t } = useTranslation('ui');
  const { character } = useCharacter();
  const chainTable = useGameTable('FragmentChainProgress');

  if (!character?.characterId) return null;

  const chains = Z2_FRAGMENT_TYPES.map(type => {
    const key = encodeCompositeKey(character.characterId, type.toString());
    const data = chainTable[key];
    return {
      fragmentType: type,
      name: CHAIN_NAMES[type],
      numeral: getRomanNumeral(type),
      currentStep: Number(data?.currentStep ?? 0),
      totalSteps: Number(data?.totalSteps ?? 0),
      completed: data?.completed === true,
      initialized: data !== undefined && Number(data?.totalSteps ?? 0) > 0,
    };
  }).filter(c => c.initialized);

  if (chains.length === 0) return null;

  const completedCount = chains.filter(c => c.completed).length;

  return (
    <Box>
      <Text fontWeight="bold" mb={3}>
        {t('fragmentChain.title', { completed: completedCount, total: chains.length })}
      </Text>
      <VStack align="stretch" spacing={2}>
        {chains.map(chain => (
          <Tooltip
            key={chain.fragmentType}
            label={chain.completed
              ? `${chain.name} — ${t('fragmentChain.complete')}`
              : `${chain.name} — ${t('fragmentChain.step', { current: chain.currentStep, total: chain.totalSteps })}`
            }
          >
            <HStack
              p={2}
              borderRadius="md"
              border="1px solid"
              borderColor={chain.completed ? '#C8A96E' : '#3A3428'}
              bg={chain.completed ? 'rgba(200, 169, 110, 0.05)' : 'transparent'}
              spacing={3}
            >
              <Text fontSize="xs" color="#C8A96E" fontWeight="bold" w="30px">
                {chain.numeral}
              </Text>
              <Text fontSize="xs" flex={1} noOfLines={1}>
                {chain.name}
              </Text>
              <HStack spacing={1}>
                {Array.from({ length: chain.totalSteps }, (_, i) => (
                  <ChainStep
                    key={i}
                    stepIndex={i}
                    totalSteps={chain.totalSteps}
                    currentStep={chain.currentStep}
                    completed={chain.completed}
                  />
                ))}
              </HStack>
            </HStack>
          </Tooltip>
        ))}
      </VStack>
    </Box>
  );
};
