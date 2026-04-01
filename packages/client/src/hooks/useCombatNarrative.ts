import { useMemo } from 'react';
import {
  type AttackOutcomeType,
  type Consumable,
  type DotAction,
  EncounterType,
  type Monster,
  type StatusAction,
} from '../utils/types';
import { STATUS_EFFECT_NAME_MAPPING } from '../utils/constants';
import { removeEmoji } from '../utils/helpers';
import type { NarrativeSegment } from '../components/pretext/game/CombatTypewriter';

type NarrativeResult = {
  segments: NarrativeSegment[];
  isEnemyAttack: boolean;
  /** Key that changes when the narrative content changes */
  key: string;
};

type Params = {
  visibleOutcomes: AttackOutcomeType[];
  pendingTurn: bigint | null;
  dotActions: DotAction[];
  statusEffectActions: StatusAction[];
  characterId: string | undefined;
  opponentName: string;
  opponent: Monster | null;
  encounterType: EncounterType | undefined;
  spellAndWeaponTemplates: Array<{ tokenId: string; name: string }>;
  combatConsumables: Consumable[];
};

/**
 * Builds narrative segments for the LATEST combat outcome.
 * Covers all edge cases: attacks, crits, misses, consumable self-use,
 * status effects, DoT, double strike, blocked, spell dodged.
 */
