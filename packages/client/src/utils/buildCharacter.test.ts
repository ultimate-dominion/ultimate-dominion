import { describe, expect, it, vi } from 'vitest';
import { buildCharacter } from './buildCharacter';
import { ArmorType, PowerSource, Race } from './types';

vi.mock('../lib/gameStore', async () => {
  const actual = await vi.importActual<object>('../lib/gameStore');
  return {
    ...actual,
    getTableValue: vi.fn(() => undefined),
  };
});

vi.mock('./helpers', async () => {
  const actual = await vi.importActual<object>('./helpers');
  return {
    ...actual,
    decodeBaseStats: vi.fn(() => ({
      agility: 4n,
      currentHp: 30n,
      entityClass: 1,
      experience: 12n,
      intelligence: 3n,
      level: 2n,
      maxHp: 40n,
      strength: 5n,
      powerSource: PowerSource.Weave,
      race: Race.Elf,
      startingArmor: ArmorType.Leather,
      advancedClass: 0,
      hasSelectedAdvancedClass: false,
    })),
    decodeAppliedStatusEffectId: vi.fn(),
  };
});

describe('buildCharacter', () => {
  it('preserves on-chain identity fields on the reactive character object', () => {
    const character = buildCharacter(
      '0xabc',
      {
        owner: '0xowner',
        tokenId: 7n,
        locked: false,
        name: '0x4672696c6c69616e000000000000000000000000000000000000000000000000',
        baseStats: '0x1234',
      },
      {
        agility: 4n,
        currentHp: 30n,
        experience: 12n,
        intelligence: 3n,
        level: 2n,
        maxHp: 40n,
        strength: 5n,
        advancedClass: 0,
        hasSelectedAdvancedClass: false,
      },
      undefined,
      undefined,
      { zoneId: 0, x: 1, y: 2 },
      { spawned: true },
      { name: '', description: '', image: '' },
      undefined,
    );

    expect(character.race).toBe(Race.Elf);
    expect(character.powerSource).toBe(PowerSource.Weave);
    expect(character.startingArmor).toBe(ArmorType.Leather);
    expect(character.baseStats.race).toBe(Race.Elf);
  });
});
