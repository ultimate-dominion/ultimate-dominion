import { debug } from '../../utils/debug';

interface IndexerResponse {
  data?: unknown;
  error?: string;
}

export const handleIndexerError = async (
  indexerUrl: string,
  fallbackFn: () => Promise<IndexerResponse | null>,
): Promise<IndexerResponse | null> => {
  try {
    const response = await fetch(indexerUrl, {
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      debug.log('Indexer not available, falling back to RPC', {
        status: response.status,
        statusText: response.statusText,
      });
      return fallbackFn();
    }

    return response.json();
  } catch (error) {
    debug.log('Error accessing indexer, falling back to RPC', error);
    return fallbackFn();
  }
};
