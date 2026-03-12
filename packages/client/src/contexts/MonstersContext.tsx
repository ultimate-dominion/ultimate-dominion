import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';

import { useGameTable, decodeUint256FromKey, toNumber } from '../lib/gameStore';
import { useToast } from '../hooks/useToast';
import {
  decodeMonsterStats,
  fetchMetadataFromUri,
  isTextOnlyUri,
  uriToHttp,
} from '../utils/helpers';
import { MobType, type MonsterTemplate } from '../utils/types';

type MonstersContextType = {
  monsterTemplates: MonsterTemplate[];
  isLoading: boolean;
};

const MonstersContext = createContext<MonstersContextType>({
  monsterTemplates: [],
  isLoading: false,
});

export const MonstersProvider = ({
  children,
}: {
  children: ReactNode;
}): JSX.Element => {
  const { renderError } = useToast();
  const mobsTable = useGameTable('Mobs');

  const [monsterTemplates, setMonsterTemplates] = useState<MonsterTemplate[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const entries = Object.entries(mobsTable);

    // Wait until the store has data before processing
    if (entries.length === 0) return;

    (async () => {
      try {
        const monsterEntries = entries.filter(
          ([, row]) => toNumber(row.mobType) === MobType.Monster,
        );

        const templates: MonsterTemplate[] = await Promise.all(
          monsterEntries.map(async ([keyBytes, row]) => {
            const mobId = decodeUint256FromKey(keyBytes, 0);

            const metadataURI = typeof row.mobMetadata === 'string' ? row.mobMetadata : '';
            const mobStatsBytes = typeof row.mobStats === 'string' ? row.mobStats : '0x';

            const monsterStats = decodeMonsterStats(mobStatsBytes);

            let fetchedMetadata = {
              name: `Monster #${mobId}`,
              description: '',
              image: '',
            };
            try {
              if (metadataURI && metadataURI.trim() !== '') {
                if (isTextOnlyUri(metadataURI)) {
                  fetchedMetadata = await fetchMetadataFromUri(metadataURI);
                } else {
                  const urls = uriToHttp(metadataURI);
                  if (urls.length > 0) {
                    fetchedMetadata = await fetchMetadataFromUri(urls[0]);
                  }
                }
              }
            } catch (e) {
              console.warn(`Failed to fetch metadata for monster ${mobId}:`, e);
            }

            return {
              agility: monsterStats.agility,
              armor: monsterStats.armor,
              entityClass: monsterStats.entityClass,
              experience: monsterStats.experience,
              hasBossAI: monsterStats.hasBossAI,
              hitPoints: monsterStats.hitPoints,
              intelligence: monsterStats.intelligence,
              inventory: monsterStats.inventory,
              level: monsterStats.level,
              mobId: mobId.toString(),
              strength: monsterStats.strength,
              ...fetchedMetadata,
            } as MonsterTemplate;
          }),
        );

        setMonsterTemplates(templates);
      } catch (e) {
        renderError(
          (e as Error)?.message ?? 'Failed to fetch monster templates.',
          e,
        );
      } finally {
        setIsLoading(false);
      }
    })();
    // mobsTable reference changes when data arrives; we only want to run once
    // when the table is populated. Using entries.length as a proxy isn't
    // reactive-safe here because we depend on mobsTable, but we don't want to
    // re-run on every subsequent live update (monsters are seed data).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobsTable]);

  return (
    <MonstersContext.Provider
      value={{
        monsterTemplates,
        isLoading,
      }}
    >
      {children}
    </MonstersContext.Provider>
  );
};

export const useMonsters = (): MonstersContextType =>
  useContext(MonstersContext);
