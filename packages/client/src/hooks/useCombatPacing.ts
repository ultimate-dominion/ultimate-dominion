import { useEffect, useMemo, useRef, useState } from 'react';
import type { AttackOutcomeType } from '../utils/types';

const COUNTERATTACK_DELAY_MS = 600;
const SAFETY_TIMEOUT_MS = 1500;

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
  pendingCounterattackDamage: bigint;
  pendingTurn: bigint | null;
} {
  const lastRevealedTurn = useRef<bigint>(0n);
  const delayTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hiddenTurn, setHiddenTurn] = useState<bigint | null>(null);

  // Find the max turn across all outcomes
  const maxTurn = useMemo(() => {
    if (attackOutcomes.length === 0) return 0n;
    return attackOutcomes.reduce(
      (max, a) => (a.currentTurn > max ? a.currentTurn : max),
      0n,
    );
  }, [attackOutcomes]);

  // Identify the counterattack for a given turn:
  // an outcome where the attacker is NOT the player (and not self-use)
  const counterattackForTurn = useMemo(() => {
    if (!characterId || maxTurn === 0n) return null;
    return (
      attackOutcomes.find(
        a =>
          a.currentTurn === maxTurn &&
          a.attackerId.toLowerCase() !== characterId.toLowerCase() &&
          a.attackerId.toLowerCase() !== a.defenderId.toLowerCase(),
      ) ?? null
    );
  }, [attackOutcomes, characterId, maxTurn]);

  // Trigger delay when a new turn arrives with a counterattack
  useEffect(() => {
    if (!isInBattle || maxTurn === 0n) return;
    if (maxTurn <= lastRevealedTurn.current) return;

    // No counterattack (monster died on player's attack) — reveal immediately
    if (!counterattackForTurn) {
      lastRevealedTurn.current = maxTurn;
      setHiddenTurn(null);
      return;
    }

    // Start the delay
    setHiddenTurn(maxTurn);

    delayTimeout.current = setTimeout(() => {
      lastRevealedTurn.current = maxTurn;
      setHiddenTurn(null);
    }, COUNTERATTACK_DELAY_MS);

    safetyTimeout.current = setTimeout(() => {
      lastRevealedTurn.current = maxTurn;
      setHiddenTurn(null);
    }, SAFETY_TIMEOUT_MS);

    return () => {
      if (delayTimeout.current) clearTimeout(delayTimeout.current);
      if (safetyTimeout.current) clearTimeout(safetyTimeout.current);
    };
  }, [isInBattle, maxTurn, counterattackForTurn]);

  // Reset when battle ends
  useEffect(() => {
    if (!isInBattle) {
      lastRevealedTurn.current = 0n;
      setHiddenTurn(null);
      if (delayTimeout.current) clearTimeout(delayTimeout.current);
      if (safetyTimeout.current) clearTimeout(safetyTimeout.current);
    }
  }, [isInBattle]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (delayTimeout.current) clearTimeout(delayTimeout.current);
      if (safetyTimeout.current) clearTimeout(safetyTimeout.current);
    };
  }, []);

  const isCounterattackPending = hiddenTurn !== null;

  const pendingCounterattackDamage = useMemo(() => {
    if (!isCounterattackPending || !counterattackForTurn) return 0n;
    return counterattackForTurn.attackerDamageDelt;
  }, [isCounterattackPending, counterattackForTurn]);

  const visibleOutcomes = useMemo(() => {
    if (hiddenTurn === null || !characterId) return attackOutcomes;
    return attackOutcomes.filter(
      a =>
        !(
          a.currentTurn === hiddenTurn &&
          a.attackerId.toLowerCase() !== characterId.toLowerCase() &&
          a.attackerId.toLowerCase() !== a.defenderId.toLowerCase()
        ),
    );
  }, [attackOutcomes, hiddenTurn, characterId]);

  return {
    visibleOutcomes,
    isCounterattackPending,
    pendingCounterattackDamage,
    pendingTurn: hiddenTurn,
  };
}
