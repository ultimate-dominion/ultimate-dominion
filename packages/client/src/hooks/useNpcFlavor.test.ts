import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNpcFlavor } from './useNpcFlavor';

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

describe('useNpcFlavor', () => {
  beforeEach(() => {
    mockCharacter = null;
    Object.keys(mockChainTable).forEach(k => delete mockChainTable[k]);
  });

  it('returns empty title and flavor for unknown metadataUri', () => {
    const { result } = renderHook(() => useNpcFlavor('npc:unknown'));
    expect(result.current).toEqual({ title: '', flavor: '' });
  });

  it('returns title and defaultFlavor when no character', () => {
    mockCharacter = null;
    const { result } = renderHook(() => useNpcFlavor('npc:vel_morrow'));
    expect(result.current.title).toBe('The Blade');
    expect(result.current.flavor).toBe('She watches the ridge with pale eyes. Always counting exits.');
  });

  it('returns defaultFlavor when character has no active chains', () => {
    mockCharacter = { id: '0xplayer' };
    const { result } = renderHook(() => useNpcFlavor('npc:vel_morrow'));
    expect(result.current.title).toBe('The Blade');
    expect(result.current.flavor).toBe('She watches the ridge with pale eyes. Always counting exits.');
  });

  it('returns chain-specific flavor when chain is active at matching step', () => {
    mockCharacter = { id: '0xplayer' };
    // Fragment 10 (Vel's Warning), step 0, not completed
    mockChainTable['0xplayer:10'] = { totalSteps: 2, currentStep: 0, completed: false };

    const { result } = renderHook(() => useNpcFlavor('npc:vel_morrow'));
    expect(result.current.title).toBe('The Blade');
    expect(result.current.flavor).toBe('Her hand rests on her blade. She heard you coming three tiles ago.');
  });

  it('returns chain-specific flavor for step 1', () => {
    mockCharacter = { id: '0xplayer' };
    mockChainTable['0xplayer:10'] = { totalSteps: 2, currentStep: 1, completed: false };

    const { result } = renderHook(() => useNpcFlavor('npc:vel_morrow'));
    expect(result.current.flavor).toBe('The markers are fresh. Someone from the Covenant is up here.');
  });

  it('skips completed chains and falls back to default', () => {
    mockCharacter = { id: '0xplayer' };
    mockChainTable['0xplayer:10'] = { totalSteps: 2, currentStep: 2, completed: true };
    mockChainTable['0xplayer:11'] = { totalSteps: 2, currentStep: 1, completed: true };
    mockChainTable['0xplayer:12'] = { totalSteps: 3, currentStep: 3, completed: true };

    const { result } = renderHook(() => useNpcFlavor('npc:vel_morrow'));
    expect(result.current.flavor).toBe('She watches the ridge with pale eyes. Always counting exits.');
  });

  it('skips uninitialized chains (totalSteps = 0)', () => {
    mockCharacter = { id: '0xplayer' };
    mockChainTable['0xplayer:10'] = { totalSteps: 0, currentStep: 0, completed: false };
    // Fragment 11 is active
    mockChainTable['0xplayer:11'] = { totalSteps: 2, currentStep: 0, completed: false };

    const { result } = renderHook(() => useNpcFlavor('npc:vel_morrow'));
    expect(result.current.flavor).toBe('She traces a scar on her forearm without looking at it.');
  });

  it('returns defaultFlavor when active chain step has no flavor text', () => {
    mockCharacter = { id: '0xplayer' };
    // Vel has chain flavors for frag 10 steps 0,1 only — step 2 doesn't exist
    mockChainTable['0xplayer:10'] = { totalSteps: 3, currentStep: 2, completed: false };

    const { result } = renderHook(() => useNpcFlavor('npc:vel_morrow'));
    // No flavor for step 2 in frag 10, check next chain (11 — not in table), then frag 12 (not in table)
    expect(result.current.flavor).toBe('She watches the ridge with pale eyes. Always counting exits.');
  });

  it('works for world objects (single chain flavor)', () => {
    mockCharacter = { id: '0xplayer' };
    mockChainTable['0xplayer:12'] = { totalSteps: 3, currentStep: 1, completed: false };

    const { result } = renderHook(() => useNpcFlavor('worldobj:camp_journal'));
    expect(result.current.title).toBe('Abandoned Camp');
    expect(result.current.flavor).toBe('A leather-bound log, left behind or left deliberately.');
  });

  it('world object returns defaultFlavor when chain step does not match', () => {
    mockCharacter = { id: '0xplayer' };
    mockChainTable['0xplayer:12'] = { totalSteps: 3, currentStep: 0, completed: false };

    const { result } = renderHook(() => useNpcFlavor('worldobj:camp_journal'));
    // Camp journal only has flavor for frag 12 step 1, not step 0
    expect(result.current.flavor).toBe('Pages flutter in the wind. The ink is still wet.');
  });

  it('checks chains in fragment type order, returns first match', () => {
    mockCharacter = { id: '0xplayer' };
    // Both frag 10 and 11 active for Vel
    mockChainTable['0xplayer:10'] = { totalSteps: 2, currentStep: 0, completed: false };
    mockChainTable['0xplayer:11'] = { totalSteps: 2, currentStep: 0, completed: false };

    const { result } = renderHook(() => useNpcFlavor('npc:vel_morrow'));
    // Should return frag 10 step 0 since it comes first
    expect(result.current.flavor).toBe('Her hand rests on her blade. She heard you coming three tiles ago.');
  });
});
