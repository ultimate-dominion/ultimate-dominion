import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameTable, encodeCompositeKey } from '../lib/gameStore';
import { useCharacter } from '../contexts/CharacterContext';
import { NPC_CHAIN_STRUCTURE } from '../utils/npcNarratives';
import { CHAIN_PROGRESS_TABLE } from '../utils/fragmentChainData';

/**
 * Resolves the correct NPC title and atmospheric flavor text based on the
 * player's current fragment chain progress.
 *
 * Text is read from the 'narrative' i18n namespace under the "npc" key.
 * Structure (which chains/steps have flavors) comes from NPC_CHAIN_STRUCTURE.
 */
export function useNpcFlavor(metadataUri: string): { title: string; flavor: string } {
  const { t } = useTranslation('narrative');
  const { character } = useCharacter();
  const chainTable = useGameTable(CHAIN_PROGRESS_TABLE);

  const structure = NPC_CHAIN_STRUCTURE[metadataUri];

  return useMemo(() => {
    if (!structure) {
      return { title: '', flavor: '' };
    }

    const { npcKey } = structure;
    const title = t(`npc.${npcKey}.title`);
    const defaultFlavor = t(`npc.${npcKey}.defaultFlavor`);

    if (!character?.id) {
      return { title, flavor: defaultFlavor };
    }

    // Check each chain this NPC has flavor for, in order
    for (const fragTypeStr of Object.keys(structure.chains)) {
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
      if (structure.chains[fragType]?.includes(currentStep)) {
        return { title, flavor: t(`npc.${npcKey}.chain.${fragType}.${currentStep}`) };
      }
    }

    return { title, flavor: defaultFlavor };
  }, [metadataUri, character?.id, chainTable, structure, t]);
}
