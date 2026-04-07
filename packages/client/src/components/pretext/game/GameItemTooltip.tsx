import { useCallback, useMemo } from 'react';
import { Box } from '@chakra-ui/react';
import { useCanvas } from '../hooks/useCanvas';
import { usePretextFonts } from '../hooks/usePretextFonts';
import { COLORS } from '../theme';
import {
  type Weapon,
  type Spell,
  ItemType,
  Rarity,
  RARITY_COLORS,
  RARITY_NAMES,
  StatsClasses,
} from '../../../utils/types';
import { STATUS_EFFECT_NAME_MAPPING } from '../../../utils/constants';
import { removeEmoji } from '../../../utils/helpers';

const TOOLTIP_W = 220;
const PAD = 12;

const CLASS_LABELS: Record<StatsClasses, string> = {
  [StatsClasses.Strength]: 'Strength',
  [StatsClasses.Agility]: 'Agility',
  [StatsClasses.Intelligence]: 'Intelligence',
};

const CLASS_COLORS: Record<StatsClasses, string> = {
  [StatsClasses.Strength]: '#B85C3A',
  [StatsClasses.Agility]: '#5A8A3E',
  [StatsClasses.Intelligence]: '#4A7AB5',
};

type StatLine = { label: string; value: string; color: string };

function resolveEffectNames(effects: string[]): string[] {
  return effects
    .map(id => {
      const padded = id.padEnd(66, '0');
      return STATUS_EFFECT_NAME_MAPPING[padded];
    })
    .filter((n): n is string => !!n);
}

function getStatModifiers(item: Weapon | Spell): StatLine[] {
  if (item.itemType !== ItemType.Weapon) return [];
  const w = item as Weapon;
  const lines: StatLine[] = [];
  const str = Number(w.strModifier);
  const agi = Number(w.agiModifier);
  const int = Number(w.intModifier);
  const hp = Number(w.hpModifier);
  if (str !== 0) lines.push({ label: 'STR', value: str > 0 ? `+${str}` : `${str}`, color: CLASS_COLORS[StatsClasses.Strength] });
  if (agi !== 0) lines.push({ label: 'AGI', value: agi > 0 ? `+${agi}` : `${agi}`, color: CLASS_COLORS[StatsClasses.Agility] });
  if (int !== 0) lines.push({ label: 'INT', value: int > 0 ? `+${int}` : `${int}`, color: CLASS_COLORS[StatsClasses.Intelligence] });
  if (hp !== 0) lines.push({ label: 'HP', value: hp > 0 ? `+${hp}` : `${hp}`, color: COLORS.success });
  return lines;
}

type Props = {
  item: Weapon | Spell;
  matchup?: 'strong' | 'weak' | 'neutral';
  opponentClass?: StatsClasses;
};

