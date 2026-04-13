import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FragmentProvider, useFragments } from './FragmentContext';

const mocks = vi.hoisted(() => ({
  character: {
    id: '0x000000000000000000000000000000000000cafe',
  },
  claimFragmentCall: vi.fn(),
  fragmentProgressTable: {} as Record<string, any>,
  playSfx: vi.fn(),
  position: { x: 0, y: 0 },
  renderSuccess: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({
    renderSuccess: mocks.renderSuccess,
  }),
}));

vi.mock('../hooks/useTransaction', () => ({
  useTransaction: () => ({
    execute: async (fn: () => Promise<unknown>) => fn(),
    isLoading: false,
  }),
}));

vi.mock('../lib/gameStore', () => ({
  toBigInt: (value: unknown) => BigInt(String(value ?? 0)),
  toNumber: (value: unknown) => Number(value ?? 0),
  useGameTable: () => mocks.fragmentProgressTable,
}));

vi.mock('../utils/fragmentNarratives', () => ({
  TOTAL_FRAGMENTS: 8,
}));

vi.mock('./CharacterContext', () => ({
  useCharacter: () => ({
    character: mocks.character,
  }),
}));

vi.mock('./MapContext', () => ({
  useMap: () => ({
    position: mocks.position,
  }),
}));

vi.mock('./MUDContext', () => ({
  useMUD: () => ({
    systemCalls: {
      claimFragment: mocks.claimFragmentCall,
    },
  }),
}));

vi.mock('./SoundContext', () => ({
  useGameAudio: () => ({
    soundEnabled: true,
    toggleSound: vi.fn(),
    playSfx: mocks.playSfx,
    duckMusic: vi.fn(),
  }),
}));

const keyForFragment = (fragmentType: number): string => {
  const characterKey = mocks.character.id.slice(2).padStart(64, '0');
  const fragmentKey = fragmentType.toString(16).padStart(64, '0');
  return `0x${characterKey}${fragmentKey}`;
};

const makeTriggeredFragmentRow = () => ({
  triggered: true,
  triggeredAt: 100n,
  triggerTileX: 2n,
  triggerTileY: 3n,
  claimed: false,
  claimedAt: 0n,
  tokenId: 0n,
});

const Consumer = (): JSX.Element => {
  const { claimFragment, pendingEcho } = useFragments();

  return (
    <>
      <div data-testid="pending-echo">{pendingEcho?.fragmentType ?? 'none'}</div>
      <button onClick={() => void claimFragment(1)}>claim</button>
    </>
  );
};

describe('FragmentContext SFX', () => {
  beforeEach(() => {
    mocks.fragmentProgressTable = {};
    mocks.position = { x: 0, y: 0 };
    mocks.claimFragmentCall.mockResolvedValue({ error: null, success: true });
    mocks.playSfx.mockClear();
    mocks.renderSuccess.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('plays fragment-trigger once when pendingEcho transitions from null to present', () => {
    const { rerender } = render(
      <FragmentProvider>
        <Consumer />
      </FragmentProvider>,
    );

    expect(screen.getByTestId('pending-echo').textContent).toBe('none');
    expect(mocks.playSfx).not.toHaveBeenCalled();

    mocks.fragmentProgressTable = {
      [keyForFragment(1)]: makeTriggeredFragmentRow(),
    };
    mocks.position = { x: 2, y: 3 };

    rerender(
      <FragmentProvider>
        <Consumer />
      </FragmentProvider>,
    );

    expect(screen.getByTestId('pending-echo').textContent).toBe('1');
    expect(mocks.playSfx).toHaveBeenCalledTimes(1);
    expect(mocks.playSfx).toHaveBeenCalledWith('fragment-trigger');

    rerender(
      <FragmentProvider>
        <Consumer />
      </FragmentProvider>,
    );

    expect(mocks.playSfx).toHaveBeenCalledTimes(1);
  });

  it('plays fragment-claim after a successful claim', async () => {
    mocks.fragmentProgressTable = {
      [keyForFragment(1)]: makeTriggeredFragmentRow(),
    };
    mocks.position = { x: 2, y: 3 };

    render(
      <FragmentProvider>
        <Consumer />
      </FragmentProvider>,
    );

    mocks.playSfx.mockClear();

    await act(async () => {
      screen.getByText('claim').click();
    });

    expect(mocks.claimFragmentCall).toHaveBeenCalledWith(mocks.character.id, 1);
    expect(mocks.playSfx).toHaveBeenCalledWith('fragment-claim');
  });
});
