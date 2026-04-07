import {
  Box,
  HStack,
  Text,
  Tooltip,
  VStack,
} from '@chakra-ui/react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FaCheck, FaCircle, FaLock } from 'react-icons/fa';
import { useGameTable, encodeCompositeKey } from '../lib/gameStore';
import { useCharacter } from '../contexts/CharacterContext';
import { getRomanNumeral } from '../utils/fragmentNarratives';
import {
  ARCS,
  CHAIN_NAMES,
  CHAIN_PROGRESS_TABLE,
  FRAGMENT_XVI_PREREQ,
  STEP_OBJECTIVES,
  Z2_FRAGMENT_TYPES,
} from '../utils/fragmentChainData';

interface ChainStepProps {
  stepIndex: number;
  currentStep: number;
  completed: boolean;
}

const ChainStep = ({ stepIndex, currentStep, completed }: ChainStepProps): JSX.Element => {
  const isDone = completed || stepIndex < currentStep;
  const isCurrent = !completed && stepIndex === currentStep;

  return (
    <Box
      w="16px"
      h="16px"
      borderRadius="full"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg={isDone ? '#C8A96E' : isCurrent ? '#3A3428' : '#1A1714'}
      border="1px solid"
      borderColor={isDone ? '#C8A96E' : isCurrent ? '#C8A96E' : '#3A3428'}
      transition="all 0.3s ease"
    >
      {isDone ? (
        <FaCheck size={7} color="#0C0A09" />
      ) : isCurrent ? (
        <FaCircle size={5} color="#C8A96E" />
      ) : null}
    </Box>
  );
};

type ChainData = {
  fragmentType: number;
  name: string;
  numeral: string;
  currentStep: number;
  totalSteps: number;
  completed: boolean;
  initialized: boolean;
  locked: boolean;
};

export const FragmentChainProgress = (): JSX.Element | null => {
  const { t } = useTranslation('ui');
  const { character } = useCharacter();
  const chainTable = useGameTable(CHAIN_PROGRESS_TABLE);

  const chains = useMemo(() => {
    if (!character?.id) return [];

    return Z2_FRAGMENT_TYPES.map(type => {
      const key = encodeCompositeKey(character.id, type.toString());
      const data = chainTable[key];
      return {
        fragmentType: type,
        name: CHAIN_NAMES[type],
        numeral: getRomanNumeral(type),
        currentStep: Number(data?.currentStep ?? 0),
        totalSteps: Number(data?.totalSteps ?? 0),
        completed: data?.completed === true,
        initialized: data !== undefined && Number(data?.totalSteps ?? 0) > 0,
        locked: false,
      } as ChainData;
    });
  }, [character?.id, chainTable]);

  const anyInitialized = chains.some(c => c.initialized);
  if (!anyInitialized) return null;

  const completedCount = chains.filter(c => c.completed).length;

  // Fragment XVI is locked until 4+ other Z2 frags are completed
  const xvi = chains.find(c => c.fragmentType === 16);
  if (xvi && !xvi.completed) {
    const otherCompleted = chains.filter(c => c.fragmentType !== 16 && c.completed).length;
    xvi.locked = otherCompleted < FRAGMENT_XVI_PREREQ;
  }

  // Find the first active (non-completed, non-locked, initialized) chain's current objective
  const activeChain = chains.find(c => c.initialized && !c.completed && !c.locked);
  const activeObjective = activeChain
    ? STEP_OBJECTIVES[activeChain.fragmentType]?.[activeChain.currentStep]
    : null;

  return (
    <Box>
      <HStack justifyContent="space-between" mb={3}>
        <Text fontWeight="bold">
          {t('fragmentChain.title', { completed: completedCount, total: chains.filter(c => c.initialized).length })}
        </Text>
      </HStack>
      <VStack align="stretch" spacing={4}>
        {ARCS.map(arc => {
          const arcChains = arc.types
            .map(type => chains.find(c => c.fragmentType === type))
            .filter((c): c is ChainData => c !== undefined && c.initialized);
          if (arcChains.length === 0) return null;

          return (
            <Box key={arc.name}>
              <Text
                fontSize="2xs"
                fontWeight="bold"
                color={arc.color}
                textTransform="uppercase"
                letterSpacing="wider"
                mb={1.5}
              >
                {arc.name}
              </Text>
              <VStack align="stretch" spacing={1.5}>
                {arcChains.map(chain => {
                  const objectives = STEP_OBJECTIVES[chain.fragmentType] ?? [];
                  const tooltipText = chain.completed
                    ? `${chain.name} — Complete`
                    : chain.locked
                      ? `${chain.name} — Requires ${FRAGMENT_XVI_PREREQ}+ fragments`
                      : `${chain.name} — ${objectives[chain.currentStep] ?? `Step ${chain.currentStep + 1} of ${chain.totalSteps}`}`;

                  const isActive = activeChain?.fragmentType === chain.fragmentType;

                  return (
                    <Tooltip key={chain.fragmentType} label={tooltipText}>
                      <HStack
                        p={2}
                        borderRadius="md"
                        border="1px solid"
                        borderColor={
                          chain.completed ? '#C8A96E'
                            : chain.locked ? '#2A2520'
                              : isActive ? '#C8A96E'
                                : '#3A3428'
                        }
                        borderLeft={isActive && !chain.completed ? '2px solid #C8A96E' : undefined}
                        bg={
                          chain.completed ? 'rgba(200, 169, 110, 0.05)'
                            : chain.locked ? 'rgba(0, 0, 0, 0.2)'
                              : isActive ? 'rgba(200, 169, 110, 0.03)'
                                : 'transparent'
                        }
                        opacity={chain.locked ? 0.5 : 1}
                        spacing={3}
                      >
                        <Text fontSize="xs" color="#C8A96E" fontWeight="bold" w="30px">
                          {chain.numeral}
                        </Text>
                        <Text fontSize="xs" flex={1} noOfLines={1} color={chain.locked ? '#6A6055' : undefined}>
                          {chain.name}
                        </Text>
                        {chain.locked ? (
                          <HStack spacing={1}>
                            <FaLock size={10} color="#6A6055" />
                            <Text fontSize="2xs" color="#6A6055">{FRAGMENT_XVI_PREREQ}+ frags</Text>
                          </HStack>
                        ) : (
                          <HStack spacing={1}>
                            {Array.from({ length: chain.totalSteps }, (_, i) => (
                              <ChainStep
                                key={i}
                                stepIndex={i}
                                currentStep={chain.currentStep}
                                completed={chain.completed}
                              />
                            ))}
                          </HStack>
                        )}
                      </HStack>
                    </Tooltip>
                  );
                })}
              </VStack>
            </Box>
          );
        })}
      </VStack>
      {activeObjective && (
        <Box mt={3} pt={3} borderTop="1px solid #3A3428">
          <Text fontSize="2xs" color="#8A7E6A" textTransform="uppercase" letterSpacing="wider">
            Current objective
          </Text>
          <Text fontSize="sm" color="#E8DCC8" mt={0.5}>
            {activeObjective}
          </Text>
        </Box>
      )}
    </Box>
  );
};
