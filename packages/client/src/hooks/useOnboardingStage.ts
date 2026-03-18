import { useMemo } from 'react';

import { useCharacter } from '../contexts/CharacterContext';
import { useMap } from '../contexts/MapContext';

export enum OnboardingStage {
  PRE_SPAWN = 0,
  FIRST_STEPS = 1,
  FIRST_BLOOD = 2,
  SETTLING_IN = 3,
  ESTABLISHED = 4,
  VETERAN = 5,
}

/**
 * Pure derivation of onboarding stage from character state.
 * No side effects, no localStorage — stage is computed every render.
 */
export const computeStage = (
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

export const useOnboardingStage = (): OnboardingStage => {
  const { character } = useCharacter();
  const { isSpawned } = useMap();

  return useMemo(
    () => computeStage(isSpawned, character?.level, character?.experience),
    [isSpawned, character?.level, character?.experience],
  );
};
