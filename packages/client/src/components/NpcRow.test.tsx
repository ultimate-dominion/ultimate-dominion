import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { NpcRow } from './NpcRow';

const mockNavigate = vi.fn();
const mockOpenDialogue = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../hooks/useNpcFlavor', () => ({
  useNpcFlavor: () => ({ title: null, flavor: null }),
}));

vi.mock('@chakra-ui/react', async () => {
  const actual = await vi.importActual<typeof import('@chakra-ui/react')>('@chakra-ui/react');
  return {
    ...actual,
    Box: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
    HStack: ({ children, onClick }: any) => <div onClick={onClick}>{children}</div>,
    VStack: ({ children }: any) => <div>{children}</div>,
    Text: ({ children }: any) => <span>{children}</span>,
  };
});

describe('NpcRow', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockOpenDialogue.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('navigates to /respec when a respec NPC is clicked', () => {
    render(
      <NpcRow
        npcName="Vel Morrow"
        interaction="respec"
        entityId="0xvel"
        metadataUri=""
        onOpenDialogue={mockOpenDialogue}
      />,
    );

    fireEvent.click(screen.getByText('Vel Morrow'));
    expect(mockNavigate).toHaveBeenCalledWith('/respec');
    expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringContaining('/character'));
  });

  it('never navigates to /character?tab=respec (legacy path removed)', () => {
    render(
      <NpcRow
        npcName="Vel Morrow"
        interaction="respec"
        entityId="0xvel"
        metadataUri=""
        onOpenDialogue={mockOpenDialogue}
      />,
    );

    fireEvent.click(screen.getByText('Vel Morrow'));
    const calls = mockNavigate.mock.calls.flat();
    expect(calls.some((arg: unknown) => typeof arg === 'string' && arg.includes('tab=respec'))).toBe(false);
  });

  it('navigates to /guild when a guild NPC is clicked', () => {
    render(
      <NpcRow
        npcName="Founder"
        interaction="guild"
        entityId="0xguild"
        metadataUri=""
        onOpenDialogue={mockOpenDialogue}
      />,
    );

    fireEvent.click(screen.getByText('Founder'));
    expect(mockNavigate).toHaveBeenCalledWith('/guild');
  });

  it('calls onOpenDialogue for dialogue NPCs (no navigation)', () => {
    render(
      <NpcRow
        npcName="Storyteller"
        interaction="dialogue"
        entityId="0xstory"
        metadataUri="ipfs://meta"
        onOpenDialogue={mockOpenDialogue}
      />,
    );

    fireEvent.click(screen.getByText('Storyteller'));
    expect(mockOpenDialogue).toHaveBeenCalledWith('0xstory', 'Storyteller', 'ipfs://meta');
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
