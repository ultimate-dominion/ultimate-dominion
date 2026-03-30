import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CurrentObjectiveHud } from './CurrentObjectiveHud';

// Mock dependencies
const mockChainTable: Record<string, any> = {};
let mockCharacter: any = null;

vi.mock('../contexts/CharacterContext', () => ({
  useCharacter: () => ({ character: mockCharacter }),
}));

vi.mock('../lib/gameStore', () => ({
  useGameTable: () => mockChainTable,
  encodeCompositeKey: (id: string, fragType: string) => `${id}:${fragType}`,
}));

// Chakra wrapper
vi.mock('@chakra-ui/react', async () => {
  const actual = await vi.importActual<any>('@chakra-ui/react');
  return {
    ...actual,
    Box: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    HStack: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  };
});

describe('CurrentObjectiveHud', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    mockCharacter = null;
    Object.keys(mockChainTable).forEach(k => delete mockChainTable[k]);
  });

  it('renders null when no character', () => {
    const { container } = render(<CurrentObjectiveHud />);
    expect(container.innerHTML).toBe('');
  });

  it('renders null when character has no active chains', () => {
    mockCharacter = { id: '0xplayer' };
    const { container } = render(<CurrentObjectiveHud />);
    expect(container.innerHTML).toBe('');
  });

  it('renders null when all chains are completed', () => {
    mockCharacter = { id: '0xplayer' };
    mockChainTable['0xplayer:9'] = { totalSteps: 1, currentStep: 1, completed: true };
    mockChainTable['0xplayer:10'] = { totalSteps: 2, currentStep: 2, completed: true };

    const { container } = render(<CurrentObjectiveHud />);
    expect(container.innerHTML).toBe('');
  });

  it('shows objective for first active chain (fragment 9)', () => {
    mockCharacter = { id: '0xplayer' };
    mockChainTable['0xplayer:9'] = { totalSteps: 1, currentStep: 0, completed: false };

    render(<CurrentObjectiveHud />);
    expect(screen.getByText('Objective')).toBeTruthy();
    expect(screen.getByText('Arrive at Windy Peaks')).toBeTruthy();
    expect(screen.getByText('The Ascent')).toBeTruthy();
  });

  it('shows second chain when first is completed', () => {
    mockCharacter = { id: '0xplayer' };
    mockChainTable['0xplayer:9'] = { totalSteps: 1, currentStep: 1, completed: true };
    mockChainTable['0xplayer:10'] = { totalSteps: 2, currentStep: 0, completed: false };

    render(<CurrentObjectiveHud />);
    expect(screen.getByText('Talk to Vel')).toBeTruthy();
    expect(screen.getByText("Vel's Warning")).toBeTruthy();
  });

  it('shows correct step objective mid-chain', () => {
    mockCharacter = { id: '0xplayer' };
    mockChainTable['0xplayer:9'] = { totalSteps: 1, currentStep: 1, completed: true };
    mockChainTable['0xplayer:10'] = { totalSteps: 2, currentStep: 1, completed: false };

    render(<CurrentObjectiveHud />);
    expect(screen.getByText('Kill a Covenant Scout')).toBeTruthy();
  });

  it('skips uninitialized chains', () => {
    mockCharacter = { id: '0xplayer' };
    // Fragment 9 not in table (uninitialized)
    mockChainTable['0xplayer:10'] = { totalSteps: 2, currentStep: 0, completed: false };

    render(<CurrentObjectiveHud />);
    expect(screen.getByText('Talk to Vel')).toBeTruthy();
  });

  it('fragment XVI locked until 4 other frags completed', () => {
    mockCharacter = { id: '0xplayer' };
    // Only frag 16 initialized, but less than 4 others completed
    mockChainTable['0xplayer:16'] = { totalSteps: 3, currentStep: 0, completed: false };
    mockChainTable['0xplayer:9'] = { totalSteps: 1, currentStep: 1, completed: true };
    mockChainTable['0xplayer:10'] = { totalSteps: 2, currentStep: 2, completed: true };
    mockChainTable['0xplayer:11'] = { totalSteps: 2, currentStep: 2, completed: true };
    // Only 3 completed — XVI should be locked

    const { container } = render(<CurrentObjectiveHud />);
    expect(container.innerHTML).toBe('');
  });

  it('fragment XVI unlocks when 4+ other frags completed', () => {
    mockCharacter = { id: '0xplayer' };
    mockChainTable['0xplayer:16'] = { totalSteps: 3, currentStep: 0, completed: false };
    mockChainTable['0xplayer:9'] = { totalSteps: 1, currentStep: 1, completed: true };
    mockChainTable['0xplayer:10'] = { totalSteps: 2, currentStep: 2, completed: true };
    mockChainTable['0xplayer:11'] = { totalSteps: 2, currentStep: 2, completed: true };
    mockChainTable['0xplayer:12'] = { totalSteps: 3, currentStep: 3, completed: true };

    render(<CurrentObjectiveHud />);
    expect(screen.getByText('Reach the Summit')).toBeTruthy();
    expect(screen.getByText("The Wind's Memory")).toBeTruthy();
  });
});
