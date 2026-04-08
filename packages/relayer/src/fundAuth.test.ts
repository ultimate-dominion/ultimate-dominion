import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { type Address } from 'viem';

const TEST_WORLD = '0x1111111111111111111111111111111111111111' as Address;
const TEST_EMBEDDED = '0x2222222222222222222222222222222222222222' as Address;
const TEST_DELEGATOR = '0x3333333333333333333333333333333333333333' as Address;
const TEST_BURNER = '0x4444444444444444444444444444444444444444' as Address;
const GAME_DELEGATION =
  '0x7379554400000000000000000000000047616d6544656c65676174696f6e0000';

const mockReadContract = vi.fn();

vi.mock('./config.js', () => ({
  config: {
    allowedWorldAddresses: [TEST_WORLD.toLowerCase()],
    privyAppId: 'privy-app-id',
    privyVerificationKey: '',
    worldAddress: TEST_WORLD,
  },
}));

vi.mock('./tx.js', () => ({
  publicClient: {
    readContract: (...args: unknown[]) => mockReadContract(...args),
  },
}));

const { authorizeFundingRequest, _resetPrivyKeyCacheForTesting } = await import('./fundAuth.js');
const { config } = await import('./config.js');
const mockedConfig = config as {
  allowedWorldAddresses: string[];
  privyAppId: string;
  privyVerificationKey: string;
  worldAddress: Address;
};

async function createIdentityToken(
  walletAddress: Address,
  linkedAccountsOverride?: unknown,
): Promise<string> {
  const { privateKey, publicKey } = await generateKeyPair('ES256');
  mockedConfig.privyVerificationKey = JSON.stringify(await exportJWK(publicKey));
  _resetPrivyKeyCacheForTesting();

  return new SignJWT({
    linked_accounts: JSON.stringify(linkedAccountsOverride ?? [
      {
        address: walletAddress,
        chain_type: 'ethereum',
        connector_type: 'embedded',
        type: 'wallet',
        wallet_client_type: 'privy',
      },
    ]),
  })
    .setProtectedHeader({ alg: 'ES256' })
    .setAudience(mockedConfig.privyAppId)
    .setIssuer('privy.io')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);
}

describe('authorizeFundingRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedConfig.allowedWorldAddresses = [TEST_WORLD.toLowerCase()];
    mockedConfig.privyAppId = 'privy-app-id';
    mockedConfig.privyVerificationKey = '';
    mockedConfig.worldAddress = TEST_WORLD;
    _resetPrivyKeyCacheForTesting();
  });

  it('accepts embedded wallet funding with a valid Privy identity token', async () => {
    const identityToken = await createIdentityToken(TEST_EMBEDDED);

    const result = await authorizeFundingRequest({
      address: TEST_EMBEDDED,
      delegatorAddress: TEST_EMBEDDED,
      identityToken,
      worldAddress: TEST_WORLD,
    });

    expect(result).toEqual({
      ok: true,
      authMethod: 'embedded',
      worldAddress: TEST_WORLD,
    });
  });

  it('accepts embedded wallet funding when Privy omits connector metadata', async () => {
    const identityToken = await createIdentityToken(TEST_EMBEDDED, [
      {
        address: TEST_EMBEDDED,
        chain_type: 'ethereum',
        type: 'wallet',
      },
    ]);

    const result = await authorizeFundingRequest({
      address: TEST_EMBEDDED,
      delegatorAddress: TEST_EMBEDDED,
      identityToken,
      worldAddress: TEST_WORLD,
    });

    expect(result).toEqual({
      ok: true,
      authMethod: 'embedded',
      worldAddress: TEST_WORLD,
    });
  });

  it('rejects embedded wallet funding when the identity token does not match the wallet', async () => {
    const identityToken = await createIdentityToken(TEST_EMBEDDED);

    const result = await authorizeFundingRequest({
      address: TEST_BURNER,
      delegatorAddress: TEST_BURNER,
      identityToken,
      worldAddress: TEST_WORLD,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toContain('embedded wallet');
    }
  });

  it('accepts delegated burner funding only when on-chain delegation exists', async () => {
    mockReadContract.mockResolvedValue(GAME_DELEGATION);

    const result = await authorizeFundingRequest({
      address: TEST_BURNER,
      delegatorAddress: TEST_DELEGATOR,
      worldAddress: TEST_WORLD,
    });

    expect(result).toEqual({
      ok: true,
      authMethod: 'delegated',
      worldAddress: TEST_WORLD,
    });
    expect(mockReadContract).toHaveBeenCalledTimes(1);
  });

  it('rejects delegated burner funding when the request world is not allowed', async () => {
    const result = await authorizeFundingRequest({
      address: TEST_BURNER,
      delegatorAddress: TEST_DELEGATOR,
      worldAddress: '0x9999999999999999999999999999999999999999',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toBe('World mismatch');
    }
    expect(mockReadContract).not.toHaveBeenCalled();
  });
});
