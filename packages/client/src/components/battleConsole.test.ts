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
    expect(state.badge).toBe('PvE');
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
});
