import { describe, it, expect } from 'vitest';
import { encodeCompositeKey } from './keys';

describe('encodeCompositeKey', () => {
  it('pads each part to 32 bytes and concatenates', () => {
    const key = encodeCompositeKey('0xabc', '0x01');
    expect(key).toBe(
      '0x' +
        '0'.repeat(61) + 'abc' +
        '0'.repeat(62) + '01',
    );
    expect(key.length).toBe(2 + 64 * 2);
  });

  // Regression for the Windy Peaks quest HUD bug: FragmentType is a uint8
  // stored as hex in the composite key. Passing the decimal string "10"
  // (type.toString()) encodes as 0x10 = 16, not 0x0a = 10, so lookups for
  // fragment type 10 silently hit fragment type 16's row instead.
  //
  // Callers MUST pass already-hex-encoded values.
  it('treats each part as pre-encoded hex, not a decimal value', () => {
    // Wrong: decimal "10" — encodes as 0x0000...0010 (value 16)
    const wrongKey = encodeCompositeKey('0x00', '10');
    expect(wrongKey.endsWith('0010')).toBe(true);
    expect(BigInt('0x' + wrongKey.slice(-64))).toBe(16n);

    // Right: hex "a" for uint8 value 10 — encodes as 0x0000...000a
    const rightKey = encodeCompositeKey('0x00', (10).toString(16));
    expect(rightKey.endsWith('000a')).toBe(true);
    expect(BigInt('0x' + rightKey.slice(-64))).toBe(10n);

    expect(wrongKey).not.toBe(rightKey);
  });

  it('accepts parts with or without 0x prefix equivalently', () => {
    expect(encodeCompositeKey('0xabc', '0xdef')).toBe(
      encodeCompositeKey('abc', 'def'),
    );
  });
});
