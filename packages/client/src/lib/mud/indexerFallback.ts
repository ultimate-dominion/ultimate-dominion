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
    // First try with regular CORS mode
    const response = await fetch(indexerUrl, {
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
      },
    }).catch(async () => {
      // If CORS fails, try with no-cors mode
      debug.log('CORS request failed, trying no-cors mode');
      const noCorsResponse = await fetch(indexerUrl, {
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // no-cors mode returns an opaque response, so we need to fall back to RPC
      if (noCorsResponse.type === 'opaque') {
        debug.log('Received opaque response from indexer, falling back to RPC');
        return fallbackFn();
      }

      return noCorsResponse;
    });

    if (!response || !response.ok || response.type === 'opaque') {
      debug.log(
        'Indexer not available or returned opaque response, falling back to RPC',
        {
          status: response?.status,
          statusText: response?.statusText,
          type: response?.type,
        },
      );
      return fallbackFn();
    }

    return response.json();
  } catch (error) {
    debug.log('Error accessing indexer, falling back to RPC', error);
    return fallbackFn();
  }
};
