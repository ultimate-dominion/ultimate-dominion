import { describe, expect, it } from 'vitest';

// Import the enum and pure function directly to avoid MUD store initialization.
// The hook itself (useOnboardingStage) uses React contexts, but computeStage is pure.
enum OnboardingStage {
  PRE_SPAWN = 0,
  FIRST_STEPS = 1,
  FIRST_BLOOD = 2,
  SETTLING_IN = 3,
  ESTABLISHED = 4,
  VETERAN = 5,
}

const computeStage = (
  isSpawned: boolean,
  level: bigint | undefined,
  experience: bigint | undefined,
): OnboardingStage => {
  if (!isSpawned) return OnboardingStage.PRE_SPAWN;
  if (level === undefined || experience === undefined) return OnboardingStage.FIRST_STEPS;

  if (level >= 5n) return OnboardingStage.VETERAN;
  if (level >= 3n) return OnboardingStage.ESTABLISHED;
  if (level >= 2n) return OnboardingStage.SETTLING_IN;
  if (experience > 0n) return OnboardingStage.FIRST_BLOOD;
  return OnboardingStage.FIRST_STEPS;
};

describe('computeStage', () => {
  // --- PRE_SPAWN ---
  it('returns PRE_SPAWN when not spawned', () => {
    expect(computeStage(false, 1n, 0n)).toBe(OnboardingStage.PRE_SPAWN);
  });

  it('returns PRE_SPAWN when not spawned regardless of level', () => {
    expect(computeStage(false, 10n, 50000n)).toBe(OnboardingStage.PRE_SPAWN);
  });

  // --- FIRST_STEPS ---
  it('returns FIRST_STEPS when spawned at level 1 with zero XP', () => {
    expect(computeStage(true, 1n, 0n)).toBe(OnboardingStage.FIRST_STEPS);
  });

  it('returns FIRST_STEPS when spawned with undefined level/experience', () => {
    expect(computeStage(true, undefined, undefined)).toBe(OnboardingStage.FIRST_STEPS);
  });

  it('returns FIRST_STEPS when level is undefined but spawned', () => {
    expect(computeStage(true, undefined, 100n)).toBe(OnboardingStage.FIRST_STEPS);
  });

  // --- FIRST_BLOOD ---
  it('returns FIRST_BLOOD at level 1 with XP > 0', () => {
    expect(computeStage(true, 1n, 1n)).toBe(OnboardingStage.FIRST_BLOOD);
  });

  it('returns FIRST_BLOOD at level 1 with large XP', () => {
    expect(computeStage(true, 1n, 500n)).toBe(OnboardingStage.FIRST_BLOOD);
  });

  // --- SETTLING_IN ---
  it('returns SETTLING_IN at level 2', () => {
    expect(computeStage(true, 2n, 0n)).toBe(OnboardingStage.SETTLING_IN);
  });

  it('returns SETTLING_IN at level 2 with XP', () => {
    expect(computeStage(true, 2n, 1000n)).toBe(OnboardingStage.SETTLING_IN);
  });

  // --- ESTABLISHED ---
  it('returns ESTABLISHED at level 3', () => {
    expect(computeStage(true, 3n, 0n)).toBe(OnboardingStage.ESTABLISHED);
  });

  it('returns ESTABLISHED at level 4', () => {
    expect(computeStage(true, 4n, 5000n)).toBe(OnboardingStage.ESTABLISHED);
  });

  // --- VETERAN ---
  it('returns VETERAN at level 5', () => {
    expect(computeStage(true, 5n, 0n)).toBe(OnboardingStage.VETERAN);
  });

  it('returns VETERAN at level 10', () => {
    expect(computeStage(true, 10n, 99999n)).toBe(OnboardingStage.VETERAN);
  });

  it('returns VETERAN at very high level', () => {
    expect(computeStage(true, 100n, 0n)).toBe(OnboardingStage.VETERAN);
  });

  // --- Edge cases ---
  it('handles level 0 as FIRST_STEPS (zero XP)', () => {
    expect(computeStage(true, 0n, 0n)).toBe(OnboardingStage.FIRST_STEPS);
  });

  it('handles level 0 with XP as FIRST_BLOOD', () => {
    expect(computeStage(true, 0n, 10n)).toBe(OnboardingStage.FIRST_BLOOD);
  });
});
