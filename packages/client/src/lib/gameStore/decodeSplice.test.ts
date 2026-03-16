import { describe, it, expect } from 'vitest';
import { type Hex } from 'viem';
import { buildStaticFieldLayout, applySplice, type FieldLayout } from './decodeSplice';

// ---------------------------------------------------------------------------
// Stats table config (matches mudConfig.tables.UD__Stats resolved shape)
// ---------------------------------------------------------------------------
const statsTable = {
  tableId: '0x7462554400000000000000000000000053746174730000000000000000000000',
  key: ['entityId'] as const,
  schema: {
    entityId: { type: 'bytes32', internalType: 'bytes32' },
    strength: { type: 'int256', internalType: 'int256' },
    agility: { type: 'int256', internalType: 'int256' },
    class: { type: 'uint8', internalType: 'Classes' },
    intelligence: { type: 'int256', internalType: 'int256' },
    maxHp: { type: 'int256', internalType: 'int256' },
    currentHp: { type: 'int256', internalType: 'int256' },
    experience: { type: 'uint256', internalType: 'uint256' },
    level: { type: 'uint256', internalType: 'uint256' },
    powerSource: { type: 'uint8', internalType: 'PowerSource' },
    race: { type: 'uint8', internalType: 'Race' },
    startingArmor: { type: 'uint8', internalType: 'ArmorType' },
    advancedClass: { type: 'uint8', internalType: 'AdvancedClass' },
    hasSelectedAdvancedClass: { type: 'bool', internalType: 'bool' },
  },
};

// Table with only dynamic fields (and a key)
const dynamicOnlyTable = {
  tableId: '0xdynamic0000000000000000000000000000000000000000000000000000000',
  key: ['id'] as const,
  schema: {
    id: { type: 'bytes32', internalType: 'bytes32' },
    names: { type: 'string', internalType: 'string' },
    data: { type: 'bytes', internalType: 'bytes' },
  },
};

// ---------------------------------------------------------------------------
// buildStaticFieldLayout
// ---------------------------------------------------------------------------
describe('buildStaticFieldLayout', () => {
  it('produces correct offsets for the Stats table', () => {
    const layout = buildStaticFieldLayout(statsTable);

    // entityId is a key — should be excluded
    expect(layout.find(f => f.fieldName === 'entityId')).toBeUndefined();

    // Expected order and offsets (int256 = 32 bytes, uint8 = 1, uint256 = 32, bool = 1):
    // strength:  offset 0,   32 bytes
    // agility:   offset 32,  32 bytes
    // class:     offset 64,  1 byte
    // intelligence: offset 65, 32 bytes
    // maxHp:     offset 97,  32 bytes
    // currentHp: offset 129, 32 bytes
    // experience: offset 161, 32 bytes
    // level:     offset 193, 32 bytes
    // powerSource: offset 225, 1 byte
    // race:      offset 226, 1 byte
    // startingArmor: offset 227, 1 byte
    // advancedClass: offset 228, 1 byte
    // hasSelectedAdvancedClass: offset 229, 1 byte

    const expected = [
      { fieldName: 'strength', abiType: 'int256', offset: 0, byteLength: 32 },
      { fieldName: 'agility', abiType: 'int256', offset: 32, byteLength: 32 },
      { fieldName: 'class', abiType: 'uint8', offset: 64, byteLength: 1 },
      { fieldName: 'intelligence', abiType: 'int256', offset: 65, byteLength: 32 },
      { fieldName: 'maxHp', abiType: 'int256', offset: 97, byteLength: 32 },
      { fieldName: 'currentHp', abiType: 'int256', offset: 129, byteLength: 32 },
      { fieldName: 'experience', abiType: 'uint256', offset: 161, byteLength: 32 },
      { fieldName: 'level', abiType: 'uint256', offset: 193, byteLength: 32 },
      { fieldName: 'powerSource', abiType: 'uint8', offset: 225, byteLength: 1 },
      { fieldName: 'race', abiType: 'uint8', offset: 226, byteLength: 1 },
      { fieldName: 'startingArmor', abiType: 'uint8', offset: 227, byteLength: 1 },
      { fieldName: 'advancedClass', abiType: 'uint8', offset: 228, byteLength: 1 },
      { fieldName: 'hasSelectedAdvancedClass', abiType: 'bool', offset: 229, byteLength: 1 },
    ];

    expect(layout).toEqual(expected);
  });

  it('returns empty layout for table with only dynamic fields', () => {
    const layout = buildStaticFieldLayout(dynamicOnlyTable);
    expect(layout).toEqual([]);
  });

  it('caches results by tableId', () => {
    const layout1 = buildStaticFieldLayout(statsTable);
    const layout2 = buildStaticFieldLayout(statsTable);
    expect(layout1).toBe(layout2); // same reference
  });
});

