import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
  },
  equippedArmor: [],
  equippedConsumables: [],
  equippedSpells: [],
  equippedWeapons: [],
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

vi.mock('../contexts/ItemsContext', () => ({
  useItems: () => itemsState,
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

describe('EquippedLoadout', () => {
  it('shows spinner while item templates are loading', () => {
    itemsState.isLoading = true;
    characterState.equippedWeapons = [];
    characterState.equippedArmor = [];

    render(<EquippedLoadout />);

    // Should show "Loadout" text but with a spinner, not empty slots
    expect(screen.getByText('Loadout')).toBeDefined();
    // Should NOT show empty slot indicators
    expect(screen.queryByText('--')).toBeNull();
  });

  it('shows slots once templates are loaded', () => {
    itemsState.isLoading = false;
    characterState.equippedWeapons = [];
    characterState.equippedArmor = [];

    render(<EquippedLoadout />);

    // Should show empty slots when truly no equipment
    expect(screen.getAllByText('--').length).toBeGreaterThan(0);
  });

  it('returns null when no character', () => {
    const origCharacter = characterState.character;
    (characterState as any).character = null;
    itemsState.isLoading = false;

    const { container } = render(<EquippedLoadout />);
    expect(container.innerHTML).toBe('');

    characterState.character = origCharacter;
  });
});
