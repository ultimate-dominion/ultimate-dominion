/**
 * Lightweight GA4 custom event tracking.
 *
 * All events are fire-and-forget — analytics should never block gameplay.
 * gtag is loaded via script tag in index.html (G-L91PLYCHL3).
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

type EventParams = Record<string, string | number | boolean>;

function trackEvent(name: string, params?: EventParams): void {
  try {
    window.gtag?.('event', name, params);
  } catch {
    // Analytics should never throw
  }
}

// ── Funnel events ──────────────────────────────────────────

/** User signed up / connected wallet (first session) */
export const trackSignUp = (method: string) =>
  trackEvent('sign_up', { method });

/** Character minted and ready to play */
export const trackCharacterCreated = (race: string, characterName: string) =>
  trackEvent('character_created', { race, character_name: characterName });

/** PvE combat started */
export const trackCombatStarted = (monsterName: string, monsterLevel: number, playerLevel: number) =>
  trackEvent('combat_started', {
    monster_name: monsterName,
    monster_level: monsterLevel,
    player_level: playerLevel,
    encounter_type: 'pve',
  });

/** PvP combat started */
export const trackPvpStarted = (opponentLevel: number, playerLevel: number) =>
  trackEvent('pvp_started', {
    opponent_level: opponentLevel,
    player_level: playerLevel,
    encounter_type: 'pvp',
  });

/** Player leveled up */
export const trackLevelUp = (newLevel: number, characterName: string) =>
  trackEvent('level_up', { level: newLevel, character_name: characterName });

/** Player hit a retention milestone */
export const trackMilestone = (milestone: string, playerLevel: number) =>
  trackEvent('milestone_reached', { milestone, player_level: playerLevel });

/** Bought item from NPC shop */
export const trackShopPurchase = (itemName: string, goldAmount: number) =>
  trackEvent('shop_purchase', { item_name: itemName, gold_amount: goldAmount });

/** Sold item to NPC shop */
export const trackShopSale = (itemName: string, goldAmount: number) =>
  trackEvent('shop_sale', { item_name: itemName, gold_amount: goldAmount });

/** Listed item on player marketplace */
export const trackMarketplaceListing = (itemName: string) =>
  trackEvent('marketplace_listing', { item_name: itemName });

/** Selected advanced class at level 10 */
export const trackAdvancedClassSelected = (className: string) =>
  trackEvent('advanced_class_selected', { class_name: className });

/** Combat outcome (win/loss/draw) */
export const trackCombatOutcome = (
  outcome: 'win' | 'loss' | 'draw' | 'flee',
  encounterType: 'pve' | 'pvp',
  playerLevel: number,
) =>
  trackEvent('combat_outcome', { outcome, encounter_type: encounterType, player_level: playerLevel });
