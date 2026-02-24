// Debug utility for development environments
const isDev =
  import.meta.env.MODE === 'development' || import.meta.env.MODE === 'staging';

export const debug = {
  log: (message: string, data?: unknown): void => {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.log(`[DEBUG] ${message}`, data || '');
    }
  },
  error: (message: string, error?: unknown): void => {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.error(`[ERROR] ${message}`, error || '');
    }
  },
};