export function useCombatNarrative({
  visibleOutcomes,
  pendingTurn,
  dotActions,
  statusEffectActions,
  characterId,
  opponentName,
  opponent,
  encounterType,
  spellAndWeaponTemplates,
  combatConsumables,
}: Params): NarrativeResult | null {
  return useMemo(() => {
    if (visibleOutcomes.length === 0 || !characterId) return null;

    const attack = visibleOutcomes[visibleOutcomes.length - 1];
    const isPlayerAttack = attack.attackerId === characterId;

    // Resolve item name
    const attackItem = spellAndWeaponTemplates.find(t => t.tokenId === attack.itemId);
    const itemName =
      encounterType === EncounterType.PvE && !isPlayerAttack && opponent
        ? (opponent.name || 'an item')
        : attackItem
          ? removeEmoji(attackItem.name)
          : 'an item';

    // Status effect for this turn
    const outcomeIndex = visibleOutcomes.length - 1;
    const statusEffect = statusEffectActions.find(
      se => Number(se.turnStart) - 1 === outcomeIndex,
    );

    // Effect names on this attack
    const effectNames = attack.effectIds
      .map(id => STATUS_EFFECT_NAME_MAPPING[id.padEnd(66, '0')])
      .filter(Boolean);

    const alreadyAffected = attack.effectIds.some(eid =>
      statusEffectActions.some(se => se.effectId === eid),
    );

    const isCrit = attack.crit[0];
    const isSelfUse = attack.attackerId.toLowerCase() === attack.defenderId.toLowerCase();
    const segments: NarrativeSegment[] = [];

    // --- Consumable self-use ---
    if (isSelfUse) {
      const consumable = combatConsumables.find(c => c.tokenId === attack.itemId);
      const isPlayer = attack.attackerId.toLowerCase() === characterId.toLowerCase();
      const who = isPlayer ? 'You' : opponentName;
      segments.push(
        { text: `${who} used ` },
        { text: consumable ? removeEmoji(consumable.name) : 'a potion', color: '#5A8A3E', bold: true },
        { text: '.' },
      );
      if (isPlayer && consumable?.hpRestoreAmount) {
        segments.push(
          { text: ' Restored ' },
          { text: consumable.hpRestoreAmount.toString(), color: '#5A8A3E', mono: true },
          { text: ' HP.' },
        );
      }
      return {
        segments,
        isEnemyAttack: false,
        key: `${attack.encounterId}-${attack.attackNumber}-self`,
      };
    }

    // --- Miss ---
    if (attack.miss[0]) {
      if (isPlayerAttack) {
        segments.push(
          { text: 'You missed ', italic: true, color: '#5A5248' },
          { text: opponentName, italic: true, color: '#5A5248' },
          { text: ` with ${itemName}.`, italic: true, color: '#5A5248' },
        );
      } else {
        segments.push(
          { text: opponentName, italic: true, color: '#5A5248' },
          { text: ` missed you with ${itemName}.`, italic: true, color: '#5A5248' },
        );
      }
      appendDot(segments, attack, dotActions, pendingTurn, characterId, opponentName);
      return {
        segments,
        isEnemyAttack: !isPlayerAttack,
        key: `${attack.encounterId}-${attack.attackNumber}-miss`,
      };
    }

    // --- Crit prefix ---
    if (isCrit) {
      segments.push({ text: 'Critical hit! ', color: '#C87A2A', bold: true });
    }

    // --- Status effect attack ---
    if (statusEffect) {
      const isSelfBuff = isPlayerAttack
        ? statusEffect.victimId === characterId
        : statusEffect.victimId === opponent?.id;
      const effectColor = isPlayerAttack
        ? (isSelfBuff ? '#A8DEFF' : '#D08040')
        : (isSelfBuff ? '#D08040' : '#A8DEFF');

      if (isPlayerAttack) {
        segments.push({ text: `You cast ${itemName}` });
        if (!isSelfBuff) {
          segments.push({ text: ' on ' }, { text: opponentName, color: '#5A8A3E' });
        }
      } else {
        segments.push({ text: opponentName, color: '#5A8A3E' }, { text: ` cast ${itemName}` });
      }
      segments.push({ text: '. ' });

      // Affected text
      const affectedTarget = isPlayerAttack
        ? (isSelfBuff ? 'You are' : `${opponentName} is`)
        : (isSelfBuff ? `${opponentName} is` : 'You are');
      segments.push({
        text: `${affectedTarget} affected by ${statusEffect.name}.`,
        color: effectColor,
      });

    // --- Status effect only (no damage, new effect) ---
    } else if (attack.attackerDamageDelt === 0n && attack.effectIds.length > 0 && !alreadyAffected) {
      if (isPlayerAttack) {
        segments.push(
          { text: 'You cast ' },
          { text: itemName },
          { text: ' on ' },
          { text: opponentName, color: '#5A8A3E' },
          { text: '.' },
        );
      } else {
        segments.push(
          { text: opponentName, color: '#5A8A3E' },
          { text: ` cast ${itemName} on you.` },
        );
      }
      if (effectNames[0]) {
        segments.push({ text: ` ${effectNames[0]}.`, color: '#D08040' });
      }

    // --- Already affected ---
    } else if (alreadyAffected) {
      if (isPlayerAttack) {
        segments.push(
          { text: 'You cast ' },
          { text: itemName },
          { text: ' on ' },
          { text: opponentName, color: '#5A8A3E' },
          { text: '. ' },
        );
      } else {
        segments.push(
          { text: opponentName, color: '#5A8A3E' },
          { text: ` cast ${itemName} on you. ` },
        );
      }
      segments.push({
        text: effectNames[0] ? `${effectNames[0]} is already active.` : 'No effect.',
        color: '#5A5248',
        italic: true,
      });

    // --- Regular attack ---
    } else if (isPlayerAttack) {
      segments.push(
        { text: 'You attacked ' },
        { text: opponentName, color: '#5A8A3E' },
        { text: ` with ${itemName} for ` },
        { text: attack.attackerDamageDelt.toString(), color: '#D4A54A', mono: true, bold: isCrit },
        { text: ' damage.' },
      );
    } else {
      segments.push(
        { text: opponentName, color: '#5A8A3E' },
        { text: ` attacked you with ${itemName} for ` },
        { text: attack.attackerDamageDelt.toString(), color: '#B85C3A', mono: true, bold: isCrit },
        { text: ' damage.' },
      );
    }

    // --- Badges ---
    if (attack.doubleStrike) {
      segments.push({ text: ' Double Strike!', color: '#A8DEFF', bold: true });
    }
    if (attack.blocked) {
      const blockedText = isPlayerAttack
        ? ` ${opponentName} blocked some damage!`
        : ' You blocked some damage!';
      segments.push({ text: blockedText, color: '#8B8B8B', bold: true });
    }
    if (attack.spellDodged) {
      const dodgeText = isPlayerAttack
        ? ` ${opponentName} dodged the spell!`
        : ' You dodged the spell!';
      segments.push({ text: dodgeText, color: '#A8DEFF', bold: true });
    }

    // --- DoT ---
    appendDot(segments, attack, dotActions, pendingTurn, characterId, opponentName);

    return {
      segments,
      isEnemyAttack: !isPlayerAttack,
      key: `${attack.encounterId}-${attack.attackNumber}-${attack.currentTurn}`,
    };
  }, [
    visibleOutcomes,
    pendingTurn,
    dotActions,
    statusEffectActions,
    characterId,
    opponentName,
    opponent,
    encounterType,
    spellAndWeaponTemplates,
    combatConsumables,
  ]);
}

function appendDot(
  segments: NarrativeSegment[],
  attack: AttackOutcomeType,
  dotActions: DotAction[],
  pendingTurn: bigint | null,
  characterId: string,
  opponentName: string,
) {
  if (pendingTurn && attack.currentTurn === pendingTurn) return;
  const dot = dotActions.find(
    d => d.turnNumber === attack.currentTurn && d.totalDamage > 0n,
  );
  if (!dot) return;

  const target =
    dot.entityId.toLowerCase() === characterId.toLowerCase() ? 'you' : opponentName;
  segments.push(
    { text: ' Poison deals ', italic: true, color: '#B794F6' },
    { text: dot.totalDamage.toString(), mono: true, color: '#B794F6' },
    { text: ` damage to ${target}.`, italic: true, color: '#B794F6' },
  );
}
