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

export function buildBattleSceneSignal({
  outcome,
  characterId,
  opponentName,
  weaponTypeForItem,
}: Params): AttackSignal {
  const isPlayerAttack =
    outcome.attackerId.toLowerCase() === characterId.toLowerCase();
  const damagePerHit = outcome.damagePerHit ?? [];
  const hits = outcome.hit ?? [];
  const didHit =
    hits.some(Boolean) ||
    damagePerHit.some(d => d > 0n) ||
    outcome.attackerDamageDelt > 0n;

  return {
    weaponType: weaponTypeForItem(outcome.itemId),
    damage: sumDamage(outcome),
    isCrit: (outcome.crit ?? []).some(Boolean),
    isPlayerAttack,
    didHit,
    targetDied: outcome.defenderDied,
    callout: buildCallout(outcome, isPlayerAttack, opponentName),
  };
}
