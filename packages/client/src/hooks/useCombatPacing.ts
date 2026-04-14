import { useEffect, useMemo, useRef, useState } from 'react';
import type { AttackOutcomeType } from '../utils/types';

const COUNTERATTACK_DELAY_MS = 600;
const FINISHER_DELAY_MS = 700;
const SAFETY_TIMEOUT_MS = 1500;

// `hiddenTurn` is derived SYNCHRONOUSLY during render from `revealedTurn` +
// `maxTurn` rather than set inside a useEffect. If we stored the hide state
// via useEffect, Render 1 would briefly return the full unfiltered list —
// and sibling effects (useBattleSceneSignals) would fire the counterattack
// signal during Render 1's commit phase, before Render 2 could filter it
// out. The result: the monster counterattack animation played at the same
// instant as the player attack, erasing the 600 ms delay. Render-time
// derivation guarantees the counterattack is filtered out on the very first
// render after `attackOutcomes` updates.
export function useCombatPacing({
  attackOutcomes,
  characterId,
  isInBattle,
}: {
  attackOutcomes: AttackOutcomeType[];
  characterId: string | undefined;
  isInBattle: boolean;
}): {
  visibleOutcomes: AttackOutcomeType[];
  isCounterattackPending: boolean;
  isBattleResolutionPending: boolean;
  pendingCounterattackDamage: bigint;
  pendingTurn: bigint | null;
} {
  const lastResolvedTurn = useRef<bigint>(0n);
  const delayTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finisherTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [revealedTurn, setRevealedTurn] = useState<bigint>(0n);
  const [finisherTurn, setFinisherTurn] = useState<bigint | null>(null);

  const maxTurn = useMemo(() => {
    if (attackOutcomes.length === 0) return 0n;
    return attackOutcomes.reduce(
      (max, outcome) => (outcome.currentTurn > max ? outcome.currentTurn : max),
      0n,
    );
  }, [attackOutcomes]);

  const counterattackForTurn = useMemo(() => {
    if (!characterId || maxTurn === 0n) return null;
    return (
      attackOutcomes.find(
        outcome =>
          outcome.currentTurn === maxTurn &&
          outcome.attackerId.toLowerCase() !== characterId.toLowerCase() &&
          outcome.attackerId.toLowerCase() !== outcome.defenderId.toLowerCase(),
      ) ?? null
    );
  }, [attackOutcomes, characterId, maxTurn]);

  // Check if the player's attack this turn killed the defender — suppress
  // counterattack entirely (the data exists in the TX but the monster is
  // dead; don't animate a ghost attack).
  const playerKilledDefender = useMemo(() => {
    if (!characterId || maxTurn === 0n) return false;
    return attackOutcomes.some(
      outcome =>
        outcome.currentTurn === maxTurn &&
        outcome.attackerId.toLowerCase() === characterId.toLowerCase() &&
        outcome.defenderDied,
    );
  }, [attackOutcomes, characterId, maxTurn]);

  // Synchronously decide whether the counterattack should be hidden on this
  // render. This happens during render (memo, not effect), so Render 1 sees
  // the filtered list — no flash of "both attacks fire at once".
  const hiddenTurn: bigint | null = useMemo(() => {
    if (!isInBattle || !counterattackForTurn) return null;
    if (playerKilledDefender) return maxTurn; // permanent hide
    if (revealedTurn >= maxTurn) return null;
    return maxTurn;
  }, [counterattackForTurn, isInBattle, maxTurn, playerKilledDefender, revealedTurn]);

  // Schedule the reveal timer. Only runs when there's actually a hidden
  // counterattack pending (and it isn't a permanent-hide from a kill).
  useEffect(() => {
    if (!isInBattle || !counterattackForTurn || playerKilledDefender) return;
    if (revealedTurn >= maxTurn) return;

    delayTimeout.current = setTimeout(() => {
      setRevealedTurn(maxTurn);
    }, COUNTERATTACK_DELAY_MS);

    safetyTimeout.current = setTimeout(() => {
      setRevealedTurn(maxTurn);
    }, SAFETY_TIMEOUT_MS);

    return () => {
      if (delayTimeout.current) clearTimeout(delayTimeout.current);
      if (safetyTimeout.current) clearTimeout(safetyTimeout.current);
    };
  }, [counterattackForTurn, isInBattle, maxTurn, playerKilledDefender, revealedTurn]);

  const visibleOutcomes = useMemo(() => {
    if (hiddenTurn === null || !characterId) return attackOutcomes;
    return attackOutcomes.filter(
      outcome =>
        !(
          outcome.currentTurn === hiddenTurn &&
          outcome.attackerId.toLowerCase() !== characterId.toLowerCase() &&
          outcome.attackerId.toLowerCase() !== outcome.defenderId.toLowerCase()
        ),
    );
  }, [attackOutcomes, characterId, hiddenTurn]);

  const visibleMaxTurn = useMemo(() => {
    if (visibleOutcomes.length === 0) return 0n;
    return visibleOutcomes.reduce(
      (max, outcome) => (outcome.currentTurn > max ? outcome.currentTurn : max),
      0n,
    );
  }, [visibleOutcomes]);

  const latestVisibleTurnIsLethal = useMemo(() => {
    if (visibleMaxTurn === 0n) return false;
    return visibleOutcomes.some(
      outcome =>
        outcome.currentTurn === visibleMaxTurn &&
        (outcome.attackerDied || outcome.defenderDied),
    );
  }, [visibleMaxTurn, visibleOutcomes]);

  useEffect(() => {
    if (!isInBattle || hiddenTurn !== null || visibleMaxTurn === 0n) return;
    if (visibleMaxTurn <= lastResolvedTurn.current) return;

    lastResolvedTurn.current = visibleMaxTurn;

    if (!latestVisibleTurnIsLethal) {
      setFinisherTurn(null);
      return;
    }

    setFinisherTurn(visibleMaxTurn);
    if (finisherTimeout.current) clearTimeout(finisherTimeout.current);
    finisherTimeout.current = setTimeout(() => {
      setFinisherTurn(current => (current === visibleMaxTurn ? null : current));
    }, FINISHER_DELAY_MS);
  }, [hiddenTurn, isInBattle, latestVisibleTurnIsLethal, visibleMaxTurn]);

  useEffect(() => {
    if (!isInBattle) {
      lastResolvedTurn.current = 0n;
      setRevealedTurn(0n);
      setFinisherTurn(null);
      if (delayTimeout.current) clearTimeout(delayTimeout.current);
      if (finisherTimeout.current) clearTimeout(finisherTimeout.current);
      if (safetyTimeout.current) clearTimeout(safetyTimeout.current);
    }
  }, [isInBattle]);

  useEffect(() => {
    return () => {
      if (delayTimeout.current) clearTimeout(delayTimeout.current);
      if (finisherTimeout.current) clearTimeout(finisherTimeout.current);
      if (safetyTimeout.current) clearTimeout(safetyTimeout.current);
    };
  }, []);

  const isCounterattackPending = hiddenTurn !== null && !playerKilledDefender;
  const isBattleResolutionPending =
    isCounterattackPending || finisherTurn !== null;

  const pendingCounterattackDamage = useMemo(() => {
    if (!isCounterattackPending || !counterattackForTurn) return 0n;
    return counterattackForTurn.attackerDamageDelt;
  }, [counterattackForTurn, isCounterattackPending]);

  return {
    visibleOutcomes,
    isCounterattackPending,
    isBattleResolutionPending,
    pendingCounterattackDamage,
    pendingTurn: isCounterattackPending ? hiddenTurn : null,
  };
}
