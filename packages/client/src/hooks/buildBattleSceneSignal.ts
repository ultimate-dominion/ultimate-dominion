import type { WeaponAnimType } from '../components/pretext/game/weaponAnimations';
import type { AttackOutcomeType } from '../utils/types';

import type { AttackSignal } from './useBattleSceneSignals';

type Params = {
  outcome: AttackOutcomeType;
  characterId: string;
  opponentName: string;
  weaponTypeForItem: (itemId: string) => WeaponAnimType;
};

function sumDamage(outcome: AttackOutcomeType) {
  return (outcome.damagePerHit ?? []).reduce((sum, d) => sum + Number(d), 0);
}

function buildCallout(
  outcome: AttackOutcomeType,
  isPlayerAttack: boolean,
  opponentName: string,
) {
  const misses = outcome.miss ?? [];
  const crits = outcome.crit ?? [];
  const totalDamage = sumDamage(outcome);
  const isMiss = misses.some(Boolean);
  const isCrit = crits.some(Boolean);

  if (isMiss) {
    return isPlayerAttack
      ? {
          title: 'MISS',
          detail: `You fail to hit ${opponentName}.`,
          tone: 'miss' as const,
        }
      : {
          title: 'DODGED',
          detail: `${opponentName} misses you.`,
          tone: 'enemy' as const,
        };
  }

  if (isPlayerAttack) {
    return {
      title: isCrit ? `CRIT ${totalDamage}` : `${totalDamage} DAMAGE`,
      detail: `You hit ${opponentName}${outcome.blocked ? ' through a block' : ''}.`,
      tone: isCrit ? ('crit' as const) : ('player' as const),
    };
  }

  return {
    title: isCrit ? `CRIT ${totalDamage}` : `${totalDamage} TAKEN`,
    detail: `${opponentName} hits you${outcome.blocked ? ' through your block' : ''}.`,
    tone: isCrit ? ('crit' as const) : ('enemy' as const),
  };
}

function buildSignal({
  outcome,
  characterId,
  opponentName,
  weaponTypeForItem,
  damage,
  isCrit,
  didHit,
  targetDied,
  isCombo,
  forceMiss = false,
}: Params & {
  damage: number;
  isCrit: boolean;
  didHit: boolean;
  targetDied: boolean;
  isCombo: boolean;
  forceMiss?: boolean;
}): AttackSignal {
  const isPlayerAttack =
    outcome.attackerId.toLowerCase() === characterId.toLowerCase();
  const normalizedOutcome = forceMiss
    ? {
        ...outcome,
        damagePerHit: [0n],
        hit: [false],
        miss: [true],
        crit: [false],
        defenderDied: false,
      }
    : {
        ...outcome,
        damagePerHit: [BigInt(damage)],
        hit: [didHit],
        miss: [!didHit],
        crit: [isCrit],
        defenderDied: targetDied,
      };

  return {
    weaponType: weaponTypeForItem(outcome.itemId),
    damage,
    isCrit,
    isPlayerAttack,
    didHit,
    targetDied,
    isCombo,
    callout: buildCallout(normalizedOutcome, isPlayerAttack, opponentName),
  };
}

export function buildBattleSceneSignals({
  outcome,
  characterId,
  opponentName,
  weaponTypeForItem,
}: Params): AttackSignal[] {
  const damagePerHit = outcome.damagePerHit ?? [];
  const hits = outcome.hit ?? [];
  const crits = outcome.crit ?? [];
  const misses = outcome.miss ?? [];
  const hitCount = Math.max(damagePerHit.length, hits.length, misses.length, 1);

  return Array.from({ length: hitCount }, (_, index) => {
    const damage = Number(damagePerHit[index] ?? 0n);
    const didHit =
      hits[index] === true ||
      damage > 0 ||
      (index === 0 && outcome.attackerDamageDelt > 0n);
    const isMiss = misses[index] === true || (!didHit && damage === 0);

    return buildSignal({
      outcome,
      characterId,
      opponentName,
      weaponTypeForItem,
      damage,
      isCrit: crits[index] === true,
      didHit: !isMiss,
      targetDied: outcome.defenderDied && index === hitCount - 1,
      isCombo: hitCount > 1 || outcome.doubleStrike,
      forceMiss: isMiss,
    });
  });
}

export function buildBattleSceneSignal(params: Params): AttackSignal {
  return buildBattleSceneSignals(params)[0];
}
