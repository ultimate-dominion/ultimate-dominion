import { describe, expect, it } from 'vitest';

// Import the enum and pure function directly to avoid MUD store initialization.
// The hook itself (useOnboardingStage) uses React contexts, but computeStage is pure.
enum OnboardingStage {
  PRE_SPAWN = 0,
  JUST_SPAWNED = 1,
  FIRST_STEPS = 2,
  FIRST_BLOOD = 3,
  SETTLING_IN = 4,
  ESTABLISHED = 5,
  VETERAN = 6,
}

const computeStage = (
  isSpawned: boolean,
  level: bigint | undefined,
  experience: bigint | undefined,
  hasClaimedFragment: boolean,
): OnboardingStage => {
  if (!isSpawned) return OnboardingStage.PRE_SPAWN;
  if (level === undefined || experience === undefined) return OnboardingStage.JUST_SPAWNED;

  if (level >= 5n) return OnboardingStage.VETERAN;
  if (level >= 3n) return OnboardingStage.ESTABLISHED;
  if (level >= 2n) return OnboardingStage.SETTLING_IN;
  if (experience > 0n) return OnboardingStage.FIRST_BLOOD;
  if (hasClaimedFragment) return OnboardingStage.FIRST_STEPS;
  return OnboardingStage.JUST_SPAWNED;
};

describe('computeStage', () => {
  // --- PRE_SPAWN ---
  it('returns PRE_SPAWN when not spawned', () => {
    expect(computeStage(false, 1n, 0n, false)).toBe(OnboardingStage.PRE_SPAWN);
  });

  it('returns PRE_SPAWN when not spawned regardless of level', () => {
    expect(computeStage(false, 10n, 50000n, true)).toBe(OnboardingStage.PRE_SPAWN);
  });

  // --- JUST_SPAWNED ---
  it('returns JUST_SPAWNED when spawned at level 1 with zero XP and no fragment', () => {
    expect(computeStage(true, 1n, 0n, false)).toBe(OnboardingStage.JUST_SPAWNED);
  });

  it('returns JUST_SPAWNED when spawned with undefined level/experience', () => {
    expect(computeStage(true, undefined, undefined, false)).toBe(OnboardingStage.JUST_SPAWNED);
  });

  it('returns JUST_SPAWNED when level is undefined but spawned', () => {
    expect(computeStage(true, undefined, 100n, true)).toBe(OnboardingStage.JUST_SPAWNED);
  });

  it('returns JUST_SPAWNED at level 0 with zero XP and no fragment', () => {
    expect(computeStage(true, 0n, 0n, false)).toBe(OnboardingStage.JUST_SPAWNED);
  });

  // --- FIRST_STEPS ---
  it('returns FIRST_STEPS when spawned at level 1 with zero XP and fragment claimed', () => {
    expect(computeStage(true, 1n, 0n, true)).toBe(OnboardingStage.FIRST_STEPS);
  });

  it('returns FIRST_STEPS at level 0 with zero XP and fragment claimed', () => {
    expect(computeStage(true, 0n, 0n, true)).toBe(OnboardingStage.FIRST_STEPS);
  });

  // --- FIRST_BLOOD ---
  it('returns FIRST_BLOOD at level 1 with XP > 0', () => {
    expect(computeStage(true, 1n, 1n, true)).toBe(OnboardingStage.FIRST_BLOOD);
  });

  it('returns FIRST_BLOOD at level 1 with large XP', () => {
    expect(computeStage(true, 1n, 500n, true)).toBe(OnboardingStage.FIRST_BLOOD);
  });

  it('returns FIRST_BLOOD even without fragment if XP > 0', () => {
    expect(computeStage(true, 1n, 1n, false)).toBe(OnboardingStage.FIRST_BLOOD);
  });

  // --- SETTLING_IN ---
  it('returns SETTLING_IN at level 2', () => {
    expect(computeStage(true, 2n, 0n, true)).toBe(OnboardingStage.SETTLING_IN);
  });

  it('returns SETTLING_IN at level 2 with XP', () => {
    expect(computeStage(true, 2n, 1000n, true)).toBe(OnboardingStage.SETTLING_IN);
  });

  // --- ESTABLISHED ---
  it('returns ESTABLISHED at level 3', () => {
    expect(computeStage(true, 3n, 0n, true)).toBe(OnboardingStage.ESTABLISHED);
  });

  it('returns ESTABLISHED at level 4', () => {
    expect(computeStage(true, 4n, 5000n, true)).toBe(OnboardingStage.ESTABLISHED);
  });

  // --- VETERAN ---
  it('returns VETERAN at level 5', () => {
    expect(computeStage(true, 5n, 0n, true)).toBe(OnboardingStage.VETERAN);
  });

  it('returns VETERAN at level 10', () => {
    expect(computeStage(true, 10n, 99999n, true)).toBe(OnboardingStage.VETERAN);
  });

  it('returns VETERAN at very high level', () => {
    expect(computeStage(true, 100n, 0n, true)).toBe(OnboardingStage.VETERAN);
  });

  // --- Edge cases ---
  it('returns FIRST_BLOOD at level 0 with XP (fragment irrelevant)', () => {
    expect(computeStage(true, 0n, 10n, false)).toBe(OnboardingStage.FIRST_BLOOD);
  });
});
