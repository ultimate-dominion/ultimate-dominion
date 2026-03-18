import { useEffect, useRef, useState } from 'react';

/**
 * Two-step health bar animation hook.
 * When DoT damage is present on a new turn, the HP bar first drops by
 * weapon damage only, then after a delay drops again by the DoT amount.
 */
export function useBattleHpAnimation({
  actualHp,
  dotDamage,
  dotTurnNumber,
  isInBattle,
}: {
  actualHp: bigint;
  dotDamage: bigint;
  dotTurnNumber: bigint;
  isInBattle: boolean;
}): { displayedHp: bigint; isDotTicking: boolean } {
  const [displayedHp, setDisplayedHp] = useState(actualHp);
  const [isDotTicking, setIsDotTicking] = useState(false);
  const lastAnimatedTurn = useRef<bigint>(0n);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset when leaving battle
  useEffect(() => {
    if (!isInBattle) {
      setDisplayedHp(actualHp);
      setIsDotTicking(false);
      lastAnimatedTurn.current = 0n;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (safetyRef.current) clearTimeout(safetyRef.current);
    }
  }, [isInBattle, actualHp]);

  useEffect(() => {
    if (!isInBattle) return;

    // New turn with DoT damage — play two-step animation
    if (dotDamage > 0n && dotTurnNumber > lastAnimatedTurn.current) {
      lastAnimatedTurn.current = dotTurnNumber;

      // Step 1: show HP minus weapon damage only (hold back the DoT portion)
      setDisplayedHp(actualHp + dotDamage);
      setIsDotTicking(false);

      // Step 2: after delay, drop to actual HP (DoT portion)
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setDisplayedHp(actualHp);
        setIsDotTicking(true);
        // Clear ticking indicator after animation completes
        setTimeout(() => setIsDotTicking(false), 800);
      }, 800);

      // Safety: snap to actual HP if stuck
      if (safetyRef.current) clearTimeout(safetyRef.current);
      safetyRef.current = setTimeout(() => {
        setDisplayedHp(actualHp);
        setIsDotTicking(false);
      }, 2000);

      return;
    }

    // No DoT or already animated this turn — snap to actual HP
    // Clear any in-flight timeouts to prevent stale values overwriting
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (safetyRef.current) clearTimeout(safetyRef.current);
    setDisplayedHp(actualHp);
  }, [actualHp, dotDamage, dotTurnNumber, isInBattle]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (safetyRef.current) clearTimeout(safetyRef.current);
    };
  }, []);

  return { displayedHp, isDotTicking };
}
