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
import { useTransaction } from '../hooks/useTransaction';
import type { TransactionProgress } from '../hooks/useTransactionProgress';
import { GAME_BOARD_PATH } from '../Routes';

import { useBattle } from './BattleContext';
import { useCharacter } from './CharacterContext';
import { useChat } from './ChatContext';
import { useMap } from './MapContext';
import { useMUD } from './MUDContext';

const PREVENT_DEFAULT_KEYS = ['ArrowUp', 'ArrowDown'];

const GRIND_MODE_KEY = 'ud_grind_mode';

type MovementContextType = {
  grindMode: boolean;
  isRefreshing: boolean;
  moveProgress: TransactionProgress;
  moveStatusMessage: string;
  onMove: (direction: 'up' | 'down' | 'left' | 'right') => void;
  onSetIsMovementDisabled: (isDisabled: boolean) => void;
  onToggleGrindMode: () => void;
};

const MovementContext = createContext<MovementContextType>({
  grindMode: false,
  isRefreshing: false,
  moveProgress: { phase: 'idle', percent: 0, transitionMs: 0 },
  moveStatusMessage: '',
  onMove: () => {},
  onSetIsMovementDisabled: () => {},
  onToggleGrindMode: () => {},
});

export type MovementProviderProps = {
  children: ReactNode;
};

export const MovementProvider = ({
  children,
}: MovementProviderProps): JSX.Element => {
  const { pathname } = useLocation();
  const {
    authMethod,
    delegatorAddress,
    systemCalls: { autoAdventure, move },
  } = useMUD();

  const {
    isOpen: isNoMoveEquippedModalOpen,
    onClose: onCloseNoMoveEquippedModal,
    onOpen: onOpenNoMoveEquippedModal,
  } = useDisclosure();

  const { character, isMoveEquipped } = useCharacter();
  const { isSpawned, position } = useMap();
  const { currentBattle } = useBattle();
  const { isMessageInputFocused } = useChat();

  const [isMovementDisabled, setIsMovementDisabled] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [grindMode, setGrindMode] = useState(
    () => localStorage.getItem(GRIND_MODE_KEY) === 'true',
  );

  // Auto-disable grind mode when character dies — ensures the death/respawn
  // screen renders instead of being suppressed by BattleContext.
  useEffect(() => {
    if (grindMode && !isSpawned) {
      setGrindMode(false);
      localStorage.setItem(GRIND_MODE_KEY, 'false');
    }
  }, [grindMode, isSpawned]);

  const moveTx = useTransaction({
    actionName: grindMode ? 'adventuring' : 'moving',
    silent: true,
    maxAttempts: 2,
    estimatedDurationMs: 1000,
  });

  const onSetIsMovementDisabled = useCallback((isDisabled: boolean) => {
    setIsMovementDisabled(isDisabled);
  }, []);

  const onToggleGrindMode = useCallback(() => {
    setGrindMode(prev => {
      const next = !prev;
      localStorage.setItem(GRIND_MODE_KEY, String(next));
      return next;
    });
  }, []);

  const onMove = useCallback(
    async (direction: 'up' | 'down' | 'left' | 'right') => {
      if (isMovementDisabled) return;
      if (isMoving) return;
      if (!isSpawned) return;
      // In grind mode, skip the currentBattle guard — combat is resolved in the
      // same tx, so the client never sees an "active" encounter state. The store
      // will have a completed CombatEncounter + CombatOutcome from the receipt.
      if (!grindMode && currentBattle) return;
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
      if (grindMode) {
        await moveTx.execute(() => autoAdventure(character.id, direction));
      } else {
        await moveTx.execute(() => move(character.id, direction));
      }
      setIsMoving(false);
    },
    [
      autoAdventure,
      character,
      currentBattle,
      delegatorAddress,
      grindMode,
      isMessageInputFocused,
      isMoveEquipped,
      isMovementDisabled,
      isMoving,
      isSpawned,
      move,
      moveTx,
      onOpenNoMoveEquippedModal,
      position,
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
      if (!grindMode && currentBattle) return;
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
    grindMode,
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
        grindMode,
        isRefreshing: isMoving,
        moveProgress: moveTx.progress,
        moveStatusMessage: moveTx.statusMessage || (grindMode ? 'Adventuring...' : 'Moving...'),
        onMove,
        onSetIsMovementDisabled,
        onToggleGrindMode,
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
    </MovementContext.Provider>
  );
};

export const useMovement = (): MovementContextType =>
  useContext(MovementContext);
