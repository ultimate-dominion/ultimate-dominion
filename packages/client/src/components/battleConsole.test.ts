import { describe, expect, it } from 'vitest';

import { getBattleConsoleState } from './battleConsole';
import { EncounterType } from '../utils/types';

describe('getBattleConsoleState', () => {
  it('describes PvE battles as targeted move selection', () => {
    const state = getBattleConsoleState({
      encounterType: EncounterType.PvE,
      opponentDisplayName: 'Dire Rat',
      userTurn: true,
      canAttack: true,
      turnTimeLeft: 32,
    });

    expect(state.eyebrow).toBe('Battle Console');
    expect(state.title).toBe('Choose your move against Dire Rat.');
  });

  it('omits detail text and badge for PvE encounters', () => {
    const state = getBattleConsoleState({
      encounterType: EncounterType.PvE,
      opponentDisplayName: 'Goblin',
      userTurn: true,
      canAttack: true,
      turnTimeLeft: 32,
    });

    expect(state.detail).toBe('');
    expect(state.badge).toBe('');
  });

  it('describes a stalled PvP turn as a counter window', () => {
    const state = getBattleConsoleState({
      encounterType: EncounterType.PvP,
      opponentDisplayName: 'Rival',
      userTurn: false,
      canAttack: true,
      turnTimeLeft: 0,
    });

    expect(state.title).toBe('Counter window is open.');
    expect(state.badge).toBe('Counter');
  });

  it('shows turn timer badge for PvP user turn', () => {
    const state = getBattleConsoleState({
      encounterType: EncounterType.PvP,
      opponentDisplayName: 'Rival',
      userTurn: true,
      canAttack: true,
      turnTimeLeft: 15,
    });

    expect(state.title).toBe('Your turn to strike.');
    expect(state.badge).toBe('15s');
    expect(state.detail).toContain('15s');
  });

  it('shows waiting state for PvP opponent turn', () => {
    const state = getBattleConsoleState({
      encounterType: EncounterType.PvP,
      opponentDisplayName: 'Rival',
      userTurn: false,
      canAttack: false,
      turnTimeLeft: 20,
    });

    expect(state.title).toBe('Enemy turn.');
    expect(state.badge).toBe('20s');
    expect(state.detail).toContain('20s');
  });
});
