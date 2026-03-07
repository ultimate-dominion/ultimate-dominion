import { Box } from '@chakra-ui/react';
import { useMemo } from 'react';

import type { TransactionProgress } from '../hooks/useTransactionProgress';

const COLORS: Record<string, string> = {
  filling: '#C87A2A',
  completing: '#5A8A3E',
  error: '#D44',
};

type TransactionProgressBarProps = {
  progressA: TransactionProgress;
  progressB: TransactionProgress;
};

/**
 * Unified progress bar that shows whichever of two progress sources is active.
 * Sits between the battle panel and the dialog panel.
 */
export const TransactionProgressBar = ({
  progressA,
  progressB,
}: TransactionProgressBarProps): JSX.Element => {
  const progress = useMemo(() => {
    if (progressA.phase !== 'idle') return progressA;
    return progressB;
  }, [progressA, progressB]);

  const color = COLORS[progress.phase] ?? COLORS.filling;
  const isVisible = progress.phase !== 'idle' && progress.phase !== 'done';

  return (
    <Box
      w="100%"
      h="6px"
      bg="rgba(0,0,0,0.4)"
      overflow="hidden"
      flexShrink={0}
    >
      <Box
        h="100%"
        bg={color}
        w={`${progress.percent}%`}
        opacity={isVisible ? 1 : 0}
        boxShadow={isVisible ? `0 0 8px ${color}` : 'none'}
        transition={`width ${progress.transitionMs}ms ease-out, opacity 400ms ease, background-color 200ms ease`}
      />
    </Box>
  );
};
