import { Text, useDisclosure, VStack } from '@chakra-ui/react';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { IoIosWarning } from 'react-icons/io';
import { Link, useLocation } from 'react-router-dom';

import { InfoModal } from '../components/InfoModal';
import { ZoneExitPrompt } from '../components/ZoneExitPrompt';
import { useToast } from '../hooks/useToast';
import { useTransaction } from '../hooks/useTransaction';
import type { TransactionProgress } from '../hooks/useTransactionProgress';
import { SHOW_Z2 } from '../lib/env';
import { GAME_BOARD_PATH } from '../Routes';
import { canUseDarkCaveExit } from '../utils/zoneExit';

import { useBattle } from './BattleContext';
import { useCharacter } from './CharacterContext';
import { useChat } from './ChatContext';
import { useMap } from './MapContext';
import { useMUD } from './MUDContext';

const PREVENT_DEFAULT_KEYS = ['ArrowUp', 'ArrowDown'];

const AUTO_ADVENTURE_KEY = 'ud_auto_adventure';

const OUTER_REALMS_NARRATIVES = [
  'You press your hands against the stone. Something pulses beneath it — warm, almost alive. Your fingers pull away on their own.',
  'Skittering. Fast, deliberate, close. Then nothing. The silence that follows is worse.',
  'The air turns to ice at the threshold. Shadows coil at the edges of your torchlight, twisting into shapes that shouldn\'t exist.',
  'A whisper slithers through the crack in the wall. Not words — older than words. The hairs on your neck stand on end.',
  'The ground trembles. Through a fissure in the rock, something vast shifts in the dark. A single eye, pale and unblinking, finds yours.',
  'A bitter wind howls from the depths. It carries the smell of iron and old bone. Something down there is breathing.',
  'You step forward and the darkness pushes back — thick, deliberate, aware. It does not want you here.',
  'Scratching from the other side of the wall. Rhythmic. Patient. As though something has been waiting a very long time.',
];

type MovementContextType = {
  autoAdventureMode: boolean;
  clearPendingZoneTransition: () => void;
  isRefreshing: boolean;
  moveProgress: TransactionProgress;
  moveStatusMessage: string;
  onMove: (direction: 'up' | 'down' | 'left' | 'right') => void;
  onSetIsMovementDisabled: (isDisabled: boolean) => void;
  onToggleAutoAdventure: () => void;
  pendingZoneTransition: boolean;
};

const MovementContext = createContext<MovementContextType>({
  autoAdventureMode: false,
  clearPendingZoneTransition: () => {},
  isRefreshing: false,
  moveProgress: { phase: 'idle', percent: 0, transitionMs: 0 },
  moveStatusMessage: '',
  onMove: () => {},
  onSetIsMovementDisabled: () => {},
  onToggleAutoAdventure: () => {},
  pendingZoneTransition: false,
});

export type MovementProviderProps = {
  children: ReactNode;
};

