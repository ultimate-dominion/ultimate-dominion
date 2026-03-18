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
import { useToast } from '../hooks/useToast';
import { useTransaction } from '../hooks/useTransaction';
import type { TransactionProgress } from '../hooks/useTransactionProgress';
import { GAME_BOARD_PATH } from '../Routes';

import { useBattle } from './BattleContext';
import { useCharacter } from './CharacterContext';
import { useChat } from './ChatContext';
import { useMap } from './MapContext';
import { useMUD } from './MUDContext';

const PREVENT_DEFAULT_KEYS = ['ArrowUp', 'ArrowDown'];

const AUTO_ADVENTURE_KEY = 'ud_auto_adventure';

const OUTER_REALMS_NARRATIVES = [
  'You press your hands against the cave wall. Something pulses beneath the stone — warm, almost alive. But the way forward is sealed.',
  'A sound echoes from beyond the boundary — skittering claws on rock, then silence. Whatever lives out there, it knows you\'re not ready.',
  'The air grows cold at the threshold. Shadows twist into shapes you can\'t quite make out. A voice, barely a whisper: "Not yet."',
  'You reach for the passage ahead, but the darkness pushes back. The cave has decided — you haven\'t earned this path.',
  'The ground trembles beneath your feet. Through a crack in the wall, you glimpse something vast moving in the dark. You step back.',
  'A bitter wind howls from the depths beyond. You smell iron and ash. Every instinct says: turn around.',
];

type MovementContextType = {
  autoAdventureMode: boolean;
  isRefreshing: boolean;
  moveProgress: TransactionProgress;
  moveStatusMessage: string;
  onMove: (direction: 'up' | 'down' | 'left' | 'right') => void;
  onSetIsMovementDisabled: (isDisabled: boolean) => void;
  onToggleAutoAdventure: () => void;
};

const MovementContext = createContext<MovementContextType>({
  autoAdventureMode: false,
  isRefreshing: false,
  moveProgress: { phase: 'idle', percent: 0, transitionMs: 0 },
  moveStatusMessage: '',
  onMove: () => {},
  onSetIsMovementDisabled: () => {},
  onToggleAutoAdventure: () => {},
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
    systemCalls: { move },
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
  const { isSpawned, position } = useMap();
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
      character,
      currentBattle,
      delegatorAddress,
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
        isRefreshing: isMoving,
        moveProgress: moveTx.progress,
        moveStatusMessage: moveTx.statusMessage || (autoAdventureMode ? 'Adventuring...' : 'Moving...'),
        onMove,
        onSetIsMovementDisabled,
        onToggleAutoAdventure,
      }}
    >
      {children}
      <InfoModal
        heading="No moves equipped!"
        isOpen={isNoMoveEquippedModalOpen}
        onClose={onCloseNoMoveEquippedModal}
      >
        <VStack p={4} spacing={4}>
          <IoIosWarning color="orange" size={40} />
          <Text>
            You cannot enter the{' '}
            <Text as="span" fontWeight={700}>
              Outer Realms
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
          <Text
            color="#5A5040"
            fontSize="xs"
            letterSpacing="0.1em"
            textAlign="center"
          >
            Reach Level 5 to enter the Outer Realms.
          </Text>
        </VStack>
      </InfoModal>
    </MovementContext.Provider>
  );
};

export const useMovement = (): MovementContextType =>
  useContext(MovementContext);
