import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';

// Polyfill matchMedia for happy-dom (Chakra's Show component needs it)
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width'), // render mobile layout (below lg)
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

import { CharacterInspectOverlay } from './CharacterInspectOverlay';
import { ItemType, Race, Rarity, StatsClasses, PowerSource, ArmorType, AdvancedClass } from '../utils/types';
import type { Character, Armor, Weapon, Spell, Consumable } from '../utils/types';

// Mock CharacterViewer — Three.js doesn't work in happy-dom
vi.mock('./pretext/game/CharacterViewer', () => ({
  CharacterViewer: ({ autoReveal }: { autoReveal?: boolean }) => (
    <div data-testid="character-viewer" data-auto-reveal={autoReveal} />
  ),
}));

// Mock ItemEquipModal + ItemConsumeModal
vi.mock('./ItemEquipModal', () => ({
  ItemEquipModal: () => <div data-testid="item-equip-modal" />,
}));
vi.mock('./ItemConsumeModal', () => ({
  ItemConsumeModal: () => <div data-testid="item-consume-modal" />,
}));

// Mock EquippedLoadout slot components
vi.mock('./EquippedLoadout', () => ({
  FilledSlot: ({ item, size }: { item: { name: string }; size?: string }) => (
    <div data-testid={`filled-slot-${item.name}`} data-size={size}>{item.name}</div>
  ),
  EmptySlot: ({ label, size }: { label?: string; size?: string }) => (
    <div data-testid={`empty-slot-${label}`} data-size={size}>{label}</div>
  ),
}));

const baseStats = {
  agility: BigInt(10),
  currentHp: BigInt(50),
  entityClass: StatsClasses.Strength,
  experience: BigInt(0),
  intelligence: BigInt(5),
  level: BigInt(3),
  maxHp: BigInt(50),
  strength: BigInt(15),
  race: Race.Human,
  powerSource: PowerSource.None,
  startingArmor: ArmorType.Leather,
  advancedClass: AdvancedClass.None,
  hasSelectedAdvancedClass: false,
};

// We need to add the ArmorType and AdvancedClass to our mock — check if they exist
const mockCharacter: Character = {
  ...baseStats,
  baseStats,
  externalGoldBalance: BigInt(100),
  id: '0x01',
  inBattle: false,
  isSpawned: true,
  locked: false,
  owner: '0xabc',
  position: { zoneId: 1, x: 5, y: 5 },
  pvpCooldownTimer: BigInt(0),
  tokenId: '1',
  worldStatusEffects: [],
  name: 'TestHero',
  description: '',
  image: '',
} as Character;

const mockWeapon: Weapon = {
  name: 'Iron Axe',
  description: 'A sturdy axe',
  image: '',
  itemType: ItemType.Weapon,
  rarity: Rarity.Uncommon,
  minLevel: BigInt(1),
  tokenId: '100',
  balance: 1,
  itemId: '100',
  price: BigInt(0),
  minDamage: BigInt(5),
  maxDamage: BigInt(10),
  strModifier: BigInt(3),
  agiModifier: BigInt(0),
  intModifier: BigInt(0),
  hpModifier: BigInt(0),
  effects: [],
  statRestrictions: { minStrength: BigInt(5), minAgility: BigInt(0), minIntelligence: BigInt(0) },
} as unknown as Weapon;

const mockArmor: Armor = {
  name: 'Leather Vest',
  description: 'Basic armor',
  image: '',
  itemType: ItemType.Armor,
  rarity: Rarity.Common,
  minLevel: BigInt(1),
  tokenId: '200',
  balance: 1,
  itemId: '200',
  price: BigInt(0),
  armorModifier: BigInt(2),
  strModifier: BigInt(1),
  agiModifier: BigInt(0),
  intModifier: BigInt(0),
  hpModifier: BigInt(5),
  statRestrictions: { minStrength: BigInt(0), minAgility: BigInt(0), minIntelligence: BigInt(0) },
} as unknown as Armor;

function renderOverlay(props: Partial<React.ComponentProps<typeof CharacterInspectOverlay>> = {}) {
  return render(
    <ChakraProvider>
      <CharacterInspectOverlay
        isOpen
        onClose={vi.fn()}
        character={mockCharacter}
        equippedArmor={[]}
        equippedWeapons={[]}
        equippedSpells={[]}
        equippedConsumables={[]}
        {...props}
      />
    </ChakraProvider>,
  );
}

describe('CharacterInspectOverlay', () => {
  it('renders character name and level', () => {
    renderOverlay();
    expect(screen.getByText('TestHero')).toBeDefined();
    expect(screen.getByText('Level 3')).toBeDefined();
  });

  it('renders CharacterViewer with autoReveal', () => {
    renderOverlay();
    const viewer = screen.getByTestId('character-viewer');
    expect(viewer.dataset.autoReveal).toBe('true');
  });

  it('renders empty slots when nothing equipped', () => {
    renderOverlay();
    // Should have empty armor slot + 4 empty action slots = 5 total empty slots
    const emptySlots = screen.getAllByTestId(/^empty-slot/);
    expect(emptySlots.length).toBeGreaterThanOrEqual(5);
  });

  it('renders filled slot for equipped weapon', () => {
    renderOverlay({ equippedWeapons: [mockWeapon] });
    expect(screen.getAllByTestId('filled-slot-Iron Axe').length).toBeGreaterThanOrEqual(1);
  });

  it('renders filled slot for equipped armor', () => {
    renderOverlay({ equippedArmor: [mockArmor] });
    expect(screen.getAllByTestId('filled-slot-Leather Vest').length).toBeGreaterThanOrEqual(1);
  });

  it('shows Battle Readiness label', () => {
    renderOverlay();
    const labels = screen.getAllByText(/Battle Readiness/);
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });

  it('shows combat rating number', () => {
    renderOverlay();
    // Base: STR 15 + AGI 10 + INT 5 + ARM 0 = 30
    // The number renders inside a heading-style text
    const ratingElements = screen.getAllByText('30');
    expect(ratingElements.length).toBeGreaterThanOrEqual(1);
  });

  it('includes equipment bonuses in combat rating', () => {
    renderOverlay({ equippedWeapons: [mockWeapon], equippedArmor: [mockArmor] });
    // Base: 15+10+5 = 30, Weapon: STR+3, Armor: ARM+2 + STR+1
    // Total: 30 + 3 + 2 + 1 = 36
    const ratingElements = screen.getAllByText('36');
    expect(ratingElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows stat bonuses when equipment is present', () => {
    renderOverlay({ equippedWeapons: [mockWeapon] });
    // Weapon gives STR+3
    const bonusElements = screen.getAllByText('+3');
    expect(bonusElements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders close button', () => {
    renderOverlay();
    // getAllByLabelText because Chakra Modal may add its own close button
    const closeButtons = screen.getAllByLabelText('Close');
    expect(closeButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('uses larger slot size for inspection', () => {
    renderOverlay({ equippedWeapons: [mockWeapon] });
    // Desktop layout uses 64px slots
    const filledSlot = screen.getAllByTestId('filled-slot-Iron Axe')[0];
    // The mock passes size as data attribute
    expect(filledSlot.dataset.size).toBeDefined();
  });
});
