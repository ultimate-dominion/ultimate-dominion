import { Box, HStack, Text } from '@chakra-ui/react';
import { useMemo } from 'react';
import { useGameTable, encodeCompositeKey } from '../lib/gameStore';
import { useCharacter } from '../contexts/CharacterContext';
import {
  CHAIN_NAMES,
  FRAGMENT_XVI_PREREQ,
  STEP_OBJECTIVES,
  Z2_FRAGMENT_TYPES,
} from '../utils/fragmentChainData';

/**
 * One-line persistent HUD showing the player's current Z2 quest objective.
 * Renders null when no chains are active or initialized.
 */
export const CurrentObjectiveHud = (): JSX.Element | null => {
  const { character } = useCharacter();
  const chainTable = useGameTable('FragmentChainProgress');

  const activeObjective = useMemo(() => {
    if (!character?.id) return null;

    let completedCount = 0;

    const chains = Z2_FRAGMENT_TYPES.map(type => {
      const key = encodeCompositeKey(character.id, type.toString());
      const data = chainTable[key];
      const totalSteps = Number(data?.totalSteps ?? 0);
      const completed = data?.completed === true;
      if (completed) completedCount++;
      return {
        fragmentType: type,
        currentStep: Number(data?.currentStep ?? 0),
        totalSteps,
        completed,
        initialized: data !== undefined && totalSteps > 0,
      };
    });

    // Find the first active chain (initialized, not completed, not locked)
    for (const chain of chains) {
      if (!chain.initialized || chain.completed) continue;

      // Fragment XVI is locked until 4+ other frags complete
      if (chain.fragmentType === 16) {
        const otherCompleted = completedCount - (chains.find(c => c.fragmentType === 16)?.completed ? 1 : 0);
        if (otherCompleted < FRAGMENT_XVI_PREREQ) continue;
      }

      const objective = STEP_OBJECTIVES[chain.fragmentType]?.[chain.currentStep];
      if (objective) {
        return {
          objective,
          chainName: CHAIN_NAMES[chain.fragmentType],
        };
      }
    }

    return null;
  }, [character?.id, chainTable]);

  if (!activeObjective) return null;

  return (
    <Box px={3} py={1.5}>
      <HStack justifyContent="space-between" spacing={2}>
        <HStack spacing={2} minW={0}>
          <Text fontSize="2xs" color="#8A7E6A" textTransform="uppercase" letterSpacing="wider" flexShrink={0}>
            Objective
          </Text>
          <Text fontSize="xs" color="#E8DCC8" noOfLines={1}>
            {activeObjective.objective}
          </Text>
        </HStack>
        <Text fontSize="2xs" color="#C8A96E" flexShrink={0} noOfLines={1}>
          {activeObjective.chainName}
        </Text>
      </HStack>
    </Box>
  );
};
