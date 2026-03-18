import { useMemo } from 'react';

import { useCharacter } from '../contexts/CharacterContext';
import { useFragments } from '../contexts/FragmentContext';
import { useMap } from '../contexts/MapContext';

export enum OnboardingStage {
  PRE_SPAWN = 0,
  JUST_SPAWNED = 1,
  FIRST_STEPS = 2,
  FIRST_BLOOD = 3,
  SETTLING_IN = 4,
  ESTABLISHED = 5,
  VETERAN = 6,
}

/**
 * Pure derivation of onboarding stage from character state.
 * No side effects, no localStorage — stage is computed every render.
 */
export const computeStage = (
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

export const useOnboardingStage = (): OnboardingStage => {
  const { character } = useCharacter();
  const { isSpawned } = useMap();
  const { fragments } = useFragments();

  const hasClaimedFragment = useMemo(
    () => fragments?.some(f => f.claimed) ?? false,
    [fragments],
  );

  return useMemo(
    () => computeStage(isSpawned, character?.level, character?.experience, hasClaimedFragment),
    [isSpawned, character?.level, character?.experience, hasClaimedFragment],
  );
};
