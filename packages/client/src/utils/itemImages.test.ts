import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getItemImage, getConsumableEmoji, preloadItemImages } from './itemImages';

describe('getItemImage', () => {
  it('returns WebP path for known items', () => {
    expect(getItemImage('Iron Axe')).toBe('/images/items/iron-axe.webp');
    expect(getItemImage('Hunting Bow')).toBe('/images/items/hunting-bow.webp');
  });

  it('returns fallback icon for items without WebP', () => {
    expect(getItemImage('Rusty Axe')).toBe('/images/icons/battle-axe.svg');
  });

  it('returns undefined for unknown items', () => {
    expect(getItemImage('Nonexistent Sword')).toBeUndefined();
  });
});

describe('getConsumableEmoji', () => {
  it('returns known emoji for mapped consumables', () => {
    expect(getConsumableEmoji('Health Potion')).toBe('\u2764\uFE0F');
  });

  it('returns fallback emoji for unknown consumables', () => {
    expect(getConsumableEmoji('Unknown Potion')).toBe('\uD83D\uDCE6');
  });
});

describe('preloadItemImages', () => {
  let mockImage: { src: string };

  beforeEach(() => {
    mockImage = { src: '' };
    vi.spyOn(window, 'Image').mockImplementation(() => mockImage as any);
  });

  it('creates Image objects for items with known image paths', () => {
    preloadItemImages(['Iron Axe', 'Hunting Bow']);
    // The last image created should have a valid src
    expect(mockImage.src).toBeTruthy();
    expect(mockImage.src).toMatch(/\.webp$/);
  });

  it('skips items without images', () => {
    const spy = vi.spyOn(window, 'Image');
    const callsBefore = spy.mock.calls.length;
    preloadItemImages(['Nonexistent Sword']);
    expect(spy.mock.calls.length).toBe(callsBefore);
  });

  it('deduplicates preload calls for the same URL', () => {
    const spy = vi.spyOn(window, 'Image');
    const callsBefore = spy.mock.calls.length;
    // Preload same item twice — second call should not create a new Image
    preloadItemImages(['Iron Axe']);
    const callsAfterFirst = spy.mock.calls.length;
    preloadItemImages(['Iron Axe']);
    expect(spy.mock.calls.length).toBe(callsAfterFirst);
  });
});
