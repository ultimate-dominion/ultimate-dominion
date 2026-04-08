import { describe, expect, it } from 'vitest';

import { buildEmbeddedNetwork } from './buildEmbeddedNetwork';

describe('buildEmbeddedNetwork', () => {
  it('overrides the default burner wallet client for embedded sessions', () => {
    const burnerWalletClient = { account: { address: '0x1111111111111111111111111111111111111111' } } as any;
    const embeddedWalletClient = { account: { address: '0x2222222222222222222222222222222222222222' } } as any;
    const burnerWorldContract = { address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' } as any;
    const embeddedWorldContract = { address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' } as any;
    const burnerWrite$ = { pipe: () => 'burner-write-stream' } as any;
    const embeddedWrite$ = { pipe: () => 'embedded-write-stream' } as any;

    const result = buildEmbeddedNetwork(
      {
        publicClient: {} as any,
        waitForTransaction: async () => ({}) as any,
        walletClient: burnerWalletClient,
        worldContract: burnerWorldContract,
        write$: burnerWrite$,
      },
      embeddedWalletClient,
      embeddedWorldContract,
      embeddedWrite$,
    );

    expect(result.walletClient).toBe(embeddedWalletClient);
    expect(result.worldContract).toBe(embeddedWorldContract);
    expect(result.write$).toBe(embeddedWrite$);
  });
});
