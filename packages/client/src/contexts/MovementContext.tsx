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
import { GAME_BOARD_PATH } from '../Routes';

import { useBattle } from './BattleContext';
import { useCharacter } from './CharacterContext';
import { useChat } from './ChatContext';
import { useMap } from './MapContext';
import { useMUD } from './MUDContext';

const PREVENT_DEFAULT_KEYS = ['ArrowUp', 'ArrowDown'];

type MovementContextType = {
  isRefreshing: boolean;
  onMove: (direction: 'up' | 'down' | 'left' | 'right') => void;
  onSetIsMovementDisabled: (isDisabled: boolean) => void;
};

const MovementContext = createContext<MovementContextType>({
  isRefreshing: false,
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
  const { renderError } = useToast();
  const {
    delegatorAddress,
    systemCalls: { move },
  } = useMUD();

  const {
    isOpen: isNoMoveEquippedModalOpen,
    onClose: onCloseNoMoveEquippedModal,
    onOpen: onOpenNoMoveEquippedModal,
  } = useDisclosure();

  const { character, isMoveEquipped } = useCharacter();
  const { isFetchingEntities, isSpawned, position } = useMap();
  const { currentBattle } = useBattle();
  const { isMessageInputFocused } = useChat();

  const [isMoving, setIsMoving] = useState(false);
  const [isMovementDisabled, setIsMovementDisabled] = useState(false);

  const onSetIsMovementDisabled = useCallback((isDisabled: boolean) => {
    setIsMovementDisabled(isDisabled);
  }, []);

  const onMove = useCallback(
    async (direction: 'up' | 'down' | 'left' | 'right') => {
      try {
        if (isMovementDisabled) return;
        if (isMoving) return;
        if (!isSpawned) return;
        if (currentBattle) return;
        if (isMessageInputFocused) return;

        setIsMoving(true);

        if (!delegatorAddress) {
          throw new Error('Burner not found.');
        }

        if (!position) {
          throw new Error('Position not found.');
        }

        if (!character) {
          throw new Error('Character not found.');
        }

        const { x, y } = position;

        if (
          (direction === 'up' && position.y === 9) ||
          (direction === 'down' && position.y === 0) ||
          (direction === 'left' && position.x === 0) ||
          (direction === 'right' && position.x === 9)
        ) {
          return;
        }

        if (!isMoveEquipped) {
          if (
            (direction === 'up' && position.y === 4) ||
            (direction === 'right' && position.x === 4)
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

        const { error, success } = await move(character.id, newX, newY);

        if (error && !success) {
          throw new Error(error);
        }
      } catch (e) {
        renderError((e as Error)?.message ?? 'Failed to move.', e);
      } finally {
        setIsMoving(false);
      }
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
      onOpenNoMoveEquippedModal,
      position,
      renderError,
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
        isRefreshing: isFetchingEntities || isMoving,
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
