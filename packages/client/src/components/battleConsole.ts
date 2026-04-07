import { EncounterType } from '../utils/types';

export type BattleConsoleState = {
  eyebrow: string;
  title: string;
  detail: string;
  badge: string;
  badgeBg: string;
  badgeBorder: string;
  badgeColor: string;
};

type GetBattleConsoleStateArgs = {
  encounterType: EncounterType;
  opponentDisplayName: string;
  userTurn: boolean;
  canAttack: boolean;
  turnTimeLeft: number;
};

export function getBattleConsoleState({
  encounterType,
  opponentDisplayName,
  userTurn,
  canAttack,
  turnTimeLeft,
}: GetBattleConsoleStateArgs): BattleConsoleState {
  if (encounterType === EncounterType.PvE) {
    return {
      eyebrow: 'Battle Console',
      title: `Choose your move against ${opponentDisplayName}.`,
      detail: '',
      badge: '',
      badgeBg: '',
      badgeBorder: '',
      badgeColor: '',
    };
  }

  if (userTurn) {
    return {
      eyebrow: 'Battle Console',
      title: 'Your turn to strike.',
      detail: `Choose a move before the clock hits zero. ${turnTimeLeft}s remaining.`,
      badge: `${turnTimeLeft}s`,
      badgeBg: 'rgba(90,138,62,0.12)',
      badgeBorder: 'rgba(90,138,62,0.35)',
      badgeColor: '#8FCB6C',
    };
  }

  if (canAttack) {
    return {
      eyebrow: 'Battle Console',
      title: 'Counter window is open.',
      detail: 'Your opponent stalled. You can act now and steal the tempo.',
      badge: 'Counter',
      badgeBg: 'rgba(74,122,181,0.12)',
      badgeBorder: 'rgba(74,122,181,0.35)',
      badgeColor: '#7FB3F0',
    };
  }

  return {
    eyebrow: 'Battle Console',
    title: 'Enemy turn.',
    detail: `Hold position. If they burn the clock, you can attack in ${turnTimeLeft}s.`,
    badge: `${turnTimeLeft}s`,
    badgeBg: 'rgba(184,92,58,0.12)',
    badgeBorder: 'rgba(184,92,58,0.35)',
    badgeColor: '#D89272',
  };
}
