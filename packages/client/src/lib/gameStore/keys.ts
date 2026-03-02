/**
 * Entity key encoding utilities for the Zustand game store.
 * Replaces @latticexyz/store-sync/recs encodeEntity/decodeEntity.
 *
 * MUD stores table keys as ABI-encoded byte tuples. Each key field
 * is left-padded to 32 bytes and concatenated.
 */

/** Encode a uint256 value as a 32-byte hex key */
export function encodeUint256Key(value: bigint | number | string): string {
  const n = typeof value === 'bigint' ? value : BigInt(value);
  return '0x' + n.toString(16).padStart(64, '0');
}

/** Encode an address as a 32-byte hex key (left-padded) */
export function encodeAddressKey(address: string): string {
  const clean = address.startsWith('0x') ? address.slice(2) : address;
  return '0x' + clean.toLowerCase().padStart(64, '0');
}

/** Encode a bytes32 value as a hex key */
export function encodeBytes32Key(value: string): string {
  const clean = value.startsWith('0x') ? value.slice(2) : value;
  return '0x' + clean.padEnd(64, '0');
}

/**
 * Combine multiple 32-byte key parts into a single keyBytes string.
 * For tables with composite keys (e.g., ItemsOwners: [owner, tokenId]).
 */
export function encodeCompositeKey(...parts: string[]): string {
  return '0x' + parts.map(p => {
    const clean = p.startsWith('0x') ? p.slice(2) : p;
    // Each part should already be 64 hex chars (32 bytes)
    return clean.padStart(64, '0');
  }).join('');
}

/** Decode a uint256 from the first 32 bytes of a keyBytes string */
export function decodeUint256FromKey(keyBytes: string, offset = 0): bigint {
  const clean = keyBytes.startsWith('0x') ? keyBytes.slice(2) : keyBytes;
  const start = offset * 64;
  return BigInt('0x' + (clean.slice(start, start + 64) || '0'));
}

/**
 * Safely convert unknown values (from JSON-serialized store) to bigint.
 * The indexer serializes BigInts as strings.
 */
export function toBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'string') {
    if (value === '') return BigInt(0);
    return BigInt(value);
  }
  if (typeof value === 'number') return BigInt(value);
  return BigInt(0);
}

/** Safely convert unknown values to number */
export function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value) || 0;
  if (typeof value === 'bigint') return Number(value);
  return 0;
}
