import { ChakraProvider } from '@chakra-ui/react';
import { render, act, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ItemType, Rarity } from '../utils/types';

import { LootReveal } from './LootReveal';

const mockPlaySfx = vi.fn();
const mockDuckMusic = vi.fn();

vi.mock('../contexts/SoundContext', () => ({
  useGameAudio: () => ({
    soundEnabled: true,
    toggleSound: vi.fn(),
    playSfx: mockPlaySfx,
    duckMusic: mockDuckMusic,
  }),
}));

vi.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('./ItemAsciiIcon', () => ({
  ItemAsciiIcon: () => <div data-testid="item-ascii-icon" />,
}));

const makeLoot = (rarity: Rarity) => ({
  agiModifier: 0n,
  armorModifier: 0n,
  balance: 1n,
  description: '',
  hpModifier: 0n,
  image: '',
  intModifier: 0n,
  itemId: '0xitem',
  itemType: ItemType.Armor,
  minLevel: 0n,
  name: `Loot ${rarity}`,
  owner: '0xowner',
  price: 0n,
  rarity,
  statRestrictions: {
    minAgility: 0n,
    minIntelligence: 0n,
    minStrength: 0n,
  },
  strModifier: 0n,
  tokenId: String(rarity),
});

describe('LootReveal SFX', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockPlaySfx.mockClear();
    mockDuckMusic.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('plays rare SFX without music ducking', () => {
    render(
      <ChakraProvider>
        <LootReveal items={[makeLoot(Rarity.Rare) as any]} />
      </ChakraProvider>,
    );

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(mockPlaySfx).toHaveBeenCalledWith('loot-rare');
    expect(mockDuckMusic).not.toHaveBeenCalled();
  });

  it('plays epic SFX and ducks music', () => {
    render(
      <ChakraProvider>
        <LootReveal items={[makeLoot(Rarity.Epic) as any]} />
      </ChakraProvider>,
    );

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(mockPlaySfx).toHaveBeenCalledWith('loot-epic');
    expect(mockDuckMusic).toHaveBeenCalledWith(3000);
  });

  it('keeps common and uncommon loot silent', () => {
    render(
      <ChakraProvider>
        <LootReveal
          items={[
            makeLoot(Rarity.Common) as any,
            makeLoot(Rarity.Uncommon) as any,
          ]}
        />
      </ChakraProvider>,
    );

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(mockPlaySfx).not.toHaveBeenCalled();
    expect(mockDuckMusic).not.toHaveBeenCalled();
  });
});
