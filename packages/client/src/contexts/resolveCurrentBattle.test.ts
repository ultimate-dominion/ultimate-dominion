import { describe, it, expect } from 'vitest';
import { resolveCurrentBattle } from './resolveCurrentBattle';
import type { CombatDetails } from '../utils/types';
import type { TableRow } from '../lib/gameStore/types';

function makeBattle(id: string, start: number, end = 0): CombatDetails {
  return {
    attackers: ['0xplayer'],
    currentTurn: 1n,
    currentTurnTimer: 0n,
    defenders: ['0xmonster'],
    encounterId: id,
    encounterType: 0,
    end: BigInt(end),
    maxTurns: 10n,
    start: BigInt(start),
  };
}

function makeOutcome(id: string): Record<string, TableRow> {
  return { [id]: { attackersWin: true, endTime: 100n } };
}

// ─── No battles ──────────────────────────────────────────────

describe('resolveCurrentBattle — no battles', () => {
  it('returns null when no battles exist', () => {
    expect(resolveCurrentBattle([], {}, null)).toBeNull();
  });

  it('returns null when no battles and lastSeen is set', () => {
    expect(resolveCurrentBattle([], {}, '0xold')).toBeNull();
  });
});

// ─── Active battle (end===0, no outcome) ─────────────────────

describe('resolveCurrentBattle — active battle', () => {
  it('returns active battle', () => {
    const battle = makeBattle('0xa', 100);
    expect(resolveCurrentBattle([battle], {}, null)).toEqual(battle);
  });

  it('returns active battle even when lastSeen references missing encounter', () => {
    const battle = makeBattle('0xa', 100); // end===0, no outcome → active
    const result = resolveCurrentBattle([battle], {}, '0xmissing');
    expect(result).toEqual(battle);
  });
});

// ─── Completed battles ───────────────────────────────────────

describe('resolveCurrentBattle — completed battles', () => {
  it('returns completed battle with outcome that has not been seen', () => {
    const battle = makeBattle('0xa', 100, 200);
    const outcomes = makeOutcome('0xa');
    expect(resolveCurrentBattle([battle], outcomes, null)).toEqual(battle);
  });

  it('returns null when latest battle matches lastSeen', () => {
    const battle = makeBattle('0xa', 100, 200);
    const outcomes = makeOutcome('0xa');
    expect(resolveCurrentBattle([battle], outcomes, '0xa')).toBeNull();
  });

  it('returns null when outcome has not synced yet (end set but no outcome)', () => {
    const battle = makeBattle('0xa', 100, 200);
    expect(resolveCurrentBattle([battle], {}, null)).toBeNull();
  });
});

// ─── Stale store — the key fix ───────────────────────────────

describe('resolveCurrentBattle — stale store (indexer behind)', () => {
  it('suppresses completed battles when lastSeen encounter is missing from store', () => {
    // Player dismissed battle C, but store only has A and B
    const battleA = makeBattle('0xa', 100, 150);
    const battleB = makeBattle('0xb', 200, 250);
    const outcomes = { ...makeOutcome('0xa'), ...makeOutcome('0xb') };

    const result = resolveCurrentBattle([battleA, battleB], outcomes, '0xc');
    expect(result).toBeNull(); // no active battle, so null
  });

  it('still shows genuinely active battle when store is stale', () => {
    // Store has old completed A and new active D, but lastSeen is C (not in store)
    const battleA = makeBattle('0xa', 100, 150);
    const battleD = makeBattle('0xd', 400); // active: end===0
    const outcomes = makeOutcome('0xa');

    const result = resolveCurrentBattle([battleA, battleD], outcomes, '0xc');
    expect(result).toEqual(battleD); // active battle still shows
  });

  it('shows completed battle when lastSeen IS in store but older', () => {
    // Store has A, B, C. Player saw B. C is unseen → show C.
    const battles = [
      makeBattle('0xa', 100, 150),
      makeBattle('0xb', 200, 250),
      makeBattle('0xc', 300, 350),
    ];
    const outcomes = {
      ...makeOutcome('0xa'),
      ...makeOutcome('0xb'),
      ...makeOutcome('0xc'),
    };

    const result = resolveCurrentBattle(battles, outcomes, '0xb');
    expect(result).toEqual(battles[2]); // show battle C
  });
});

// ─── Multiple battles, mixed state ──────────────────────────

describe('resolveCurrentBattle — mixed state', () => {
  it('prefers active battle over completed battles', () => {
    const completed = makeBattle('0xa', 100, 150);
    const active = makeBattle('0xb', 200); // end===0
    const outcomes = makeOutcome('0xa');

    const result = resolveCurrentBattle([completed, active], outcomes, null);
    expect(result).toEqual(active);
  });

  it('returns latest completed battle when no active battle', () => {
    const battles = [
      makeBattle('0xa', 100, 150),
      makeBattle('0xb', 200, 250),
    ];
    const outcomes = { ...makeOutcome('0xa'), ...makeOutcome('0xb') };

    const result = resolveCurrentBattle(battles, outcomes, null);
    expect(result).toEqual(battles[1]); // latest completed
  });
});
