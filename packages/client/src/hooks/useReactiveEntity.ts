import { useMemo } from 'react';

import {
  encodeAddressKey,
  encodeUint256Key,
  toBigInt,
  useGameValue,
} from '../lib/gameStore';
import { useCharacterMetadata } from './useCharacterMetadata';
import { buildCharacter } from '../utils/buildCharacter';
import type { Character } from '../utils/types';

/**
 * Fully reactive hook for a single entity. Each `useGameValue` call
 * subscribes to exactly one Zustand store slice — re-renders ONLY
 * when this specific entity's data changes.
 */
export function useReactiveEntity(entityId: string | undefined): Character | null {
  const statsData = useGameValue('Stats', entityId);
  const characterData = useGameValue('Characters', entityId);
  const encounterData = useGameValue('EncounterEntity', entityId);
  const posData = useGameValue('Position', entityId);
  const spawnedData = useGameValue('Spawned', entityId);
  const effectsData = useGameValue('WorldStatusEffects', entityId);
  const escrowData = useGameValue('AdventureEscrow', entityId);

  // Derived keys — only computed when characterData exists
  const ownerKey = useMemo(
    () => characterData ? encodeAddressKey(characterData.owner as string) : undefined,
    [characterData],
  );
  const tokenIdKey = useMemo(
    () => characterData ? encodeUint256Key(toBigInt(characterData.tokenId)) : undefined,
    [characterData],
  );

  const goldData = useGameValue('GoldBalances', ownerKey);
  const tokenURIData = useGameValue('CharactersTokenURI', tokenIdKey);

  const tokenURI = tokenURIData?.tokenURI as string | undefined;
  const metadata = useCharacterMetadata(tokenURI);

  return useMemo(() => {
    if (!entityId || !characterData || !statsData) return null;

    return buildCharacter(
      entityId,
      characterData as Record<string, unknown>,
      statsData as Record<string, unknown>,
      goldData as Record<string, unknown> | undefined,
      escrowData as Record<string, unknown> | undefined,
      encounterData as Record<string, unknown> | undefined,
      posData as Record<string, unknown> | undefined,
      spawnedData as Record<string, unknown> | undefined,
      metadata,
      effectsData as Record<string, unknown> | undefined,
    );
  }, [
    entityId,
    characterData,
    statsData,
    goldData,
    escrowData,
    encounterData,
    posData,
    spawnedData,
    metadata,
    effectsData,
  ]);
}
