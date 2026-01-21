import {
  Box,
  Button,
  Grid,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  VStack,
} from '@chakra-ui/react';
import { Entity } from '@latticexyz/recs';
import { useCallback, useState } from 'react';

import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { AdvancedClass } from '../utils/types';

// Advanced class info with descriptions and bonuses
const ADVANCED_CLASS_INFO: Record<AdvancedClass, {
  name: string;
  description: string;
  icon: string;
  flatBonuses: string;
  multipliers: string;
}> = {
  [AdvancedClass.None]: { name: 'None', description: '', icon: '', flatBonuses: '', multipliers: '' },
  [AdvancedClass.Warrior]: {
    name: 'Warrior',
    description: 'Pure martial masters who excel in physical combat.',
    icon: '⚔️',
    flatBonuses: '+3 STR, +10 HP',
    multipliers: '+10% Physical Damage',
  },
  [AdvancedClass.Paladin]: {
    name: 'Paladin',
    description: 'Holy warriors who combine strength with divine protection.',
    icon: '🛡️',
    flatBonuses: '+2 STR, +15 HP',
    multipliers: '+5% Physical, +5% Healing Received',
  },
  [AdvancedClass.Ranger]: {
    name: 'Ranger',
    description: 'Swift combatants who excel at ranged attacks.',
    icon: '🏹',
    flatBonuses: '+3 AGI',
    multipliers: '+10% Physical Damage',
  },
  [AdvancedClass.Rogue]: {
    name: 'Rogue',
    description: 'Cunning strikers who deal devastating critical hits.',
    icon: '🗡️',
    flatBonuses: '+2 AGI, +1 INT',
    multipliers: '+15% Critical Damage',
  },
  [AdvancedClass.Druid]: {
    name: 'Druid',
    description: 'Versatile hybrids balancing physical and magical power.',
    icon: '🌿',
    flatBonuses: '+2 AGI, +2 STR',
    multipliers: '+5% All Damage, +5% Max HP',
  },
  [AdvancedClass.Warlock]: {
    name: 'Warlock',
    description: 'Dark casters who specialize in sustained damage.',
    icon: '🔮',
    flatBonuses: '+2 AGI, +2 INT',
    multipliers: '+10% Spell Damage',
  },
  [AdvancedClass.Wizard]: {
    name: 'Wizard',
    description: 'Pure arcane masters with the highest spell damage.',
    icon: '📖',
    flatBonuses: '+3 INT',
    multipliers: '+15% Spell Damage',
  },
  [AdvancedClass.Cleric]: {
    name: 'Cleric',
    description: 'Divine healers who support and protect allies.',
    icon: '✨',
    flatBonuses: '+2 INT, +10 HP',
    multipliers: '+10% Healing Done',
  },
  [AdvancedClass.Sorcerer]: {
    name: 'Sorcerer',
    description: 'Battle mages who blend strength with arcane power.',
    icon: '💪',
    flatBonuses: '+2 STR, +2 INT',
    multipliers: '+8% Spell Damage, +5% Max HP',
  },
};

// All selectable classes (excluding None)
const ALL_CLASSES: AdvancedClass[] = [
  AdvancedClass.Warrior,
  AdvancedClass.Paladin,
  AdvancedClass.Ranger,
  AdvancedClass.Rogue,
  AdvancedClass.Druid,
  AdvancedClass.Warlock,
  AdvancedClass.Wizard,
  AdvancedClass.Cleric,
  AdvancedClass.Sorcerer,
];

type AdvancedClassModalProps = {
  isOpen: boolean;
  onClose: () => void;
  characterId: Entity;
  onClassSelected: () => void;
};

export const AdvancedClassModal = ({
  isOpen,
  onClose,
  characterId,
  onClassSelected,
}: AdvancedClassModalProps): JSX.Element => {
  const { renderError, renderSuccess } = useToast();
  const {
    systemCalls: { selectAdvancedClass },
  } = useMUD();

  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedClass, setSelectedClass] = useState<AdvancedClass | null>(null);

  const onConfirmClass = useCallback(async () => {
    if (!selectedClass) return;

    try {
      setIsSelecting(true);

      const { error, success } = await selectAdvancedClass(characterId, selectedClass);

      if (error && !success) {
        throw new Error(error);
      }

      const classInfo = ADVANCED_CLASS_INFO[selectedClass];
      renderSuccess(`Congratulations! You are now a ${classInfo.name}!`);
      onClassSelected();
      onClose();
    } catch (e) {
      renderError((e as Error)?.message ?? 'Failed to select advanced class.', e);
    } finally {
      setIsSelecting(false);
    }
  }, [characterId, selectedClass, onClassSelected, onClose, renderError, renderSuccess, selectAdvancedClass]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="4xl" scrollBehavior="inside">
      <ModalOverlay bg="blackAlpha.700" />
      <ModalContent bg="grey100" borderRadius="lg" maxH="90vh">
        <ModalHeader textAlign="center">
          <Text fontSize="2xl">Level 10 Achieved!</Text>
          <Text fontSize="sm" color="grey500" fontWeight="normal">
            Choose your advanced class - this decision is permanent!
          </Text>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Grid templateColumns="repeat(3, 1fr)" gap={4}>
            {ALL_CLASSES.map((advClass) => {
              const info = ADVANCED_CLASS_INFO[advClass];
              const isSelected = selectedClass === advClass;

              return (
                <Box
                  key={advClass}
                  p={4}
                  borderRadius="md"
                  bg={isSelected ? 'blue.900' : 'grey200'}
                  border="2px solid"
                  borderColor={isSelected ? 'blue.400' : 'transparent'}
                  cursor="pointer"
                  onClick={() => setSelectedClass(advClass)}
                  _hover={{ bg: isSelected ? 'blue.900' : 'grey300' }}
                  transition="all 0.2s"
                >
                  <VStack spacing={2} align="center">
                    <Text fontSize="3xl">{info.icon}</Text>
                    <Text fontWeight={700} fontSize="lg">
                      {info.name}
                    </Text>
                    <Text fontSize="xs" color="grey500" textAlign="center" minH="40px">
                      {info.description}
                    </Text>
                    <Box
                      bg={isSelected ? 'blue.800' : 'grey100'}
                      p={2}
                      borderRadius="sm"
                      w="100%"
                    >
                      <Text fontSize="xs" color="green.400" fontWeight={600}>
                        {info.flatBonuses}
                      </Text>
                      <Text fontSize="xs" color="yellow.400" fontWeight={600}>
                        {info.multipliers}
                      </Text>
                    </Box>
                  </VStack>
                </Box>
              );
            })}
          </Grid>
        </ModalBody>

        <ModalFooter>
          <Button
            w="100%"
            onClick={onConfirmClass}
            isLoading={isSelecting}
            loadingText="Selecting..."
            isDisabled={!selectedClass}
          >
            {selectedClass
              ? `Become a ${ADVANCED_CLASS_INFO[selectedClass].name}`
              : 'Select a Class'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
