import { describe, it, expect } from 'vitest';
import { resolveWalletAction } from './AuthContext';

describe('resolveWalletAction', () => {
  it('returns "create" for a new user with no server-side wallet', () => {
    expect(resolveWalletAction(undefined, false)).toBe('create');
    expect(resolveWalletAction(null, false)).toBe('create');
  });

  it('returns "wait" when user already has a wallet on server (cross-device recovery)', () => {
    const serverWallet = { address: '0xExistingWallet' };
    expect(resolveWalletAction(serverWallet, false)).toBe('wait');
  });

  it('returns "wait" even if createWallet is already in flight', () => {
    // Server wallet takes priority — don't create regardless of in-flight state
    const serverWallet = { address: '0xExistingWallet' };
    expect(resolveWalletAction(serverWallet, true)).toBe('wait');
  });

  it('returns "skip" when createWallet is already in flight for a new user', () => {
    expect(resolveWalletAction(undefined, true)).toBe('skip');
    expect(resolveWalletAction(null, true)).toBe('skip');
  });
});
