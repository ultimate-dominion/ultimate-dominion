/**
 * Synchronous splice decoding for Store_SpliceStaticData events.
 *
 * Instead of making an async RPC call to fetch the full record after a splice,
 * we decode the spliced bytes directly using the table's static field layout.
 * This lets HP bar updates land in the same React commit as battle log entries.
 */
import { type Hex } from 'viem';
import { decodeStaticField } from '@latticexyz/protocol-parser/internal';

import type { TableRow } from './types';

// ---------------------------------------------------------------------------
// Static ABI type utilities (inlined to avoid transitive dep on schema-type)
// ---------------------------------------------------------------------------

/** Byte length for Solidity static types. */
function staticByteLength(abiType: string): number | null {
  if (abiType === 'bool' || abiType === 'address') return abiType === 'bool' ? 1 : 20;
  // uint8..uint256, int8..int256
  const intMatch = abiType.match(/^u?int(\d+)$/);
  if (intMatch) return Number(intMatch[1]) / 8;
  // bytes1..bytes32
  const bytesMatch = abiType.match(/^bytes(\d+)$/);
  if (bytesMatch) return Number(bytesMatch[1]);
  return null; // dynamic type
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type FieldLayout = {
  fieldName: string;
  abiType: string;
  offset: number; // byte offset within the static data blob
  byteLength: number;
};

type TableConfig = {
  tableId: string;
  key: readonly string[];
  schema: Record<string, { type: string; internalType: string }>;
};

// ---------------------------------------------------------------------------
// Layout cache (keyed by tableId)
// ---------------------------------------------------------------------------
const layoutCache = new Map<string, FieldLayout[]>();

/**
 * Build an ordered array of static value fields with their byte offsets.
 * Key fields are excluded — they aren't part of the static data blob.
 */
export function buildStaticFieldLayout(table: TableConfig): FieldLayout[] {
  const cached = layoutCache.get(table.tableId);
  if (cached) return cached;

  const keySet = new Set(table.key);
  const layout: FieldLayout[] = [];
  let offset = 0;

  for (const [fieldName, fieldDef] of Object.entries(table.schema)) {
    if (keySet.has(fieldName)) continue;

    const abiType = fieldDef.type;
    const byteLength = staticByteLength(abiType);
    if (byteLength === null) continue; // skip dynamic types

    layout.push({ fieldName, abiType, offset, byteLength });
    offset += byteLength;
  }

  layoutCache.set(table.tableId, layout);
  return layout;
}

// ---------------------------------------------------------------------------
// Value serialization (must match indexer format — bigints as strings, etc.)
// ---------------------------------------------------------------------------
function serializeValue(v: unknown): unknown {
  if (typeof v === 'bigint') return v.toString();
  if (Array.isArray(v)) return v.map(serializeValue);
  return v;
}

// ---------------------------------------------------------------------------
// Apply splice
// ---------------------------------------------------------------------------

/**
 * Decode a static-data splice and merge it into an existing store row.
 *
 * Returns the merged row, or `null` if any spliced field is only partially
 * covered (shouldn't happen with MUD codegen, but we're defensive).
 */
export function applySplice(
  layout: FieldLayout[],
  existingRow: TableRow,
  start: number,
  data: Hex,
): TableRow | null {
  // data is "0x..." — strip prefix, each char = 1 nibble = 0.5 bytes
  const dataBytes = (data.length - 2) / 2;
  if (dataBytes === 0) return { ...existingRow }; // no-op splice

  const spliceEnd = start + dataBytes;

  // Find overlapping fields
  const merged: TableRow = { ...existingRow };
  let decodedAny = false;

  for (const field of layout) {
    const fieldEnd = field.offset + field.byteLength;

    // No overlap — skip
    if (field.offset >= spliceEnd || fieldEnd <= start) continue;

    // Partial overlap — can't safely decode
    if (field.offset < start || fieldEnd > spliceEnd) return null;

    // Field is fully covered by the splice data
    const relativeOffset = field.offset - start;
    // Each byte = 2 hex chars, +2 for "0x" prefix
    const hexStart = 2 + relativeOffset * 2;
    const hexEnd = hexStart + field.byteLength * 2;
    const fieldHex = ('0x' + data.slice(hexStart, hexEnd)) as Hex;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decoded = decodeStaticField(field.abiType as any, fieldHex);
    merged[field.fieldName] = serializeValue(decoded);
    decodedAny = true;
  }

  return decodedAny ? merged : { ...existingRow };
}
