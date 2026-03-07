import { Text, useDisclosure, VStack } from '@chakra-ui/react';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
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

type MovementContextType = {
  isRefreshing: boolean;
  moveProgress: TransactionProgress;
  moveStatusMessage: string;
  onMove: (direction: 'up' | 'down' | 'left' | 'right') => void;
  onSetIsMovementDisabled: (isDisabled: boolean) => void;
};

const MovementContext = createContext<MovementContextType>({
  isRefreshing: false,
  moveProgress: { phase: 'idle', percent: 0, transitionMs: 0 },
  moveStatusMessage: '',
  onMove: () => {},
  onSetIsMovementDisabled: () => {},
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
    systemCalls: { move },
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

  // Optimistic position: tracks where the character logically IS after confirmed
  // moves, even before the MUD store syncs. This allows rapid sequential moves
  // without waiting for store sync between each one.
  const optimisticPositionRef = useRef<{ x: number; y: number } | null>(null);

  // Sync optimistic position back to store position when store catches up
  // or when we don't have an optimistic position yet
  useEffect(() => {
    if (position && !optimisticPositionRef.current) {
      optimisticPositionRef.current = { x: position.x, y: position.y };
    }
  }, [position]);

  const moveTx = useTransaction({
    actionName: 'moving',
    silent: true,
    maxAttempts: 2,
    estimatedDurationMs: 1000,
  });

  const onSetIsMovementDisabled = useCallback((isDisabled: boolean) => {
    setIsMovementDisabled(isDisabled);
  }, []);

  const onMove = useCallback(
    async (direction: 'up' | 'down' | 'left' | 'right') => {
      if (isMovementDisabled) return;
      if (isMoving) return;
      if (!isSpawned) return;
      if (currentBattle) return;
      if (isMessageInputFocused) return;

      if (!delegatorAddress) return;
      if (!character) return;

      // Use optimistic position (tracks confirmed moves ahead of store sync)
      const currentPos = optimisticPositionRef.current || position;
      if (!currentPos) return;

      const { x, y } = currentPos;

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

      let newX = x;
      let newY = y;

      switch (direction) {
        case 'up':
          newY = y + 1;
          break;
        case 'down':
          newY = y - 1;
          break;
        case 'left':
          newX = x - 1;
          break;
        case 'right':
          newX = x + 1;
          break;
        default:
          break;
      }

      setIsMoving(true);
      const result = await moveTx.execute(() => move(character.id, newX, newY));
      if (result?.success) {
        // Update optimistic position immediately — don't wait for store sync.
        // This allows the next move to start from the correct position.
        optimisticPositionRef.current = { x: newX, y: newY };
      } else {
        // Move failed — reset optimistic position to store truth
        optimisticPositionRef.current = position ? { x: position.x, y: position.y } : null;
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
        isRefreshing: isMoving,
        moveProgress: moveTx.progress,
        moveStatusMessage: moveTx.statusMessage || 'Moving...',
        onMove,
        onSetIsMovementDisabled,
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
