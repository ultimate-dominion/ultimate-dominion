export const USER_ERRORS = ['User denied signature'];
export const INSUFFICIENT_FUNDS_MESSAGE =
  'Insufficient funds. Please top off your session account.';

export const getError = (
  error: unknown,
  defaultError: string = 'Unknown error',
): string => {
  if (typeof error === 'string') {
    return error;
  }

  if ((error as Error)?.message?.toLowerCase().includes('user denied')) {
    return USER_ERRORS[0];
  }

  return (error as Error)?.message || defaultError;
};
