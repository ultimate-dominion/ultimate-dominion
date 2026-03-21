import { hexToString, zeroHash } from 'viem';

import { getTableValue, toBigInt, toNumber } from '../lib/gameStore';
import { STATUS_EFFECT_NAME_MAPPING } from './constants';
import {
  decodeAppliedStatusEffectId,
  decodeBaseStats,
} from './helpers';
import {
  AdvancedClass,
  type Character,
  getDominantStatClass,
  type Metadata,
  type WorldStatusEffect,
} from './types';

/**
 * Pure function that builds a Character from reactive table row data.
 * Shared by MapContext (allCharacters useMemo) and useReactiveEntity.
 *
 * Status effect definition lookups (StatusEffectStats, StatusEffectValidity) use
 * getTableValue intentionally — those are static deploy-time definitions that
 * never change at runtime.
 */
export function buildCharacter(
  entity: string,
  characterData: Record<string, unknown>,
  statsData: Record<string, unknown>,
  goldData: Record<string, unknown> | undefined,
  encounterData: Record<string, unknown> | undefined,
  posData: Record<string, unknown> | undefined,
  spawnedData: Record<string, unknown> | undefined,
  metadata: Metadata | null,
  effectsData: Record<string, unknown> | undefined,
): Character {
  const externalGoldBalance = goldData
    ? toBigInt(goldData.value)
    : BigInt(0);

  const encounterId = encounterData?.encounterId ?? zeroHash;
  const pvpTimer = encounterData?.pvpTimer ?? BigInt(0);
  const inBattle = !!encounterId && encounterId !== zeroHash;

  const isEntitySpawned = Boolean(spawnedData?.spawned ?? false);
  const positionData = posData ?? { x: 0, y: 0 };

  let decodedBaseStats = {
    agility: BigInt(0),
    currentHp: BigInt(0),
    entityClass: 0,
    experience: BigInt(0),
    intelligence: BigInt(0),
    level: BigInt(0),
    maxHp: BigInt(0),
    strength: BigInt(0),
  };

  const baseStatsRaw = characterData.baseStats as string | undefined;
  if (baseStatsRaw && baseStatsRaw !== '0x') {
    decodedBaseStats = decodeBaseStats(baseStatsRaw);
  }

  // Status effects
  const { appliedStatusEffects } = effectsData ?? {
    appliedStatusEffects: [],
  };

  const rawEffects = Array.isArray(appliedStatusEffects)
    ? (appliedStatusEffects as string[])
    : [];
  const decodedStatusEffects = rawEffects.map(decodeAppliedStatusEffectId);

  const worldStatusEffects: WorldStatusEffect[] = decodedStatusEffects
    .map(effect => {
      const paddedEffectId = effect.effectId.padEnd(66, '0');
      // Static definition data — getTableValue is fine here
      const effectStats = getTableValue('StatusEffectStats', paddedEffectId);
      const validity = getTableValue('StatusEffectValidity', paddedEffectId);

      if (!effectStats || !validity) return null;

      const timestampEnd = toBigInt(effect.timestamp) + toBigInt(validity.validTime);
      const isActive =
        timestampEnd > BigInt(Date.now()) / BigInt(1000);

      const name =
        STATUS_EFFECT_NAME_MAPPING[paddedEffectId] ?? 'unknown';

      return {
        active: isActive,
        agiModifier: toBigInt(effectStats.agiModifier),
        effectId: paddedEffectId,
        intModifier: toBigInt(effectStats.intModifier),
        maxStacks: toBigInt(validity.maxStacks),
        name,
        strModifier: toBigInt(effectStats.strModifier),
        timestampEnd,
        timestampStart: toBigInt(effect.timestamp),
      };
    })
    .filter((effect): effect is WorldStatusEffect => effect !== null);

  const metadataFallback = metadata ?? { name: '', description: '', image: '' };

  // On-chain name is authoritative; IPFS metadata name is a fallback
  const onChainName = hexToString(characterData.name as `0x${string}`, { size: 32 });
  const name = onChainName || metadataFallback.name;

  return {
    ...metadataFallback,
    name,
    advancedClass: (toNumber(statsData.advancedClass) as AdvancedClass) ?? AdvancedClass.None,
    agility: toBigInt(statsData.agility),
    baseStats: decodedBaseStats as any,
    currentHp: toBigInt(statsData.currentHp),
    entityClass: getDominantStatClass(
      toBigInt(statsData.strength),
      toBigInt(statsData.agility),
      toBigInt(statsData.intelligence),
    ),
    experience: toBigInt(statsData.experience),
    hasSelectedAdvancedClass: Boolean(statsData.hasSelectedAdvancedClass),
    externalGoldBalance,
    id: entity,
    inBattle,
    intelligence: toBigInt(statsData.intelligence),
    isSpawned: isEntitySpawned,
    level: toBigInt(statsData.level),
    locked: Boolean(characterData.locked),
    maxHp: toBigInt(statsData.maxHp),
    owner: characterData.owner as string,
    position: {
      x: toNumber((positionData as any).x),
      y: toNumber((positionData as any).y),
    },
    pvpCooldownTimer: toBigInt(pvpTimer),
    strength: toBigInt(statsData.strength),
    tokenId: characterData.tokenId?.toString() ?? '0',
    worldStatusEffects,
  };
}