export const MovementProvider = ({
  children,
}: MovementProviderProps): JSX.Element => {
  const { pathname } = useLocation();
  const {
    delegatorAddress,
    systemCalls: { move, transitionZone },
  } = useMUD();

  const {
    isOpen: isNoMoveEquippedModalOpen,
    onClose: onCloseNoMoveEquippedModal,
    onOpen: onOpenNoMoveEquippedModal,
  } = useDisclosure();

  const {
    isOpen: isOuterRealmsBlockedOpen,
    onClose: onCloseOuterRealmsBlocked,
    onOpen: onOpenOuterRealmsBlocked,
  } = useDisclosure();

  const [outerRealmsNarrative, setOuterRealmsNarrative] = useState('');

  const { character, isMoveEquipped } = useCharacter();
  const { currentZone, displayPosition, isSpawned, position } = useMap();
  const { currentBattle } = useBattle();
  const { isMessageInputFocused } = useChat();
  const { renderError, renderWarning } = useToast();

  const [isMovementDisabled, setIsMovementDisabled] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [autoAdventureMode, setAutoAdventureMode] = useState(
    () => localStorage.getItem(AUTO_ADVENTURE_KEY) === 'true',
  );

  // Auto-disable auto adventure when character dies — ensures the death/respawn
  // screen renders instead of being suppressed by BattleContext.
  useEffect(() => {
    if (autoAdventureMode && !isSpawned) {
      setAutoAdventureMode(false);
      localStorage.setItem(AUTO_ADVENTURE_KEY, 'false');
    }
  }, [autoAdventureMode, isSpawned]);

  const moveTx = useTransaction({
    actionName: autoAdventureMode ? 'adventuring' : 'moving',
    silent: true,
    maxAttempts: 1,
    estimatedDurationMs: 1000,
  });

  const onSetIsMovementDisabled = useCallback((isDisabled: boolean) => {
    setIsMovementDisabled(isDisabled);
  }, []);

  const onToggleAutoAdventure = useCallback(() => {
    setAutoAdventureMode(prev => {
      const next = !prev;
      localStorage.setItem(AUTO_ADVENTURE_KEY, String(next));
      return next;
    });
  }, []);

  // ── Zone exit state ──
  const [isZoneExitPromptOpen, setIsZoneExitPromptOpen] = useState(false);
  const [pendingZoneTransition, setPendingZoneTransition] = useState(false);

  const transitionZoneTx = useTransaction({
    actionName: 'zone transition',
    showSuccessToast: false,
  });

  const onConfirmZoneExit = useCallback(async () => {
    if (!character) return;
    const result = await transitionZoneTx.execute(async () => {
      const { error, success } = await transitionZone(character.id, 2);
      if (error && !success) throw new Error(error);
      return { success: true };
    });
    if (result !== undefined) {
      setIsZoneExitPromptOpen(false);
      setPendingZoneTransition(true);
    }
  }, [character, transitionZone, transitionZoneTx]);

  const clearPendingZoneTransition = useCallback(() => {
    setPendingZoneTransition(false);
  }, []);

  const onMove = useCallback(
    async (direction: 'up' | 'down' | 'left' | 'right') => {
      if (isMovementDisabled) { console.log('[move] blocked: isMovementDisabled'); return; }
      if (isMoving) { console.log('[move] blocked: isMoving'); return; }
      if (!isSpawned) { console.log('[move] blocked: not spawned'); return; }
      if (currentBattle) { console.log(`[move] blocked: currentBattle ${currentBattle.encounterId.slice(0, 10)}... end=${currentBattle.end}`); return; }
      if (isMessageInputFocused) return;

      if (!delegatorAddress) return;
      if (!character) return;
      if (!position) return;

      const { x, y } = position;

      if (
        (direction === 'up' && y === 9) ||
        (direction === 'down' && y === 0) ||
        (direction === 'left' && x === 0) ||
        (direction === 'right' && x === 9)
      ) {
        // Zone exit: at exit tile pressing north
        if (
          direction === 'up' &&
          canUseDarkCaveExit({
            autoAdventureMode,
            currentZone,
            displayPosition,
            level: character.level,
            showZ2: SHOW_Z2,
          })
        ) {
          setIsZoneExitPromptOpen(true);
        }
        return;
      }

      // Block entry into Outer Realms for players under level 5
      const playerLevel = character.level ? Number(character.level) : 1;
      if (playerLevel < 5) {
        const targetX = direction === 'right' ? x + 1 : direction === 'left' ? x - 1 : x;
        const targetY = direction === 'up' ? y + 1 : direction === 'down' ? y - 1 : y;
        if (targetX >= 5 || targetY >= 5) {
          const narrative = OUTER_REALMS_NARRATIVES[Math.floor(Math.random() * OUTER_REALMS_NARRATIVES.length)];
          setOuterRealmsNarrative(narrative);
          onOpenOuterRealmsBlocked();
          return;
        }
      }

      if (!isMoveEquipped) {
        if (
          (direction === 'up' && y === 4) ||
          (direction === 'right' && x === 4)
        ) {
          onOpenNoMoveEquippedModal();
          return;
        }
      }

      setIsMoving(true);
      const result = await moveTx.execute(() => move(character.id, direction));
      if (result && !result.success && result.error) {
        if (result.severity === 'warning') {
          renderWarning(result.error);
        } else {
          renderError(result.error);
        }
      }
      setIsMoving(false);
    },
    [
      autoAdventureMode,
      character,
      currentBattle,
      currentZone,
      delegatorAddress,
      displayPosition,
      isMessageInputFocused,
      isMoveEquipped,
      isMovementDisabled,
      isMoving,
      isSpawned,
      move,
      moveTx,
      onOpenNoMoveEquippedModal,
      position,
      renderError,
      renderWarning,
    ],
  );

  useEffect(() => {
    if (pathname !== GAME_BOARD_PATH) return;

    const listener = (event: KeyboardEvent) => {
      if (PREVENT_DEFAULT_KEYS.includes(event.key)) {
        event.preventDefault();
      }

      if (isMovementDisabled) return;
      if (isMoving) return;
      if (!isSpawned) return;
      if (currentBattle) return;
      if (isMessageInputFocused) return;

      switch (event.key) {
        case 'ArrowUp':
          onMove('up');
          break;
        case 'ArrowDown':
          onMove('down');
          break;
        case 'ArrowLeft':
          onMove('left');
          break;
        case 'ArrowRight':
          onMove('right');
          break;
        case 'w':
          onMove('up');
          break;
        case 's':
          onMove('down');
          break;
        case 'a':
          onMove('left');
          break;
        case 'd':
          onMove('right');
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', listener);
    // eslint-disable-next-line consistent-return
    return () => window.removeEventListener('keydown', listener);
  }, [
    currentBattle,
    autoAdventureMode,
    isMessageInputFocused,
    isMovementDisabled,
    isMoving,
    isSpawned,
    onMove,
    pathname,
  ]);

  return (
    <MovementContext.Provider
      value={{
        autoAdventureMode,
        clearPendingZoneTransition,
        isRefreshing: isMoving,
        moveProgress: moveTx.progress,
        moveStatusMessage: moveTx.statusMessage || (autoAdventureMode ? 'Adventuring...' : 'Moving...'),
        onMove,
        onSetIsMovementDisabled,
        onToggleAutoAdventure,
        pendingZoneTransition,
      }}
    >
      {children}

      {SHOW_Z2 && (
        <ZoneExitPrompt
          isOpen={isZoneExitPromptOpen}
          isLoading={transitionZoneTx.isLoading}
          onConfirm={onConfirmZoneExit}
          onCancel={() => setIsZoneExitPromptOpen(false)}
        />
      )}

      <InfoModal
        heading="No moves equipped!"
        isOpen={isNoMoveEquippedModalOpen}
        onClose={onCloseNoMoveEquippedModal}
      >
        <VStack p={4} spacing={4}>
          <IoIosWarning color="orange" size={40} />
          <Text>
            You cannot enter{' '}
            <Text as="span" fontWeight={700}>
              the Winding Dark
            </Text>{' '}
            without at least 1 weapon or spell equipped. Go to your{' '}
            <Text
              as={Link}
              color="blue"
              onClick={onCloseNoMoveEquippedModal}
              to={`/characters/${character?.id}`}
              _hover={{
                textDecoration: 'underline',
              }}
            >
              character page
            </Text>{' '}
            to equip a move.
          </Text>
        </VStack>
      </InfoModal>
      <InfoModal
        heading="The Way is Sealed"
        isOpen={isOuterRealmsBlockedOpen}
        onClose={onCloseOuterRealmsBlocked}
      >
        <VStack p={4} spacing={4}>
          <Text
            color="#C4B89E"
            fontStyle="italic"
            lineHeight="1.8"
            textAlign="center"
          >
            {outerRealmsNarrative}
          </Text>
        </VStack>
      </InfoModal>
    </MovementContext.Provider>
  );
};

export const useMovement = (): MovementContextType =>
  useContext(MovementContext);
