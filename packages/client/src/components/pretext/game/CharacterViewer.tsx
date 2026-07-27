import { Box, HStack, Text, VStack } from '@chakra-ui/react';

import { Race } from '../../../utils/types';

export type EquippedItemSlot = {
  name: string;
  socket: string;
};

/**
 * Text-only character summary retained behind the old component boundary.
 * Character inspection remains useful without models, WebGL, or equipment art.
 */
export function CharacterViewer({
  race,
  height = 280,
  equippedItems,
  weaponName,
}: {
  race: Race;
  height?: number;
  cellSize?: number;
  autoReveal?: boolean;
  equippedItems?: EquippedItemSlot[];
  weaponName?: string;
}): JSX.Element {
  const equipment = [...(equippedItems ?? [])];
  if (weaponName && !equipment.some(item => item.name === weaponName)) {
    equipment.push({ name: weaponName, socket: 'hand_R.socket' });
  }

  const raceName = Race[race] ?? 'Adventurer';

  return (
    <Box
      alignItems="center"
      border="1px solid rgba(196,184,158,0.16)"
      display="flex"
      h={`${height}px`}
      justifyContent="center"
      position="relative"
      w="100%"
    >
      <VStack maxW="360px" px={6} spacing={5} textAlign="center" w="100%">
        <Text
          color="#D4A54A"
          fontFamily="'Cinzel', serif"
          fontSize={{ base: 'xl', md: '2xl' }}
          fontWeight={700}
          letterSpacing="0.18em"
          textTransform="uppercase"
        >
          {raceName}
        </Text>
        <Box bg="rgba(196,184,158,0.16)" h="1px" w="80px" />
        <VStack spacing={2} w="100%">
          <Text
            color="#5A5040"
            fontFamily="'Fira Code', monospace"
            fontSize="9px"
            fontWeight={700}
            letterSpacing="0.14em"
          >
            EQUIPPED
          </Text>
          {equipment.length > 0 ? (
            equipment.map(item => (
              <HStack
                borderBottom="1px solid rgba(196,184,158,0.08)"
                justify="space-between"
                key={`${item.socket}:${item.name}`}
                py={1}
                w="100%"
              >
                <Text color="#8A7E6A" fontFamily="mono" fontSize="9px">
                  {item.socket
                    .replace('.socket', '')
                    .replace('_R', '')
                    .replace('_L', '')}
                </Text>
                <Text color="#C4B89E" fontSize="sm" noOfLines={1}>
                  {item.name}
                </Text>
              </HStack>
            ))
          ) : (
            <Text color="#6A6050" fontFamily="mono" fontSize="xs">
              No equipment
            </Text>
          )}
        </VStack>
      </VStack>
    </Box>
  );
}
