import { useMemo } from 'react';
import { useGameTable, encodeCompositeKey } from '../lib/gameStore';
import { useCharacter } from '../contexts/CharacterContext';
import { NPC_NARRATIVES } from '../utils/npcNarratives';
import { CHAIN_PROGRESS_TABLE } from '../utils/fragmentChainData';

/**
 * Resolves the correct NPC title and atmospheric flavor text based on the
 * player's current fragment chain progress.
 *
 * For each fragmentType the NPC has chain flavors for, checks if that chain
 * is active (initialized and not completed) and returns the flavor for the
 * current step. Falls back to defaultFlavor.
 */
export function useNpcFlavor(metadataUri: string): { title: string; flavor: string } {
  const { character } = useCharacter();
  const chainTable = useGameTable(CHAIN_PROGRESS_TABLE);

  return useMemo(() => {
    const narrative = NPC_NARRATIVES[metadataUri];
    if (!narrative) {
      return { title: '', flavor: '' };
    }

    if (!character?.id) {
      return { title: narrative.title, flavor: narrative.defaultFlavor };
    }

    // Check each chain this NPC has flavor for, in order
    for (const fragTypeStr of Object.keys(narrative.chainFlavors)) {
      const fragType = Number(fragTypeStr);
      const key = encodeCompositeKey(character.id, fragType.toString());
      const data = chainTable[key];

      if (!data) continue;

      const totalSteps = Number(data.totalSteps ?? 0);
      const currentStep = Number(data.currentStep ?? 0);
      const completed = data.completed === true;

      // Skip completed or uninitialized chains
      if (completed || totalSteps === 0) continue;

      // Return the flavor for the current step if it exists
      const stepFlavors = narrative.chainFlavors[fragType];
      if (stepFlavors && stepFlavors[currentStep] !== undefined) {
        return { title: narrative.title, flavor: stepFlavors[currentStep] };
      }
    }

    return { title: narrative.title, flavor: narrative.defaultFlavor };
  }, [metadataUri, character?.id, chainTable]);
}
