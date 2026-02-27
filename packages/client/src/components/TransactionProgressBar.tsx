import { Box } from '@chakra-ui/react';

import type { TransactionProgress } from '../hooks/useTransactionProgress';

const COLORS: Record<string, string> = {
  filling: '#C87A2A',
  completing: '#5A8A3E',
  error: '#D44',
};

type TransactionProgressBarProps = {
  progress: TransactionProgress;
};

export const TransactionProgressBar = ({
  progress,
}: TransactionProgressBarProps): JSX.Element | null => {
  if (progress.phase === 'idle') return null;

  const color = COLORS[progress.phase] ?? COLORS.filling;
  const opacity = progress.phase === 'done' ? 0 : 1;

  return (
    <Box
      position="absolute"
      top={0}
      left={0}
      w="100%"
      h="3px"
      zIndex={10}
    >
      <Box
        h="100%"
        bg={color}
        w={`${progress.percent}%`}
        opacity={opacity}
        transition={`width ${progress.transitionMs}ms ease-out, opacity 400ms ease, background-color 200ms ease`}
      />
    </Box>
  );
};
