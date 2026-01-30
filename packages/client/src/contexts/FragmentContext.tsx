import { useEntityQuery } from '@latticexyz/react';
import {
  Entity,
  getComponentValue,
  Has,
  HasValue,
} from '@latticexyz/recs';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { useToast } from '../hooks/useToast';
import {
  FRAGMENT_NARRATIVES,
  getFragmentInfo,
  TOTAL_FRAGMENTS,
} from '../utils/fragmentNarratives';

import { useCharacter } from './CharacterContext';
import { useMap } from './MapContext';
import { useMUD } from './MUDContext';

export type FragmentStatus = {
  fragmentType: number;
  name: string;
  narrative: string;
  hint: string;
  triggered: boolean;
  triggeredAt: number;
  triggerTileX: number;
  triggerTileY: number;
  claimed: boolean;
  claimedAt: number;
  tokenId: bigint;
};

type FragmentContextType = {
  fragments: FragmentStatus[];
  pendingEcho: FragmentStatus | null;
  isLoading: boolean;
  isClaiming: boolean;
  claimFragment: (fragmentType: number) => Promise<void>;
  refreshFragments: () => void;
};

const FragmentContext = createContext<FragmentContextType>({
  fragments: [],
  pendingEcho: null,
  isLoading: true,
  isClaiming: false,
  claimFragment: async () => {},
  refreshFragments: () => {},
});

export type FragmentProviderProps = {
  children: ReactNode;
};

export const FragmentProvider = ({
  children,
}: FragmentProviderProps): JSX.Element => {
  const { renderError, renderSuccess } = useToast();
  const {
    components,
    systemCalls: { claimFragment: claimFragmentCall },
  } = useMUD();
  const { character } = useCharacter();
  const { position } = useMap();

  const [isClaiming, setIsClaiming] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const FragmentProgress = components?.FragmentProgress;

  // Get all fragment progress entities (filter by character in useMemo)
  const allFragmentEntities = useEntityQuery(
    FragmentProgress ? [Has(FragmentProgress)] : [],
  );

  // Debug: log all entities found
  console.log('[FragmentContext] All FragmentProgress entities:', allFragmentEntities.length);
  allFragmentEntities.forEach(entity => {
    const progress = FragmentProgress ? getComponentValue(FragmentProgress, entity) : null;
    console.log('[FragmentContext] Entity:', entity, 'Data:', progress);
  });

  // Filter to only this character's fragments
  // Note: characterId is part of the entity KEY, not the value
  // Entity format: characterId (64 chars) + fragmentType (64 chars) = 128 hex chars + '0x' prefix
  const fragmentEntities = allFragmentEntities.filter(entity => {
    if (!character?.id) return false;
    // Entity key starts with characterId (first 66 chars including 0x prefix)
    const entityCharacterId = entity.slice(0, 66);
    const matches = entityCharacterId.toLowerCase() === character.id.toLowerCase();
    console.log('[FragmentContext] Comparing:', { entityCharacterId, characterId: character.id, matches });
    return matches;
  });

  const fragments = useMemo(() => {
    console.log('[FragmentContext] Building fragments:', {
      hasCharacter: !!character,
      characterId: character?.id,
      hasFragmentProgress: !!FragmentProgress,
      fragmentEntitiesCount: fragmentEntities.length,
      position,
    });

    if (!character || !FragmentProgress) {
      return [];
    }

    // Debug: log all fragment entities found
    fragmentEntities.forEach(entity => {
      const progress = getComponentValue(FragmentProgress, entity);
      console.log('[FragmentContext] Found entity:', entity, 'progress:', progress);
    });

    const fragmentStatuses: FragmentStatus[] = [];

    // Build fragment statuses for all 8 fragments
    for (let i = 1; i <= TOTAL_FRAGMENTS; i++) {
      const info = getFragmentInfo(i);
      if (!info) continue;

      // Find the matching fragment progress entity
      // Fragment type is encoded in the entity key (last 64 hex chars after characterId)
      const progressEntity = fragmentEntities.find(entity => {
        // Entity format: 0x + characterId (64 chars) + fragmentType (64 chars)
        // Extract fragment type from the last 64 characters
        const fragmentTypeHex = entity.slice(-64);
        const entityFragmentType = parseInt(fragmentTypeHex, 16);
        return entityFragmentType === i;
      });

      const progress = progressEntity
        ? getComponentValue(FragmentProgress, progressEntity)
        : null;

      fragmentStatuses.push({
        fragmentType: i,
        name: info.name,
        narrative: info.narrative,
        hint: info.hint,
        triggered: progress?.triggered ?? false,
        triggeredAt: Number(progress?.triggeredAt ?? 0),
        triggerTileX: progress?.triggerTileX ?? 0,
        triggerTileY: progress?.triggerTileY ?? 0,
        claimed: progress?.claimed ?? false,
        claimedAt: Number(progress?.claimedAt ?? 0),
        tokenId: progress?.tokenId ?? BigInt(0),
      });
    }

    return fragmentStatuses;
  }, [character, FragmentProgress, fragmentEntities, refreshKey]);

  // Check if there's a pending echo on the current tile
  const pendingEcho = useMemo(() => {
    console.log('[FragmentContext] Checking pendingEcho:', {
      position,
      fragmentsCount: fragments.length,
      triggeredFragments: fragments.filter(f => f.triggered).map(f => ({
        type: f.fragmentType,
        name: f.name,
        triggered: f.triggered,
        claimed: f.claimed,
        triggerTileX: f.triggerTileX,
        triggerTileY: f.triggerTileY,
      })),
    });

    if (!position) return null;

    const echo = fragments.find(
      f =>
        f.triggered &&
        !f.claimed &&
        f.triggerTileX === position.x &&
        f.triggerTileY === position.y,
    ) ?? null;

    console.log('[FragmentContext] pendingEcho result:', echo);
    return echo;
  }, [fragments, position]);

  const claimFragment = useCallback(
    async (fragmentType: number) => {
      try {
        setIsClaiming(true);

        if (!character) {
          throw new Error('No character found.');
        }

        if (!claimFragmentCall) {
          throw new Error('Claim function not available.');
        }

        const { error, success } = await claimFragmentCall(
          character.id,
          fragmentType,
        );

        if (error && !success) {
          throw new Error(error);
        }

        const info = getFragmentInfo(fragmentType);
        renderSuccess(`Fragment claimed: ${info?.name ?? 'Unknown'}`);
        setRefreshKey(k => k + 1);
      } catch (e) {
        renderError((e as Error)?.message ?? 'Failed to claim fragment.', e);
      } finally {
        setIsClaiming(false);
      }
    },
    [character, claimFragmentCall, renderError, renderSuccess],
  );

  const refreshFragments = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  const isLoading = !character;

  return (
    <FragmentContext.Provider
      value={{
        fragments,
        pendingEcho,
        isLoading,
        isClaiming,
        claimFragment,
        refreshFragments,
      }}
    >
      {children}
    </FragmentContext.Provider>
  );
};

export const useFragments = (): FragmentContextType =>
  useContext(FragmentContext);
