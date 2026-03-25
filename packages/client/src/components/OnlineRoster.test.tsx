import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { OnlineLink } from './OnlineRoster';
import {
  AdvancedClass,
  ArmorType,
  PowerSource,
  Race,
  StatsClasses,
  type Character,
} from '../utils/types';

// --- Mock player factory ---

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: `0x${Math.random().toString(16).slice(2, 10)}`,
    name: 'TestPlayer',
    description: '',
    image: '',
    owner: '0xotherowner',
    tokenId: '1',
    locked: true,
    isSpawned: true,
    inBattle: false,
    pvpCooldownTimer: 0n,
    position: { x: 3, y: 7 },
    level: 5n,
    experience: 100n,
    currentHp: 50n,
    maxHp: 100n,
    strength: 10n,
    agility: 10n,
    intelligence: 10n,
    entityClass: StatsClasses.Strength,
    race: Race.Human,
    powerSource: PowerSource.Physical,
    startingArmor: ArmorType.Plate,
    advancedClass: AdvancedClass.Warrior,
    hasSelectedAdvancedClass: true,
    externalGoldBalance: 0n,
    worldStatusEffects: [],
    baseStats: {
      strength: 10n,
      agility: 10n,
      intelligence: 10n,
      currentHp: 50n,
      maxHp: 100n,
      level: 5n,
      experience: 100n,
      entityClass: StatsClasses.Strength,
      race: Race.Human,
      powerSource: PowerSource.Physical,
      startingArmor: ArmorType.Plate,
      advancedClass: AdvancedClass.Warrior,
      hasSelectedAdvancedClass: true,
    },
    ...overrides,
  };
}

// --- Context mocks ---

let mapState: Record<string, unknown> = {};
let mudState: Record<string, unknown> = {};

vi.mock('../contexts/MapContext', () => ({
  useMap: () => mapState,
}));

