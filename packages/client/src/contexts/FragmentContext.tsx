import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { useToast } from '../hooks/useToast';
import { useTransaction } from '../hooks/useTransaction';
import {
  toBigInt,
  toNumber,
  useGameTable,
} from '../lib/gameStore';
import {
  TOTAL_FRAGMENTS,
} from '../utils/fragmentNarratives';

import { useCharacter } from './CharacterContext';
import { useMap } from './MapContext';
import { useMUD } from './MUDContext';
import { useGameAudio } from './SoundContext';

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
  const { t: tn } = useTranslation('narrative');
  const { renderSuccess } = useToast();
  const {
    systemCalls: { claimFragment: claimFragmentCall },
  } = useMUD();
  const { character } = useCharacter();
  const { position } = useMap();
  const { playSfx } = useGameAudio();

  const claimTx = useTransaction({ actionName: 'claim fragment', showSuccessToast: false });
  const previousPendingEchoRef = useRef<FragmentStatus | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  // Optimistic: track recently claimed fragment types so pendingEcho clears
  // immediately without waiting for the store splice event.
  const [claimedTypes, setClaimedTypes] = useState<Set<number>>(new Set());

  // All rows from the FragmentProgress table, keyed by keyBytes.
  // Each keyBytes is the ABI-encoded composite key: characterId (32 bytes) + fragmentType (32 bytes).
  const fragmentProgressTable = useGameTable('FragmentProgress');

  // Filter to only this character's rows.
  // The keyBytes format is: 0x + characterId (64 hex chars) + fragmentType (64 hex chars).
  // Matching on the first 66 chars (0x + 64 hex = 66 chars) mirrors the old RECS entity check.
  const characterKeyPrefix = useMemo(() => {
    if (!character?.id) return null;
    // character.id is already a 0x-prefixed address (20 bytes = 40 hex chars).
    // In the composite key it is left-padded to 32 bytes (64 hex chars).
    const clean = character.id.startsWith('0x') ? character.id.slice(2) : character.id;
    return '0x' + clean.toLowerCase().padStart(64, '0');
  }, [character?.id]);

  const fragments = useMemo(() => {
    // refreshKey is intentionally referenced here so that refreshFragments()
    // triggers a re-evaluation even when the table data itself has not changed.
    void refreshKey;

    if (!character || !characterKeyPrefix) {
      return [];
    }

    const fragmentStatuses: FragmentStatus[] = [];

    for (let i = 1; i <= TOTAL_FRAGMENTS; i++) {

      // Locate the row whose keyBytes starts with this character's padded id and
      // whose second 32-byte segment encodes the current fragment type.
      // keyBytes = 0x + <characterId 64 chars> + <fragmentType 64 chars>
      const matchingKey = Object.keys(fragmentProgressTable).find(keyBytes => {
        if (!keyBytes.toLowerCase().startsWith(characterKeyPrefix.toLowerCase())) return false;
        const fragmentTypeHex = keyBytes.slice(-64);
        const entityFragmentType = parseInt(fragmentTypeHex, 16);
        return entityFragmentType === i;
      });

      const progress = matchingKey ? fragmentProgressTable[matchingKey] : null;

      fragmentStatuses.push({
        fragmentType: i,
        name: tn(`${i}.name`),
        narrative: tn(`${i}.narrative`),
        hint: tn(`${i}.hint`),
        triggered: progress ? Boolean(progress.triggered) : false,
        triggeredAt: progress ? toNumber(progress.triggeredAt) : 0,
        triggerTileX: progress ? toNumber(progress.triggerTileX) : 0,
        triggerTileY: progress ? toNumber(progress.triggerTileY) : 0,
        claimed: progress ? Boolean(progress.claimed) : false,
        claimedAt: progress ? toNumber(progress.claimedAt) : 0,
        tokenId: progress ? toBigInt(progress.tokenId) : BigInt(0),
      });
    }

    return fragmentStatuses;
  }, [character, characterKeyPrefix, fragmentProgressTable, refreshKey, tn]);

  // Check if there's a pending echo on the current tile.
  const pendingEcho = useMemo(() => {
    if (!position) return null;

    return fragments.find(
      f =>
        f.triggered &&
        !f.claimed &&
        !claimedTypes.has(f.fragmentType) &&
        f.triggerTileX === position.x &&
        f.triggerTileY === position.y,
    ) ?? null;
  }, [fragments, position, claimedTypes]);

  useEffect(() => {
    if (pendingEcho && !previousPendingEchoRef.current) {
      playSfx('fragment-trigger');
    }
    previousPendingEchoRef.current = pendingEcho;
  }, [pendingEcho, playSfx]);

  const claimFragment = useCallback(
    async (fragmentType: number) => {
      if (!character) return;
      if (!claimFragmentCall) return;

      const result = await claimTx.execute(async () => {
        const { error, success } = await claimFragmentCall(
          character.id,
          fragmentType,
        );
        if (error && !success) throw new Error(error);
        return true;
      });

      if (result !== undefined) {
        playSfx('fragment-claim');
        renderSuccess(`Fragment claimed: ${tn(`${fragmentType}.name`)}`);

        setClaimedTypes(prev => new Set(prev).add(fragmentType));
        setRefreshKey(k => k + 1);
      }
    },
    [character, claimFragmentCall, claimTx, playSfx, renderSuccess, tn],
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
        isClaiming: claimTx.isLoading,
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
