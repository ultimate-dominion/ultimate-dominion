import { describe, it, expect } from 'vitest';
import { resolveWalletAction } from './AuthContext';

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
