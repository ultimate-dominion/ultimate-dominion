import { useToast as useChakraToast } from '@chakra-ui/react';
import { useCallback } from 'react';

import {
  getError,
  INSUFFICIENT_FUNDS_MESSAGE,
  USER_ERRORS,
} from '../utils/errors';

export const useToast = (): {
  renderError: (errorMsg: string, errorLog?: unknown) => void;
  renderWarning: (msg: string) => void;
  renderSuccess: (msg: string) => void;
} => {
  const toast = useChakraToast();

  const renderError = useCallback(
    (errorMsg: string, errorLog?: unknown) => {
      const formattedErrorLog = getError(errorLog);

      if (USER_ERRORS.includes(formattedErrorLog)) {
        return;
      }

      if (errorLog) {
        // eslint-disable-next-line no-console
        console.error(errorLog);
      }

      if ((errorLog as Error)?.message === INSUFFICIENT_FUNDS_MESSAGE) {
        toast({
          description: (errorLog as Error).message,
          position: 'top',
          status: 'warning',
          containerStyle: {
            bg: 'yellow',
          },
        });
        return;
      }

      toast({
        description: errorMsg,
        position: 'top',
        status: 'error',
        containerStyle: {
          bg: 'red',
        },
      });
    },
    [toast],
  );

  const renderWarning = useCallback(
    (msg: string) => {
      toast({
        description: msg,
        position: 'top',
        status: 'warning',
        containerStyle: {
          bg: 'yellow',
        },
      });
    },
    [toast],
  );

  const renderSuccess = useCallback(
    (msg: string) => {
      toast({
        description: msg,
        position: 'top',
        status: 'success',
        containerStyle: {
          bg: 'green',
        },
      });
    },
    [toast],
  );

  return { renderError, renderWarning, renderSuccess };
};