vi.mock('../contexts/MUDContext', () => ({
  useMUD: () => mudState,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@chakra-ui/react', async () => {
  const actual = await vi.importActual<typeof import('@chakra-ui/react')>('@chakra-ui/react');
  return {
    ...actual,
    useBreakpointValue: (values: Record<string, unknown>) => values.base ?? values.lg,
  };
});

// --- Tests ---

describe('OnlineRoster', () => {
  beforeEach(() => {
    mudState = { delegatorAddress: '0xcurrentplayer' };
    mapState = {
      allCharacters: [],
      allMonsters: [],
      allShops: [],
      isSpawned: true,
      position: { x: 3, y: 3 },
    };
    mockNavigate.mockClear();
  });

  afterEach(cleanup);

  describe('OnlineLink', () => {
    it('renders player count text', () => {
      mapState.allCharacters = [
        makeCharacter({ name: 'Alice' }),
        makeCharacter({ name: 'Bob' }),
      ];

      render(<OnlineLink />);
      expect(screen.getByText('2 Players Online')).toBeTruthy();
    });

    it('uses singular form for 1 player', () => {
      mapState.allCharacters = [makeCharacter({ name: 'Solo' })];

      render(<OnlineLink />);
      expect(screen.getByText('1 Player Online')).toBeTruthy();
    });

    it('shows 0 players when no one is spawned', () => {
      mapState.allCharacters = [
        makeCharacter({ name: 'Ghost', isSpawned: false }),
      ];

      render(<OnlineLink />);
      expect(screen.getByText('0 Players Online')).toBeTruthy();
    });

    it('only counts spawned players', () => {
      mapState.allCharacters = [
        makeCharacter({ name: 'Spawned', isSpawned: true }),
        makeCharacter({ name: 'NotSpawned', isSpawned: false }),
        makeCharacter({ name: 'AlsoSpawned', isSpawned: true }),
      ];

      render(<OnlineLink />);
      expect(screen.getByText('2 Players Online')).toBeTruthy();
    });

    it('opens drawer when clicked', () => {
      mapState.allCharacters = [
        makeCharacter({ name: 'Thornveil', owner: '0xother1' }),
      ];

      render(<OnlineLink />);
      fireEvent.click(screen.getByText('1 Player Online'));

      // Drawer should render with "Online" heading
      expect(screen.getByText('Online')).toBeTruthy();
    });

    it('shows player name in drawer', () => {
      mapState.allCharacters = [
        makeCharacter({ name: 'Thornveil', owner: '0xother1' }),
      ];

      render(<OnlineLink />);
      fireEvent.click(screen.getByText('1 Player Online'));

      expect(screen.getByText('Thornveil')).toBeTruthy();
    });

    it('shows current player with You tag', () => {
      mapState.allCharacters = [
        makeCharacter({ name: 'Me', owner: '0xcurrentplayer' }),
        makeCharacter({ name: 'Other', owner: '0xother1' }),
      ];

      render(<OnlineLink />);
      fireEvent.click(screen.getByText('2 Players Online'));

      // Both players visible, current player tagged
      expect(screen.getByText('Me')).toBeTruthy();
      expect(screen.getByText('Other')).toBeTruthy();
      expect(screen.getByText('You')).toBeTruthy();
    });
  });

  describe('Player status badges', () => {
    it('shows "In Battle" badge for players in battle', () => {
      mapState.allCharacters = [
        makeCharacter({ name: 'Fighter', owner: '0xother', inBattle: true }),
      ];

      render(<OnlineLink />);
      fireEvent.click(screen.getByText('1 Player Online'));

      expect(screen.getByText('In Battle')).toBeTruthy();
    });

    it('shows "Shopping" badge for players in a world encounter', () => {
      mapState.allCharacters = [
        makeCharacter({
          name: 'Shopper',
          owner: '0xother',
          worldEncounter: {
            characterId: '0xchar',
            encounterId: '0xenc',
            shopId: '0xshop',
          },
        }),
      ];

      render(<OnlineLink />);
      fireEvent.click(screen.getByText('1 Player Online'));

      expect(screen.getByText('Shopping')).toBeTruthy();
    });

    it('shows "Cooldown" badge for players in pvp cooldown', () => {
      // Set cooldown to current time (within 30s window)
      const now = BigInt(Math.floor(Date.now() / 1000));
      mapState.allCharacters = [
        makeCharacter({ name: 'CoolingDown', owner: '0xother', pvpCooldownTimer: now }),
      ];

      render(<OnlineLink />);
      fireEvent.click(screen.getByText('1 Player Online'));

      expect(screen.getByText('Cooldown')).toBeTruthy();
    });

    it('shows no status badge for idle players', () => {
      mapState.allCharacters = [
        makeCharacter({ name: 'Chilling', owner: '0xother', inBattle: false, pvpCooldownTimer: 0n }),
      ];

      render(<OnlineLink />);
      fireEvent.click(screen.getByText('1 Player Online'));

      expect(screen.queryByText('In Battle')).toBeNull();
      expect(screen.queryByText('Shopping')).toBeNull();
      expect(screen.queryByText('Cooldown')).toBeNull();
    });
  });

  describe('Player info display', () => {
    it('shows advanced class name and level', () => {
      mapState.allCharacters = [
        makeCharacter({
          name: 'Paladin1',
          owner: '0xother',
          advancedClass: AdvancedClass.Paladin,
          level: 12n,
        }),
      ];

      render(<OnlineLink />);
      fireEvent.click(screen.getByText('1 Player Online'));

      expect(screen.getByText('Paladin')).toBeTruthy();
      expect(screen.getByText('Lv12')).toBeTruthy();
    });

    it('shows tile position', () => {
      mapState.allCharacters = [
        makeCharacter({ name: 'Positioned', owner: '0xother', position: { x: 7, y: 2 } }),
      ];

      render(<OnlineLink />);
      fireEvent.click(screen.getByText('1 Player Online'));

      expect(screen.getByText(/7,2/)).toBeTruthy();
    });

    it('shows Safe tag for players in safe zone', () => {
      mapState.allCharacters = [
        makeCharacter({ name: 'SafePlayer', owner: '0xother', position: { x: 2, y: 3 } }),
      ];

      render(<OnlineLink />);
      fireEvent.click(screen.getByText('1 Player Online'));

      expect(screen.getByText('Safe')).toBeTruthy();
    });

    it('does not show Safe tag for players outside safe zone', () => {
      mapState.allCharacters = [
        makeCharacter({ name: 'DangerPlayer', owner: '0xother', position: { x: 7, y: 8 } }),
      ];

      render(<OnlineLink />);
      fireEvent.click(screen.getByText('1 Player Online'));

      expect(screen.queryByText('Safe')).toBeNull();
    });

    it('shows rank based on level ordering', () => {
      mapState.allCharacters = [
        makeCharacter({ name: 'Low', owner: '0xother1', level: 3n }),
        makeCharacter({ name: 'High', owner: '0xother2', level: 15n }),
        makeCharacter({ name: 'Mid', owner: '0xother3', level: 8n }),
      ];

      render(<OnlineLink />);
      fireEvent.click(screen.getByText('3 Players Online'));

      // High (15) = #1, Mid (8) = #2, Low (3) = #3
      expect(screen.getByText('#1')).toBeTruthy();
      expect(screen.getByText('#2')).toBeTruthy();
      expect(screen.getByText('#3')).toBeTruthy();
    });
  });

  describe('Expanded mode stats (< 10 players)', () => {
    it('shows stat pips in expanded mode', () => {
      mapState.allCharacters = [
        makeCharacter({
          name: 'StatsGuy',
          owner: '0xother',
          strength: 25n,
          agility: 18n,
          intelligence: 12n,
        }),
      ];

      render(<OnlineLink />);
      fireEvent.click(screen.getByText('1 Player Online'));

      expect(screen.getByText('25')).toBeTruthy();
      expect(screen.getByText('18')).toBeTruthy();
      expect(screen.getByText('12')).toBeTruthy();
    });
  });

  describe('Filter tabs', () => {
    it('filters by stat class', () => {
      mapState.allCharacters = [
        makeCharacter({ name: 'StrWarrior', owner: '0xother1', entityClass: StatsClasses.Strength }),
        makeCharacter({ name: 'AgiRanger', owner: '0xother2', entityClass: StatsClasses.Agility }),
        makeCharacter({ name: 'IntWizard', owner: '0xother3', entityClass: StatsClasses.Intelligence }),
      ];

      render(<OnlineLink />);
      fireEvent.click(screen.getByText('3 Players Online'));

      // Click STR tab
      fireEvent.click(screen.getByText('STR'));

      // Only STR player should be visible
      expect(screen.getByText('StrWarrior')).toBeTruthy();
      expect(screen.queryByText('AgiRanger')).toBeNull();
      expect(screen.queryByText('IntWizard')).toBeNull();
    });

    it('shows all players when All filter is selected', () => {
      mapState.allCharacters = [
        makeCharacter({ name: 'StrWarrior', owner: '0xother1', entityClass: StatsClasses.Strength }),
        makeCharacter({ name: 'AgiRanger', owner: '0xother2', entityClass: StatsClasses.Agility }),
      ];

      render(<OnlineLink />);
      fireEvent.click(screen.getByText('2 Players Online'));

      // Click AGI first
      fireEvent.click(screen.getByText('AGI'));
      expect(screen.queryByText('StrWarrior')).toBeNull();

      // Click All
      fireEvent.click(screen.getByText('All'));
      expect(screen.getByText('StrWarrior')).toBeTruthy();
      expect(screen.getByText('AgiRanger')).toBeTruthy();
    });
  });

  describe('Search', () => {
    it('filters players by name', () => {
      mapState.allCharacters = [
        makeCharacter({ name: 'Thornveil', owner: '0xother1' }),
        makeCharacter({ name: 'Ashcrown', owner: '0xother2' }),
        makeCharacter({ name: 'Thornbark', owner: '0xother3' }),
      ];

      render(<OnlineLink />);
      fireEvent.click(screen.getByText('3 Players Online'));

      const searchInput = screen.getByPlaceholderText('Search players...');
      fireEvent.change(searchInput, { target: { value: 'thorn' } });

      expect(screen.getByText('Thornveil')).toBeTruthy();
      expect(screen.getByText('Thornbark')).toBeTruthy();
      expect(screen.queryByText('Ashcrown')).toBeNull();
    });

    it('shows empty state when no results', () => {
      mapState.allCharacters = [
        makeCharacter({ name: 'Thornveil', owner: '0xother1' }),
      ];

      render(<OnlineLink />);
      fireEvent.click(screen.getByText('1 Player Online'));

      const searchInput = screen.getByPlaceholderText('Search players...');
      fireEvent.change(searchInput, { target: { value: 'zzzzz' } });

      expect(screen.getByText('No players found')).toBeTruthy();
    });
  });

  describe('Navigation', () => {
    it('navigates to character page on row click', () => {
      const playerId = '0xplayer123';
      mapState.allCharacters = [
        makeCharacter({ id: playerId, name: 'Clickable', owner: '0xother' }),
      ];

      render(<OnlineLink />);
      fireEvent.click(screen.getByText('1 Player Online'));
      fireEvent.click(screen.getByText('Clickable'));

      expect(mockNavigate).toHaveBeenCalledWith(`/characters/${playerId}`);
    });
  });
});