// ---------------------------------------------------------------------------
// applySplice
// ---------------------------------------------------------------------------

// Helper: pad a hex number to N bytes (2*N hex chars after 0x)
function padHex(value: bigint, bytes: number): string {
  const isNeg = value < 0n;
  // For negative values in two's complement
  if (isNeg) {
    const max = 1n << (BigInt(bytes) * 8n);
    value = max + value;
  }
  return value.toString(16).padStart(bytes * 2, '0');
}

describe('applySplice', () => {
  const layout = buildStaticFieldLayout(statsTable);

  const existingRow = {
    strength: '10',
    agility: '8',
    class: 1,
    intelligence: '12',
    maxHp: '100',
    currentHp: '100',
    experience: '500',
    level: '5',
    powerSource: 2,
    race: 1,
    startingArmor: 3,
    advancedClass: 0,
    hasSelectedAdvancedClass: false,
  };

  it('decodes a single int256 field (currentHp at offset 129)', () => {
    // currentHp is at offset 129, 32 bytes
    const newHp = 75n;
    const data = ('0x' + padHex(newHp, 32)) as Hex;

    const merged = applySplice(layout, existingRow, 129, data);
    expect(merged).not.toBeNull();
    expect(merged!.currentHp).toBe('75');
    // Other fields unchanged
    expect(merged!.strength).toBe('10');
    expect(merged!.maxHp).toBe('100');
  });

  it('decodes a single uint8 field (class at offset 64)', () => {
    const data = '0x02' as Hex; // class = 2 (Mage)
    const merged = applySplice(layout, existingRow, 64, data);
    expect(merged).not.toBeNull();
    expect(merged!.class).toBe(2);
  });

  it('decodes a bool field (hasSelectedAdvancedClass at offset 229)', () => {
    const data = '0x01' as Hex; // true
    const merged = applySplice(layout, existingRow, 229, data);
    expect(merged).not.toBeNull();
    expect(merged!.hasSelectedAdvancedClass).toBe(true);
  });

  it('decodes multi-field splice covering adjacent small fields', () => {
    // powerSource (offset 225, 1 byte) + race (offset 226, 1 byte)
    const data = '0x0302' as Hex; // powerSource=3 (Physical), race=2 (Elf)
    const merged = applySplice(layout, existingRow, 225, data);
    expect(merged).not.toBeNull();
    expect(merged!.powerSource).toBe(3);
    expect(merged!.race).toBe(2);
  });

  it('returns null for partial field coverage', () => {
    // Start in the middle of the currentHp field (offset 129, 32 bytes)
    // If we start at 130 with 31 bytes, the field is partially covered
    const data = ('0x' + '00'.repeat(31)) as Hex;
    const merged = applySplice(layout, existingRow, 130, data);
    expect(merged).toBeNull();
  });

  it('decodes signed int256 negative value correctly', () => {
    // currentHp at offset 129, set to -5 (two's complement)
    const negFive = -5n;
    const data = ('0x' + padHex(negFive, 32)) as Hex;

    const merged = applySplice(layout, existingRow, 129, data);
    expect(merged).not.toBeNull();
    expect(merged!.currentHp).toBe('-5');
  });

  it('serialization matches indexer format (bigints as strings, bools as booleans)', () => {
    // Splice a uint256 experience field at offset 161
    const newExp = 999n;
    const data = ('0x' + padHex(newExp, 32)) as Hex;
    const merged = applySplice(layout, existingRow, 161, data);
    expect(merged).not.toBeNull();
    // uint256 should be serialized as string (matching indexer format)
    expect(merged!.experience).toBe('999');
    expect(typeof merged!.experience).toBe('string');
  });

  it('handles no-op splice (zero-length data)', () => {
    const merged = applySplice(layout, existingRow, 0, '0x' as Hex);
    expect(merged).not.toBeNull();
    expect(merged).toEqual(existingRow);
  });

  it('handles splice that falls between fields (no overlap)', () => {
    // Splice data that doesn't overlap any field — shouldn't happen in practice
    // but should return a copy of the existing row
    // The total static length is 230 bytes, so starting at 230 would be out of range
    const data = '0x00' as Hex;
    const merged = applySplice(layout, existingRow, 230, data);
    expect(merged).not.toBeNull();
    expect(merged).toEqual(existingRow);
  });
});
