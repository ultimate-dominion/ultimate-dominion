import { useToast as useChakraToast } from '@chakra-ui/react';
import { useCallback } from 'react';

import { getErrorMessage, USER_ERRORS } from '../utils/errors';

export const useToast = (): {
  renderError: (error: unknown, defaultError?: string) => void;
  renderWarning: (msg: string) => void;
  renderSuccess: (msg: string) => void;
} => {
  const toast = useChakraToast();

  const renderError = useCallback(
    (error: unknown, defaultError?: string) => {
      const errorMsg = getErrorMessage(error);
      // eslint-disable-next-line no-console
      console.error(error);

      if (USER_ERRORS.includes(errorMsg)) {
        return;
      }

      toast({
        description: getErrorMessage(error, defaultError),
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
