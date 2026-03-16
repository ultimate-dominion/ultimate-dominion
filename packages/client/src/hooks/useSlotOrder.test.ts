import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSlotOrder, getFirstSlotItem } from './useSlotOrder';

const sword = { tokenId: '0xsword', name: 'Sword' };
const staff = { tokenId: '0xstaff', name: 'Staff' };
const bow = { tokenId: '0xbow', name: 'Bow' };
const axe = { tokenId: '0xaxe', name: 'Axe' };

const KEY = 'test_slot_order';

describe('useSlotOrder', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // --- Happy paths ---

  it('returns default items when no saved order exists', () => {
    const { result } = renderHook(() => useSlotOrder(KEY, [sword, staff]));
    expect(result.current.orderedItems).toEqual([sword, staff]);
  });

  it('returns items in saved order', () => {
    localStorage.setItem(KEY, JSON.stringify(['0xstaff', '0xsword']));
    const { result } = renderHook(() => useSlotOrder(KEY, [sword, staff]));
    expect(result.current.orderedItems).toEqual([staff, sword]);
  });

  it('promoteToFirst moves item to position 0 and persists', () => {
    const { result } = renderHook(() => useSlotOrder(KEY, [sword, staff, bow]));

    act(() => {
      result.current.promoteToFirst(2);
    });

    const saved = JSON.parse(localStorage.getItem(KEY)!);
    expect(saved).toEqual(['0xbow', '0xsword', '0xstaff']);
  });

  it('promoteToFirst(1) swaps first two items', () => {
    const { result } = renderHook(() => useSlotOrder(KEY, [sword, staff]));

    act(() => {
      result.current.promoteToFirst(1);
    });

    const saved = JSON.parse(localStorage.getItem(KEY)!);
    expect(saved).toEqual(['0xstaff', '0xsword']);
  });

  it('persisted order survives re-render with same items', () => {
    localStorage.setItem(KEY, JSON.stringify(['0xbow', '0xstaff', '0xsword']));

    const { result, rerender } = renderHook(() => useSlotOrder(KEY, [sword, staff, bow]));
    expect(result.current.orderedItems.map(i => i.tokenId)).toEqual(['0xbow', '0xstaff', '0xsword']);

    rerender();
    expect(result.current.orderedItems.map(i => i.tokenId)).toEqual(['0xbow', '0xstaff', '0xsword']);
  });

  // --- Reconciliation: equip/unequip ---

  it('removes unequipped items from order', () => {
    localStorage.setItem(KEY, JSON.stringify(['0xbow', '0xstaff', '0xsword']));
    // Staff was unequipped
    const { result } = renderHook(() => useSlotOrder(KEY, [sword, bow]));
    expect(result.current.orderedItems).toEqual([bow, sword]);
  });

  it('appends newly equipped items to end', () => {
    localStorage.setItem(KEY, JSON.stringify(['0xstaff', '0xsword']));
    // Bow was newly equipped
    const { result } = renderHook(() => useSlotOrder(KEY, [sword, staff, bow]));
    expect(result.current.orderedItems).toEqual([staff, sword, bow]);
  });

  it('handles equip and unequip simultaneously', () => {
    localStorage.setItem(KEY, JSON.stringify(['0xbow', '0xstaff', '0xsword']));
    // Staff unequipped, axe newly equipped
    const { result } = renderHook(() => useSlotOrder(KEY, [sword, bow, axe]));
    expect(result.current.orderedItems).toEqual([bow, sword, axe]);
  });

  // --- Edge cases ---

  it('returns empty array for empty items', () => {
    const { result } = renderHook(() => useSlotOrder(KEY, []));
    expect(result.current.orderedItems).toEqual([]);
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem(KEY, 'not-json');
    const { result } = renderHook(() => useSlotOrder(KEY, [sword, staff]));
    expect(result.current.orderedItems).toEqual([sword, staff]);
  });

  it('handles non-array localStorage gracefully', () => {
    localStorage.setItem(KEY, JSON.stringify({ a: 1 }));
    const { result } = renderHook(() => useSlotOrder(KEY, [sword, staff]));
    expect(result.current.orderedItems).toEqual([sword, staff]);
  });

  it('promoteToFirst(0) is a no-op', () => {
    const { result } = renderHook(() => useSlotOrder(KEY, [sword, staff]));

    act(() => {
      result.current.promoteToFirst(0);
    });

    // Nothing saved — no-op
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('promoteToFirst with out-of-bounds index is a no-op', () => {
    const { result } = renderHook(() => useSlotOrder(KEY, [sword, staff]));

    act(() => {
      result.current.promoteToFirst(5);
    });

    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('promoteToFirst with negative index is a no-op', () => {
    const { result } = renderHook(() => useSlotOrder(KEY, [sword, staff]));

    act(() => {
      result.current.promoteToFirst(-1);
    });

    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('dispatches slot-order-changed event on promote', () => {
    const listener = vi.fn();
    window.addEventListener('slot-order-changed', listener);

    const { result } = renderHook(() => useSlotOrder(KEY, [sword, staff]));

    act(() => {
      result.current.promoteToFirst(1);
    });

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('slot-order-changed', listener);
  });
});

describe('getFirstSlotItem', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns first equipped item when no saved order', () => {
    expect(getFirstSlotItem(KEY, [sword, staff])).toEqual(sword);
  });

  it('returns first item from saved order that exists in equipped', () => {
    localStorage.setItem(KEY, JSON.stringify(['0xstaff', '0xsword']));
    expect(getFirstSlotItem(KEY, [sword, staff])).toEqual(staff);
  });

  it('skips saved items that are no longer equipped', () => {
    localStorage.setItem(KEY, JSON.stringify(['0xbow', '0xstaff', '0xsword']));
    // Bow was unequipped
    expect(getFirstSlotItem(KEY, [sword, staff])).toEqual(staff);
  });

  it('returns undefined for empty equipped items', () => {
    expect(getFirstSlotItem(KEY, [])).toBeUndefined();
  });

  it('falls back to first equipped on corrupted localStorage', () => {
    localStorage.setItem(KEY, 'garbage');
    expect(getFirstSlotItem(KEY, [sword, staff])).toEqual(sword);
  });

  it('falls back to first equipped when saved order has no matches', () => {
    localStorage.setItem(KEY, JSON.stringify(['0xgone1', '0xgone2']));
    expect(getFirstSlotItem(KEY, [sword, staff])).toEqual(sword);
  });
});
