import { describe, it, expect } from 'vitest';
import { resolveEmbeddedIdentityToken, resolveWalletAction } from './AuthContext';

describe('resolveWalletAction', () => {
  it('returns "create" for a confirmed new user with no server-side wallet', () => {
    expect(resolveWalletAction(undefined, false, true)).toBe('create');
    expect(resolveWalletAction(null, false, true)).toBe('create');
  });

  it('returns "skip" for an unconfirmed user with no server-side wallet', () => {
    // Before OAuth callback confirms new user, don't create wallet (avoids hydration race)
    expect(resolveWalletAction(undefined, false, false)).toBe('skip');
    expect(resolveWalletAction(null, false, false)).toBe('skip');
  });

  it('returns "wait" when user already has a wallet on server (cross-device recovery)', () => {
    const serverWallet = { address: '0xExistingWallet' };
    expect(resolveWalletAction(serverWallet, false, false)).toBe('wait');
  });

  it('returns "wait" even if createWallet is already in flight', () => {
    // Server wallet takes priority — don't create regardless of in-flight state
    const serverWallet = { address: '0xExistingWallet' };
    expect(resolveWalletAction(serverWallet, true, false)).toBe('wait');
  });

  it('returns "skip" when createWallet is already in flight for a new user', () => {
    expect(resolveWalletAction(undefined, true, true)).toBe('skip');
    expect(resolveWalletAction(null, true, true)).toBe('skip');
  });
});

describe('resolveEmbeddedIdentityToken', () => {
  it('returns the cached token without refreshing when present', async () => {
    const refreshUser = async () => {
      throw new Error('should not refresh');
    };

    await expect(
      resolveEmbeddedIdentityToken(() => 'cached-token', refreshUser),
    ).resolves.toBe('cached-token');
  });

  it('refreshes and returns the updated token when the cached token is missing', async () => {
    let token: string | null = null;
    const refreshUser = async () => {
      token = 'refreshed-token';
    };

    await expect(
      resolveEmbeddedIdentityToken(() => token, refreshUser),
    ).resolves.toBe('refreshed-token');
  });

  it('waits for a delayed token update after refresh', async () => {
    let token: string | null = null;
    const refreshUser = async () => {};
    const waitForToken = async () => {
      token = 'delayed-token';
      return token;
    };

    await expect(
      resolveEmbeddedIdentityToken(() => token, refreshUser, waitForToken),
    ).resolves.toBe('delayed-token');
  });

  it('returns null when refresh fails', async () => {
    const refreshUser = async () => {
      throw new Error('refresh failed');
    };

    await expect(
      resolveEmbeddedIdentityToken(() => null, refreshUser),
    ).resolves.toBeNull();
  });
});
