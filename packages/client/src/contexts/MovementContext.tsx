import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';

import { useToast } from '../hooks/useToast';
import { GAME_BOARD_PATH } from '../Routes';
import { useBattle } from './BattleContext';
import { useCharacter } from './CharacterContext';
import { useChat } from './ChatContext';
import { useMap } from './MapContext';
import { useMUD } from './MUDContext';

type MovementContextType = {
  isRefreshing: boolean;
  onMove: (direction: 'up' | 'down' | 'left' | 'right') => void;
};

const MovementContext = createContext<MovementContextType>({
  isRefreshing: false,
  onMove: () => {},
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

  const { character } = useCharacter();
  const { isFetchingEntities, isSpawned, position } = useMap();
  const { currentBattle } = useBattle();
  const { isMessageInputFocused } = useChat();

  const [isMoving, setIsMoving] = useState(false);

  const onMove = useCallback(
    async (direction: 'up' | 'down' | 'left' | 'right') => {
      try {
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
      isMoving,
      isSpawned,
      move,
      position,
      renderError,
    ],
  );

  useEffect(() => {
    if (pathname !== GAME_BOARD_PATH) return;

    const listener = (event: KeyboardEvent) => {
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
  }, [onMove, pathname]);

  return (
    <MovementContext.Provider
      value={{
        isRefreshing: isFetchingEntities || isMoving,
        onMove,
      }}
    >
      {children}
    </MovementContext.Provider>
  );
};

export const useMovement = (): MovementContextType =>
  useContext(MovementContext);
