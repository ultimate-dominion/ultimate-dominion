import { useEffect, useMemo, useRef, useState } from 'react';
import type { AttackOutcomeType } from '../utils/types';

const COUNTERATTACK_DELAY_MS = 600;
const FINISHER_DELAY_MS = 700;
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
  isBattleResolutionPending: boolean;
  pendingCounterattackDamage: bigint;
  pendingTurn: bigint | null;
} {
  const lastRevealedTurn = useRef<bigint>(0n);
  const lastResolvedTurn = useRef<bigint>(0n);
  const delayTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finisherTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hiddenTurn, setHiddenTurn] = useState<bigint | null>(null);
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

  useEffect(() => {
    if (!isInBattle || maxTurn === 0n) return;
    if (maxTurn <= lastRevealedTurn.current) return;

    if (!counterattackForTurn) {
      lastRevealedTurn.current = maxTurn;
      setHiddenTurn(null);
      return;
    }

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
  }, [counterattackForTurn, isInBattle, maxTurn]);

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
      lastRevealedTurn.current = 0n;
      lastResolvedTurn.current = 0n;
      setHiddenTurn(null);
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

  const isCounterattackPending = hiddenTurn !== null;
  const isBattleResolutionPending =
    hiddenTurn !== null || finisherTurn !== null;

  const pendingCounterattackDamage = useMemo(() => {
    if (!isCounterattackPending || !counterattackForTurn) return 0n;
    return counterattackForTurn.attackerDamageDelt;
  }, [counterattackForTurn, isCounterattackPending]);

  return {
    visibleOutcomes,
    isCounterattackPending,
    isBattleResolutionPending,
    pendingCounterattackDamage,
    pendingTurn: hiddenTurn,
  };
}
