import {
  Box,
  Button,
  Grid,
  Image,
  Link,
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
import { useCallback, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { ShareButton } from './ShareButton';
import { useMUD } from '../contexts/MUDContext';
import { useTransaction } from '../hooks/useTransaction';
import { CLASS_PAGE_PATH } from '../Routes';
import { getClassImage } from '../utils/classImages';
import { AdvancedClass } from '../utils/types';

// Advanced class info with descriptions and bonuses
const ADVANCED_CLASS_INFO: Record<AdvancedClass, {
  name: string;
  description: string;
  icon: string;
  flatBonuses: string;
  multipliers: string;
  spell: string;
}> = {
  [AdvancedClass.None]: { name: 'None', description: '', icon: '', flatBonuses: '', multipliers: '', spell: '' },
  [AdvancedClass.Warrior]: {
    name: 'Warrior',
    description: 'Pure martial masters who excel in physical combat.',
    icon: '⚔️',
    flatBonuses: '+3 STR, +10 HP',
    multipliers: '+10% Physical Damage',
    spell: 'Battle Cry: +4 STR, +3 Armor for 3 turns',
  },
  [AdvancedClass.Paladin]: {
    name: 'Paladin',
    description: 'Holy warriors who combine strength with divine protection.',
    icon: '🛡️',
    flatBonuses: '+2 STR, +15 HP',
    multipliers: '+5% Physical, +5% Healing Received',
    spell: 'Divine Shield: +5 Armor, +3 STR for 3 turns',
  },
  [AdvancedClass.Ranger]: {
    name: 'Ranger',
    description: 'Swift combatants who excel at ranged attacks.',
    icon: '🏹',
    flatBonuses: '+3 AGI',
    multipliers: '+10% Physical Damage',
    spell: "Hunter's Mark: -5 AGI, -2 Armor on enemy for 4 turns",
  },
  [AdvancedClass.Rogue]: {
    name: 'Rogue',
    description: 'Cunning strikers who deal devastating critical hits.',
    icon: '🗡️',
    flatBonuses: '+2 AGI, +1 INT',
    multipliers: '+15% Critical Damage',
    spell: 'Shadowstep: +8 AGI for 2 turns',
  },
  [AdvancedClass.Druid]: {
    name: 'Druid',
    description: 'Versatile hybrids balancing physical and magical power.',
    icon: '🌿',
    flatBonuses: '+2 AGI, +2 STR',
    multipliers: '+5% All Damage, +5% Max HP',
    spell: 'Entangle: -5 AGI, -3 STR on enemy for 3 turns',
  },
  [AdvancedClass.Warlock]: {
    name: 'Warlock',
    description: 'Dark casters who specialize in sustained damage.',
    icon: '🔮',
    flatBonuses: '+2 AGI, +2 INT',
    multipliers: '+10% Spell Damage',
    spell: 'Soul Drain: 8-14 magic damage + -3 STR, -3 INT on enemy for 3 turns',
  },
  [AdvancedClass.Wizard]: {
    name: 'Wizard',
    description: 'Pure arcane masters with the highest spell damage.',
    icon: '📖',
    flatBonuses: '+3 INT',
    multipliers: '+15% Spell Damage',
    spell: 'Arcane Blast: 12-20 magic damage',
  },
  [AdvancedClass.Cleric]: {
    name: 'Cleric',
    description: 'Divine healers who support and protect allies.',
    icon: '✨',
    flatBonuses: '+2 INT, +10 HP',
    multipliers: '+10% Healing Done',
    spell: 'Blessing: +3 INT, +5 Armor, +5 Max HP for 3 turns',
  },
  [AdvancedClass.Sorcerer]: {
    name: 'Sorcerer',
    description: 'Battle mages who blend strength with arcane power.',
    icon: '💪',
    flatBonuses: '+2 STR, +2 INT',
    multipliers: '+8% Spell Damage, +5% Max HP',
    spell: 'Arcane Surge: 10-16 magic damage',
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
  characterId: string;
  onClassSelected: () => void;
};

export const AdvancedClassModal = ({
  isOpen,
  onClose,
  characterId,
  onClassSelected,
}: AdvancedClassModalProps): JSX.Element => {
  const {
    systemCalls: { selectAdvancedClass },
  } = useMUD();

  const selectClassTx = useTransaction({ actionName: 'select class', showSuccessToast: false });
  const [selectedClass, setSelectedClass] = useState<AdvancedClass | null>(null);
  const [confirmedClass, setConfirmedClass] = useState<AdvancedClass | null>(null);

  const onConfirmClass = useCallback(async () => {
    if (!selectedClass) return;

    const result = await selectClassTx.execute(async () => {
      const { error, success } = await selectAdvancedClass(characterId, selectedClass);
      if (error && !success) throw new Error(error);
      return true;
    });

    if (result !== undefined) {
      onClassSelected();
      setConfirmedClass(selectedClass);
    }
  }, [characterId, selectedClass, onClassSelected, selectAdvancedClass, selectClassTx]);

  const handleConfirmedClose = useCallback(() => {
    setConfirmedClass(null);
    setSelectedClass(null);
    onClose();
  }, [onClose]);

  return (
    <Modal isOpen={isOpen} onClose={confirmedClass ? handleConfirmedClose : onClose} isCentered size={{ base: 'full', md: '4xl' }} scrollBehavior="inside">
      <ModalOverlay bg="blackAlpha.700" />
      <ModalContent bg="grey100" borderRadius="lg" maxH="90vh">
        <ModalHeader textAlign="center">
          {confirmedClass ? (
            <Text fontSize="2xl">Congratulations!</Text>
          ) : (
            <>
              <Text fontSize="2xl">Level 10 Achieved!</Text>
              <Text fontSize="sm" color="grey500" fontWeight="normal">
                Choose your advanced class - this decision is permanent!
              </Text>
            </>
          )}
        </ModalHeader>
        {!confirmedClass && <ModalCloseButton />}
        {confirmedClass ? (
          <>
            <ModalBody>
              <VStack spacing={6} align="center" py={8}>
                {getClassImage(ADVANCED_CLASS_INFO[confirmedClass].name) && (
                  <Image
                    src={getClassImage(ADVANCED_CLASS_INFO[confirmedClass].name)}
                    alt={ADVANCED_CLASS_INFO[confirmedClass].name}
                    boxSize="120px"
                    objectFit="cover"
                    borderRadius="lg"
                    border="2px solid"
                    borderColor="blue.400"
                  />
                )}
                <Text fontSize="2xl" fontWeight={700}>
                  You are now a {ADVANCED_CLASS_INFO[confirmedClass].name}!
                </Text>
                <Text color="grey500" textAlign="center">
                  Your path is chosen. The world will remember.
                </Text>
                <ShareButton
                  text={`Became a ${ADVANCED_CLASS_INFO[confirmedClass].name} in Ultimate Dominion. Level 10 achieved.`}
                  shareParams={{
                    type: 'class',
                    class: ADVANCED_CLASS_INFO[confirmedClass].name,
                  }}
                  imageSrc={getClassImage(ADVANCED_CLASS_INFO[confirmedClass].name)}
                  colorAccent="#D4A54A"
                />
              </VStack>
            </ModalBody>
            <ModalFooter>
              <Button w="100%" onClick={handleConfirmedClose}>
                Continue
              </Button>
            </ModalFooter>
          </>
        ) : (
          <>
            <ModalBody>
              <Grid templateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }} gap={4}>
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
                        {getClassImage(info.name) ? (
                          <Image
                            src={getClassImage(info.name)}
                            alt={info.name}
                            boxSize="64px"
                            objectFit="cover"
                            borderRadius="md"
                          />
                        ) : (
                          <Text fontSize="3xl">{info.icon}</Text>
                        )}
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
                          {info.spell && (
                            <Text fontSize="xs" color="cyan.300" fontWeight={600} mt={1}>
                              {info.spell}
                            </Text>
                          )}
                        </Box>
                        <Link
                          as={RouterLink}
                          to={`${CLASS_PAGE_PATH}/${info.name.toLowerCase()}`}
                          fontSize="xs"
                          color="grey500"
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}
                          _hover={{ color: 'blue.300', textDecoration: 'underline' }}
                        >
                          Learn more
                        </Link>
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
                isLoading={selectClassTx.isLoading}
                loadingText="Selecting..."
                isDisabled={!selectedClass}
              >
                {selectedClass
                  ? `Become a ${ADVANCED_CLASS_INFO[selectedClass].name}`
                  : 'Select a Class'}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
