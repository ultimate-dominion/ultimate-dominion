import { useCallback, useMemo } from 'react';

/**
 * Generic hook for ordering equipment slots by tokenId.
 * Persists order to localStorage and reconciles against currently equipped items.
 */
export function useSlotOrder<T extends { tokenId: string }>(
  storageKey: string,
  defaultItems: T[],
): { orderedItems: T[]; promoteToFirst: (index: number) => void } {
  const orderedItems = useMemo(() => {
    if (defaultItems.length === 0) return [];

    const raw = localStorage.getItem(storageKey);
    if (!raw) return defaultItems;

    let savedOrder: string[];
    try {
      savedOrder = JSON.parse(raw);
    } catch {
      return defaultItems;
    }

    if (!Array.isArray(savedOrder)) return defaultItems;

    const itemMap = new Map(defaultItems.map(item => [item.tokenId, item]));

    // Ordered items that still exist in current equipment
    const ordered: T[] = [];
    for (const id of savedOrder) {
      const item = itemMap.get(id);
      if (item) {
        ordered.push(item);
        itemMap.delete(id);
      }
    }

    // Append any new items not in saved order
    for (const item of itemMap.values()) {
      ordered.push(item);
    }

    return ordered;
  }, [storageKey, defaultItems]);

  const promoteToFirst = useCallback(
    (index: number) => {
      if (index <= 0 || index >= orderedItems.length) return;
      const ids = orderedItems.map(i => i.tokenId);
      const [promoted] = ids.splice(index, 1);
      ids.unshift(promoted);
      localStorage.setItem(storageKey, JSON.stringify(ids));
      // Force re-render by dispatching a storage event won't work in same tab,
      // so the caller should trigger a state update. We write to localStorage
      // and the component will re-read on next render cycle.
      window.dispatchEvent(new Event('slot-order-changed'));
    },
    [storageKey, orderedItems],
  );

  return { orderedItems, promoteToFirst };
}

/**
 * Read saved slot order from localStorage without React hooks.
 * Used in contexts (like BattleContext) that need the first preferred item.
 */
export function getFirstSlotItem(
  storageKey: string,
  equippedItems: { tokenId: string }[],
): { tokenId: string } | undefined {
  if (equippedItems.length === 0) return undefined;

  const raw = localStorage.getItem(storageKey);
  if (!raw) return equippedItems[0];

  let savedOrder: string[];
  try {
    savedOrder = JSON.parse(raw);
  } catch {
    return equippedItems[0];
  }

  if (!Array.isArray(savedOrder)) return equippedItems[0];

  const equippedSet = new Set(equippedItems.map(i => i.tokenId));
  for (const id of savedOrder) {
    if (equippedSet.has(id)) {
      return equippedItems.find(i => i.tokenId === id);
    }
  }

  return equippedItems[0];
}
