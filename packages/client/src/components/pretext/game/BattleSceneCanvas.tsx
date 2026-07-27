import { Box, HStack, keyframes, Text, VStack } from '@chakra-ui/react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import type {
  AttackSignal,
  BattleSceneHandle,
} from '../../../hooks/useBattleSceneSignals';
import { Race } from '../../../utils/types';
import { CharacterMark, MonsterMark } from '../../EntityMark';

export type BattleSceneProps = {
  monsterName: string;
  monsterHp: number;
  monsterMaxHp: number;
  monsterDefeated: boolean;
  monsterLevel: number;
  userHp: number;
  userMaxHp: number;
  userName: string;
  userDefeated: boolean;
  userRace?: Race;
};

type SideAttack = { isPlayerAttack: boolean };

export function spliceSameSideAttacks<T extends SideAttack>(
  attacks: T[],
  isPlayerAttack: boolean,
): void {
  for (let i = attacks.length - 1; i >= 0; i--) {
    if (attacks[i].isPlayerAttack === isPlayerAttack) {
      attacks.splice(i, 1);
    }
  }
}

const strike = keyframes`
  0% { transform: translateY(0); opacity: 0.7; }
  35% { transform: translateY(-4px); opacity: 1; }
  100% { transform: translateY(0); opacity: 0.7; }
`;

const hitFlash = keyframes`
  0%, 100% { border-color: rgba(184,92,58,0.35); }
  50% { border-color: rgba(232,92,70,0.95); }
`;

function hpPercent(current: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, (current / max) * 100));
}

export const BattleSceneCanvas = forwardRef<
  BattleSceneHandle,
  BattleSceneProps
>(function BattleSceneCanvas(
  {
    monsterName,
    monsterHp,
    monsterMaxHp,
    monsterDefeated,
    monsterLevel,
    userHp,
    userMaxHp,
    userName,
    userDefeated,
  },
  ref,
) {
  const [lastSignal, setLastSignal] = useState<AttackSignal | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerAttack = useCallback((signal: AttackSignal) => {
    setLastSignal(signal);
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(() => setLastSignal(null), 1100);
  }, []);

  useImperativeHandle(ref, () => ({ triggerAttack }), [triggerAttack]);

  useEffect(
    () => () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    },
    [],
  );

  const playerActive = lastSignal?.isPlayerAttack === true;
  const monsterActive = lastSignal?.isPlayerAttack === false;
  const playerHit = monsterActive && lastSignal?.didHit;
  const monsterHit = playerActive && lastSignal?.didHit;

  return (
    <Box
      bg="#0D0B09"
      borderBottom="1px solid rgba(196,184,158,0.1)"
      h="100%"
      minH="200px"
      overflow="hidden"
      position="relative"
    >
      <HStack align="stretch" h="100%" spacing={0}>
        <VStack
          animation={playerHit ? `${hitFlash} 0.35s ease-out` : undefined}
          borderRight="1px solid rgba(196,184,158,0.1)"
          justify="center"
          opacity={userDefeated ? 0.45 : 1}
          px={{ base: 3, md: 8 }}
          spacing={3}
          w="50%"
        >
          <CharacterMark
            animation={playerActive ? `${strike} 0.4s ease-out` : undefined}
            boxSize={{ base: '56px', md: '72px' }}
            name={userName}
          />
          <VStack spacing={0.5}>
            <Text color="#E8DCC8" fontFamily="'Cinzel', serif" fontWeight={700}>
              {userName}
            </Text>
            <Text color="#8A7E6A" fontFamily="mono" fontSize="10px">
              YOU · HP {userHp}/{userMaxHp}
            </Text>
          </VStack>
          <Box bg="#2A241E" h="3px" maxW="180px" w="100%">
            <Box bg="#5A8A3E" h="100%" w={`${hpPercent(userHp, userMaxHp)}%`} />
          </Box>
        </VStack>

        <VStack
          animation={monsterHit ? `${hitFlash} 0.35s ease-out` : undefined}
          justify="center"
          opacity={monsterDefeated ? 0.45 : 1}
          px={{ base: 3, md: 8 }}
          spacing={3}
          w="50%"
        >
          <MonsterMark
            animation={monsterActive ? `${strike} 0.4s ease-out` : undefined}
            boxSize={{ base: '56px', md: '72px' }}
            name={monsterName}
          />
          <VStack spacing={0.5}>
            <Text
              color={monsterDefeated ? '#8A7E6A' : '#E8DCC8'}
              fontFamily="'Cinzel', serif"
              fontWeight={700}
              textAlign="center"
            >
              {monsterName}
            </Text>
            <Text color="#8A7E6A" fontFamily="mono" fontSize="10px">
              FOE · LV {monsterLevel} · HP {monsterHp}/{monsterMaxHp}
            </Text>
          </VStack>
          <Box bg="#2A241E" h="3px" maxW="180px" w="100%">
            <Box
              bg="#B85C3A"
              h="100%"
              w={`${hpPercent(monsterHp, monsterMaxHp)}%`}
            />
          </Box>
        </VStack>
      </HStack>

      {lastSignal && (
        <VStack
          bg="rgba(13,11,9,0.94)"
          border="1px solid rgba(212,165,74,0.35)"
          bottom={{ base: 2, md: 4 }}
          left="50%"
          maxW="80%"
          px={4}
          py={2}
          position="absolute"
          spacing={0}
          transform="translateX(-50%)"
        >
          <Text
            color={
              lastSignal.callout.tone === 'crit'
                ? '#D4A54A'
                : lastSignal.callout.tone === 'enemy'
                  ? '#B85C3A'
                  : '#C4B89E'
            }
            fontFamily="'Fira Code', monospace"
            fontSize="10px"
            fontWeight={800}
            letterSpacing="0.08em"
          >
            {lastSignal.callout.title}
          </Text>
          <Text color="#8A7E6A" fontSize="xs" noOfLines={1}>
            {lastSignal.callout.detail}
          </Text>
        </VStack>
      )}
    </Box>
  );
});