export function GameItemTooltip({ item, matchup, opponentClass }: Props) {
  const { ready } = usePretextFonts();

  const itemName = removeEmoji(item.name);
  const rarityNum = item.rarity ?? Rarity.Common;
  const rColor = RARITY_COLORS[rarityNum] ?? COLORS.textBody;
  const rName = RARITY_NAMES[rarityNum] ?? 'Common';
  const typeName = item.itemType === ItemType.Spell ? 'SPELL' : 'WEAPON';
  const minDmg = Number(item.minDamage);
  const maxDmg = Number(item.maxDamage);
  const dmgText = minDmg === maxDmg ? `${minDmg}` : `${minDmg}\u2013${maxDmg}`;
  const statMods = useMemo(() => getStatModifiers(item), [item]);
  const effectNames = useMemo(() => resolveEffectNames(item.effects), [item.effects]);
  const opponentClassName = opponentClass !== undefined ? CLASS_LABELS[opponentClass] : undefined;
  const showMatchup = matchup && matchup !== 'neutral' && opponentClassName;

  const tooltipHeight = useMemo(() => {
    let h = PAD;
    h += 16; // type label
    h += 22; // name
    h += 8;  // divider gap
    h += 18; // damage
    h += statMods.length * 18;
    if (effectNames.length > 0) {
      h += 4 + effectNames.length * 16;
    }
    if (showMatchup) {
      h += 10 + 16;
    }
    h += PAD;
    return h;
  }, [statMods.length, effectNames.length, showMatchup]);

  const onFrame = useCallback(
    (ctx: CanvasRenderingContext2D, _dt: number, elapsed: number) => {
      const rect = ctx.canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      const w = TOOLTIP_W;
      const h = tooltipHeight;

      // --- Background ---
      ctx.fillStyle = COLORS.bgCard;
      ctx.beginPath();
      ctx.roundRect(0, 0, w, h, 4);
      ctx.fill();

      // --- Rarity border (breathing) ---
      ctx.strokeStyle = rColor;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5 + Math.sin(elapsed / 1200) * 0.15;
      ctx.beginPath();
      ctx.roundRect(0.5, 0.5, w - 1, h - 1, 4);
      ctx.stroke();

      // --- Outer glow ---
      ctx.save();
      ctx.shadowColor = rColor;
      ctx.shadowBlur = 6 + Math.sin(elapsed / 900) * 3;
      ctx.globalAlpha = 0.15;
      ctx.beginPath();
      ctx.roundRect(0.5, 0.5, w - 1, h - 1, 4);
      ctx.stroke();
      ctx.restore();

      ctx.globalAlpha = 1;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      let y = PAD;

      // --- Type label ---
      ctx.font = '500 10px "Fira Code"';
      ctx.fillStyle = rColor;
      ctx.globalAlpha = 0.7;
      ctx.fillText(typeName.toUpperCase(), PAD, y);
      ctx.globalAlpha = 1;
      y += 16;

      // --- Item name ---
      ctx.font = '700 15px Cinzel';
      ctx.fillStyle = rColor;
      ctx.fillText(itemName, PAD, y);
      y += 22;

      // --- Divider ---
      ctx.fillStyle = COLORS.border;
      ctx.fillRect(PAD, y, w - PAD * 2, 1);
      y += 8;

      // --- Damage ---
      ctx.font = '500 12px "Fira Code"';
      ctx.fillStyle = COLORS.textMuted;
      ctx.fillText('DMG', PAD, y);
      ctx.fillStyle = COLORS.amber;
      ctx.textAlign = 'right';
      ctx.fillText(dmgText, w - PAD, y);
      ctx.textAlign = 'left';
      y += 18;

      // --- Stat modifiers ---
      for (const stat of statMods) {
        ctx.font = '500 12px "Fira Code"';
        ctx.fillStyle = COLORS.textMuted;
        ctx.fillText(stat.label, PAD, y);
        ctx.fillStyle = stat.color;
        ctx.textAlign = 'right';
        ctx.fillText(stat.value, w - PAD, y);
        ctx.textAlign = 'left';
        y += 18;
      }

      // --- Effects ---
      if (effectNames.length > 0) {
        y += 4;
        ctx.font = 'italic 400 13px "Cormorant Garamond"';
        for (const effect of effectNames) {
          ctx.fillStyle = '#9B8EC4';
          ctx.fillText(`\u25C6 ${effect}`, PAD, y);
          y += 16;
        }
      }

      // --- Matchup ---
      if (showMatchup) {
        ctx.fillStyle = COLORS.border;
        ctx.fillRect(PAD, y + 2, w - PAD * 2, 1);
        y += 10;
        ctx.font = '500 11px "Fira Code"';
        if (matchup === 'strong') {
          ctx.fillStyle = '#5A8A3E';
          ctx.fillText(`\u25B2 Strong vs ${opponentClassName}`, PAD, y);
        } else {
          ctx.fillStyle = '#B85C3A';
          ctx.fillText(`\u25BC Weak vs ${opponentClassName}`, PAD, y);
        }
      }
    },
    [tooltipHeight, rColor, rName, typeName, itemName, dmgText, statMods, effectNames, showMatchup, matchup, opponentClassName],
  );

  const { canvasRef } = useCanvas({ onFrame });

  if (!ready) return null;

  return (
    <Box w={`${TOOLTIP_W}px`} h={`${tooltipHeight}px`}>
      <canvas
        ref={canvasRef as React.LegacyRef<HTMLCanvasElement>}
        style={{ display: 'block', width: '100%', height: '100%' }}
        aria-label={`${rName} ${typeName}: ${itemName}, damage ${dmgText}`}
      />
    </Box>
  );
}
