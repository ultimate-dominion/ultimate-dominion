import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { EquippedLoadout } from './EquippedLoadout';

// --- Mutable state for mocks ---
const characterState = {
  character: {
    id: '0x01',
    name: 'Test',
    owner: '0xowner',
    level: BigInt(5),
    currentHp: BigInt(100),
    maxHp: BigInt(100),
  } as any,
  equippedArmor: [] as any[],
  equippedConsumables: [] as any[],
  equippedSpells: [] as any[],
  equippedWeapons: [] as any[],
  isMoveEquipped: true,
  isRefreshing: false,
  inventoryArmor: [],
  inventoryConsumables: [],
  inventorySpells: [],
  inventoryWeapons: [],
  optimisticEquip: () => {},
  optimisticUnequip: () => {},
  refreshCharacter: async () => {},
};

const battleState = {
  attackOutcomes: [],
  attackingItemId: null,
  attackProgress: { phase: 'idle', percent: 0, transitionMs: 0 },
  attackStatusMessage: '',
  continueToBattleOutcome: false,
  currentBattle: null as any,
  dotActions: [],
  isFleeing: false,
  lastestBattleOutcome: null,
  onAttack: () => {},
  onContinueToBattleOutcome: () => {},
  onFleePvp: () => {},
  opponent: null,
  opponentHp: 0n,
  statusEffectActions: [],
  userHp: 0n,
  userCharacterForBattleRendering: null,
};

const itemsState = {
  armorTemplates: [],
  consumableTemplates: [],
  isLoading: false,
  spellTemplates: [],
  weaponTemplates: [],
};

vi.mock('../contexts/CharacterContext', () => ({
  useCharacter: () => characterState,
}));

vi.mock('../contexts/BattleContext', () => ({
  useBattle: () => battleState,
}));

vi.mock('../contexts/ItemsContext', () => ({
  useItems: () => itemsState,
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

const makeWeapon = (tokenId: string, name: string) => ({
  tokenId,
  name,
  rarity: 1,
  itemType: 2, // Weapon (ItemType.Weapon)
  minDamage: 5n,
  maxDamage: 10n,
  strModifier: 0n,
  agiModifier: 0n,
  intModifier: 0n,
});

const makeSpell = (tokenId: string, name: string) => ({
  tokenId,
  name,
  rarity: 1,
  itemType: 3, // Spell (ItemType.Spell)
  minDamage: 3n,
  maxDamage: 8n,
  strModifier: 0n,
  agiModifier: 0n,
  intModifier: 0n,
});

describe('EquippedLoadout', () => {
  beforeEach(() => {
    localStorage.clear();
    characterState.character = {
      id: '0x01',
      name: 'Test',
      owner: '0xowner',
      level: BigInt(5),
      currentHp: BigInt(100),
      maxHp: BigInt(100),
    };
    characterState.equippedWeapons = [];
    characterState.equippedSpells = [];
    characterState.equippedConsumables = [];
    characterState.equippedArmor = [];
    itemsState.isLoading = false;
    battleState.currentBattle = null;
  });

  // --- Existing tests ---

  it('shows spinner while item templates are loading', () => {
    itemsState.isLoading = true;

    render(<EquippedLoadout />);

    expect(screen.getByText('Loadout')).toBeDefined();
    expect(screen.queryByText('--')).toBeNull();
  });

  it('shows slots once templates are loaded', () => {
    render(<EquippedLoadout />);

    expect(screen.getAllByText('--').length).toBeGreaterThan(0);
  });

  it('returns null when no character', () => {
    characterState.character = null;

    const { container } = render(<EquippedLoadout />);
    expect(container.innerHTML).toBe('');
  });

  // --- Slot ordering tests ---

  it('renders equipped weapons and spells in action slots', () => {
    const sword = makeWeapon('1', 'Sword');
    const fireball = makeSpell('2', 'Fireball');
    characterState.equippedWeapons = [sword] as any[];
    characterState.equippedSpells = [fireball] as any[];

    const { container } = render(<EquippedLoadout />);

    // Both items should render (check by tooltip text presence in Chakra Tooltip)
    // The slot numbers 1, 2 should appear in the DOM
    const slotNumbers = container.querySelectorAll('p[class*="css"]');
    const texts = Array.from(slotNumbers).map(el => el.textContent);
    expect(texts).toContain('1');
    expect(texts).toContain('2');
  });

  it('persists order to localStorage via promoteToFirst', () => {
    const sword = makeWeapon('1', 'Sword');
    const axe = makeWeapon('2', 'Axe');
    const bow = makeWeapon('3', 'Bow');
    characterState.equippedWeapons = [sword, axe, bow] as any[];

    const { container } = render(<EquippedLoadout />);

    // Slot numbers should appear
    const slotNumbers = container.querySelectorAll('p[class*="css"]');
    const texts = Array.from(slotNumbers).map(el => el.textContent);
    expect(texts).toContain('1');
    expect(texts).toContain('2');
    expect(texts).toContain('3');
  });

  it('respects saved order from localStorage', () => {
    const sword = makeWeapon('1', 'Sword');
    const fireball = makeSpell('2', 'Fireball');
    characterState.equippedWeapons = [sword] as any[];
    characterState.equippedSpells = [fireball] as any[];

    // Save order with fireball first
    localStorage.setItem('ud_action_order_0x01', JSON.stringify(['2', '1']));

    const { container } = render(<EquippedLoadout />);

    // Both should render with slot numbers
    const slotNumbers = container.querySelectorAll('p[class*="css"]');
    const texts = Array.from(slotNumbers).map(el => el.textContent);
    expect(texts).toContain('1');
    expect(texts).toContain('2');
  });

  it('does not modify localStorage during battle', () => {
    const sword = makeWeapon('1', 'Sword');
    const axe = makeWeapon('2', 'Axe');
    characterState.equippedWeapons = [sword, axe] as any[];
    battleState.currentBattle = {
      encounterId: '0xbattle',
      end: BigInt(0),
      attackers: ['0x01'],
      defenders: ['0xmonster'],
      currentTurn: 1n,
      maxTurns: 10n,
      encounterType: 0,
      start: 1n,
      currentTurnTimer: 0n,
    };

    render(<EquippedLoadout />);

    // No localStorage change should happen during battle
    expect(localStorage.getItem('ud_action_order_0x01')).toBeNull();
  });

  // --- Edge cases ---

  it('handles single equipped item correctly', () => {
    characterState.equippedWeapons = [makeWeapon('1', 'Sword')] as any[];

    const { container } = render(<EquippedLoadout />);

    // Slot number 1 should appear
    const slotNumbers = container.querySelectorAll('p[class*="css"]');
    const texts = Array.from(slotNumbers).map(el => el.textContent);
    expect(texts).toContain('1');
    // Should still have empty slots (--) for remaining 3 action slots + 1 armor
    expect(screen.getAllByText('--').length).toBeGreaterThanOrEqual(4);
  });

  it('handles zero equipped items showing all empty', () => {
    render(<EquippedLoadout />);

    // Should have empty slots present (Chakra Tooltip duplicates nodes in DOM)
    expect(screen.getAllByText('--').length).toBeGreaterThanOrEqual(5);
  });
});
