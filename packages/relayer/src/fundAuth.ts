import { importJWK, jwtVerify, type JWK, type JWTPayload } from 'jose';
import { type Address, type Hex, padHex, parseAbi } from 'viem';
import { config } from './config.js';
import { publicClient } from './tx.js';

const DELEGATION_TABLE_ID =
  '0x7462776f726c640000000000000000005573657244656c65676174696f6e436f' as Hex;
const USER_DELEGATION_FIELD_LAYOUT =
  '0x0020000000000000000000000000000000000000000000000000000000000000' as Hex;

// Old unlimited delegation (backwards compatibility) and current game delegation.
const UNLIMITED_DELEGATION =
  '0x73790000000000000000000000000000756e6c696d6974656400000000000000' as Hex;
const GAME_DELEGATION =
  ('0x73795544000000000000000000000000' + '47616d6544656c65676174696f6e0000') as Hex;

const getStaticFieldAbi = parseAbi([
  'function getStaticField(bytes32 tableId, bytes32[] keyTuple, uint8 fieldIndex, bytes32 fieldLayout) view returns (bytes32 data)',
]);

type EmbeddedLinkedAccount = {
  type?: string;
  address?: string;
  chain_type?: string;
  wallet_client_type?: string;
  connector_type?: string;
};

type PrivyIdentityPayload = JWTPayload & {
  linked_accounts?: string;
};

type AuthFailure = {
  error: string;
  ok: false;
  status: number;
};

type AuthSuccess = {
  authMethod: 'delegated' | 'embedded';
  ok: true;
  worldAddress?: Address;
};

export type FundingAuthResult = AuthFailure | AuthSuccess;

let privyKeyPromise: ReturnType<typeof importJWK> | null = null;

function normalizeAddress(address: string): Address {
  return address.toLowerCase() as Address;
}

function normalizeHex(hex: string): string {
  return hex.toLowerCase();
}

function resolveRequestedWorldAddress(requestedWorldAddress?: string): FundingAuthResult | { ok: true; worldAddress?: Address } {
  const configuredWorldAddress = config.worldAddress
    ? normalizeAddress(config.worldAddress)
    : undefined;
  const requested = requestedWorldAddress
    ? normalizeAddress(requestedWorldAddress)
    : undefined;

  if (configuredWorldAddress && requested && requested !== configuredWorldAddress) {
    return { ok: false, status: 403, error: 'World mismatch' };
  }

  const worldAddress = configuredWorldAddress ?? requested;
  if (config.allowedWorldAddresses.length > 0) {
    if (!worldAddress || !config.allowedWorldAddresses.includes(worldAddress)) {
      return { ok: false, status: 403, error: 'World not allowed' };
    }
  }

  return { ok: true, worldAddress };
}

function parsePrivyLinkedAccounts(payload: PrivyIdentityPayload): EmbeddedLinkedAccount[] {
  if (!payload.linked_accounts) return [];

  try {
    const parsed = JSON.parse(payload.linked_accounts) as unknown;
    return Array.isArray(parsed) ? parsed as EmbeddedLinkedAccount[] : [];
  } catch {
    return [];
  }
}

function hasEmbeddedWalletClaim(payload: PrivyIdentityPayload, expectedAddress: Address): boolean {
  const normalizedExpected = normalizeAddress(expectedAddress);
  const linkedAccounts = parsePrivyLinkedAccounts(payload);

  return linkedAccounts.some((account) =>
    account.type === 'wallet' &&
    account.chain_type === 'ethereum' &&
    normalizeAddress(account.address || '0x0000000000000000000000000000000000000000') === normalizedExpected &&
    account.wallet_client_type === 'privy' &&
    account.connector_type === 'embedded');
}

async function getPrivyVerificationKey(): Promise<Awaited<ReturnType<typeof importJWK>>> {
  if (!config.privyAppId || !config.privyVerificationKey) {
    throw new Error('Privy identity token verification is not configured');
  }

  if (!privyKeyPromise) {
    let jwk: JWK;
    try {
      jwk = JSON.parse(config.privyVerificationKey) as JWK;
    } catch {
      throw new Error('PRIVY_VERIFICATION_KEY must be valid JWK JSON');
    }

    privyKeyPromise = importJWK(jwk, 'ES256');
  }

  return privyKeyPromise;
}

async function verifyPrivyIdentityToken(identityToken: string, expectedAddress: Address): Promise<boolean> {
  const verificationKey = await getPrivyVerificationKey();
  const { payload } = await jwtVerify(identityToken, verificationKey, {
    issuer: 'privy.io',
    audience: config.privyAppId,
  });

  return hasEmbeddedWalletClaim(payload as PrivyIdentityPayload, expectedAddress);
}

async function hasValidDelegation(
  worldAddress: Address,
  delegatorAddress: Address,
  burnerAddress: Address,
): Promise<boolean> {
  const delegationControlId = await publicClient.readContract({
    address: worldAddress,
    abi: getStaticFieldAbi,
    functionName: 'getStaticField',
    args: [
      DELEGATION_TABLE_ID,
      [padHex(delegatorAddress, { size: 32 }), padHex(burnerAddress, { size: 32 })],
      0,
      USER_DELEGATION_FIELD_LAYOUT,
    ],
  });

  const normalizedDelegationId = normalizeHex(delegationControlId);
  return normalizedDelegationId === normalizeHex(GAME_DELEGATION) ||
    normalizedDelegationId === normalizeHex(UNLIMITED_DELEGATION);
}

export async function authorizeFundingRequest(params: {
  address: Address;
  delegatorAddress: Address;
  identityToken?: string | null;
  worldAddress?: string;
}): Promise<FundingAuthResult> {
  const { address, delegatorAddress, identityToken, worldAddress: requestedWorldAddress } = params;
  const resolvedWorld = resolveRequestedWorldAddress(requestedWorldAddress);
  if (!resolvedWorld.ok) return resolvedWorld;

  if (normalizeAddress(address) === normalizeAddress(delegatorAddress)) {
    if (!identityToken) {
      return { ok: false, status: 401, error: 'Missing identity token' };
    }

    try {
      const verified = await verifyPrivyIdentityToken(identityToken, address);
      if (!verified) {
        return { ok: false, status: 403, error: 'Identity token does not match embedded wallet' };
      }

      return { ok: true, authMethod: 'embedded', worldAddress: resolvedWorld.worldAddress };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Identity token verification failed';
      const status = message.includes('not configured') ? 503 : 401;
      return { ok: false, status, error: message };
    }
  }

  if (!resolvedWorld.worldAddress) {
    return { ok: false, status: 503, error: 'Delegated funding requires a configured world address' };
  }

  try {
    const delegated = await hasValidDelegation(
      resolvedWorld.worldAddress,
      delegatorAddress,
      address,
    );

    if (!delegated) {
      return { ok: false, status: 403, error: 'Delegation not found' };
    }

    return { ok: true, authMethod: 'delegated', worldAddress: resolvedWorld.worldAddress };
  } catch {
    return { ok: false, status: 503, error: 'Failed to verify delegation' };
  }
}

export function _resetPrivyKeyCacheForTesting(): void {
  privyKeyPromise = null;
}
