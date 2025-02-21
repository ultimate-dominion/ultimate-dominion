import {
  getComponentValueStrict,
  Has,
  HasValue,
  runQuery,
} from '@latticexyz/recs';
import { decodeEntity, encodeEntity } from '@latticexyz/store-sync/recs';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import { useToast } from '../hooks/useToast';
import {
  decodeMonsterStats,
  fetchMetadataFromUri,
  uriToHttp,
} from '../utils/helpers';
import { MobType, type MonsterTemplate } from '../utils/types';

import { useMUD } from './MUDContext';

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
  const {
    components: { Mobs },
    isSynced,
  } = useMUD();

  const [monsterTemplates, setMonsterTemplates] = useState<MonsterTemplate[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchMonsterTemplates = useCallback(
    async (allMonsterMobIds: bigint[]): Promise<MonsterTemplate[]> => {
      const _monsterTemplates: MonsterTemplate[] = await Promise.all(
        allMonsterMobIds.map(async mobId => {
          const mobData = getComponentValueStrict(
            Mobs,
            encodeEntity({ mobId: 'uint256' }, { mobId: BigInt(mobId) }),
          );

          const { mobMetadata: metadataURI, mobStats } = mobData;

          const monsterStats = decodeMonsterStats(mobStats);
          const fetachedMetadata = await fetchMetadataFromUri(
            uriToHttp(metadataURI)[0],
          );

          return {
            agility: monsterStats.agility,
            armor: monsterStats.armor,
            entityClass: monsterStats.entityClass,
            experience: monsterStats.experience,
            hitPoints: monsterStats.hitPoints,
            intelligence: monsterStats.intelligence,
            inventory: monsterStats.inventory,
            level: monsterStats.level,
            mobId: mobId.toString(),
            strength: monsterStats.strength,
            ...fetachedMetadata,
          } as MonsterTemplate;
        }),
      );

      return _monsterTemplates;
    },
    [Mobs],
  );

  useEffect(() => {
    (async () => {
      if (!isSynced) return;

      try {
        const allMonsterMobIds = Array.from(
          runQuery([Has(Mobs), HasValue(Mobs, { mobType: MobType.Monster })]),
        ).map(entity => {
          const { mobId } = decodeEntity({ mobId: 'uint256' }, entity);
          return mobId;
        });

        if (allMonsterMobIds.length > 0) {
          const _monsterTemplates =
            await fetchMonsterTemplates(allMonsterMobIds);
          setMonsterTemplates(_monsterTemplates);
        }
      } catch (e) {
        renderError(
          (e as Error)?.message ?? 'Failed to fetch monster templates.',
          e,
        );
      } finally {
        setIsLoading(false);
      }
    })();
  }, [fetchMonsterTemplates, isSynced, Mobs, renderError]);

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
