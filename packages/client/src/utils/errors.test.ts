import { describe, it, expect } from 'vitest';
import { isStaleChunkError } from './errors';

describe('isStaleChunkError', () => {
  it('detects viem CCIP dynamic import failure', () => {
    const error = new Error(
      'Failed to fetch dynamically imported module: https://ultimatedominion.com/assets/ccip-8b0c9333.js',
    );
    expect(isStaleChunkError(error)).toBe(true);
  });

  it('detects generic chunk load error', () => {
    expect(isStaleChunkError(new Error('Loading chunk 42 failed'))).toBe(true);
    expect(isStaleChunkError(new Error('ChunkLoadError: ...'))).toBe(true);
  });

  it('does not match normal errors', () => {
    expect(isStaleChunkError(new Error('insufficient funds'))).toBe(false);
    expect(isStaleChunkError(new Error('execution reverted'))).toBe(false);
    expect(isStaleChunkError(null)).toBe(false);
  });
});
