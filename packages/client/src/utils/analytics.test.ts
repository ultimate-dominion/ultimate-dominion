import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  trackSignUp,
  trackCharacterCreated,
  trackCombatStarted,
  trackPvpStarted,
  trackLevelUp,
  trackMilestone,
  trackShopPurchase,
  trackShopSale,
  trackMarketplaceListing,
  trackAdvancedClassSelected,
  trackCombatOutcome,
} from './analytics';

describe('analytics', () => {
  let gtagSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    gtagSpy = vi.fn();
    window.gtag = gtagSpy;
  });

  afterEach(() => {
    delete window.gtag;
  });

  // ── Calls gtag correctly ───────────────────────────────

  it('trackSignUp sends sign_up event with method', () => {
    trackSignUp('google');
    expect(gtagSpy).toHaveBeenCalledWith('event', 'sign_up', { method: 'google' });
  });

  it('trackCharacterCreated sends race and name', () => {
    trackCharacterCreated('Elf', 'Gandalf');
    expect(gtagSpy).toHaveBeenCalledWith('event', 'character_created', {
      race: 'Elf',
      character_name: 'Gandalf',
    });
  });

  it('trackCombatStarted sends monster details and player level', () => {
    trackCombatStarted('Dire Rat', 1, 5);
    expect(gtagSpy).toHaveBeenCalledWith('event', 'combat_started', {
      monster_name: 'Dire Rat',
      monster_level: 1,
      player_level: 5,
      encounter_type: 'pve',
    });
  });

  it('trackPvpStarted sends opponent and player levels', () => {
    trackPvpStarted(8, 5);
    expect(gtagSpy).toHaveBeenCalledWith('event', 'pvp_started', {
      opponent_level: 8,
      player_level: 5,
      encounter_type: 'pvp',
    });
  });

  it('trackLevelUp sends new level and character name', () => {
    trackLevelUp(3, 'TestHero');
    expect(gtagSpy).toHaveBeenCalledWith('event', 'level_up', {
      level: 3,
      character_name: 'TestHero',
    });
  });

  it('trackMilestone sends milestone name and player level', () => {
    trackMilestone('level_3_adventurer_badge', 3);
    expect(gtagSpy).toHaveBeenCalledWith('event', 'milestone_reached', {
      milestone: 'level_3_adventurer_badge',
      player_level: 3,
    });
  });

  it('trackShopPurchase sends item name and gold', () => {
    trackShopPurchase('Iron Axe', 15);
    expect(gtagSpy).toHaveBeenCalledWith('event', 'shop_purchase', {
      item_name: 'Iron Axe',
      gold_amount: 15,
    });
  });

  it('trackShopSale sends item name and gold', () => {
    trackShopSale('Broken Sword', 3);
    expect(gtagSpy).toHaveBeenCalledWith('event', 'shop_sale', {
      item_name: 'Broken Sword',
      gold_amount: 3,
    });
  });

  it('trackMarketplaceListing sends item name', () => {
    trackMarketplaceListing('Drakescale Staff');
    expect(gtagSpy).toHaveBeenCalledWith('event', 'marketplace_listing', {
      item_name: 'Drakescale Staff',
    });
  });

  it('trackAdvancedClassSelected sends class name', () => {
    trackAdvancedClassSelected('Paladin');
    expect(gtagSpy).toHaveBeenCalledWith('event', 'advanced_class_selected', {
      class_name: 'Paladin',
    });
  });

  it('trackCombatOutcome sends outcome details', () => {
    trackCombatOutcome('win', 'pve', 5);
    expect(gtagSpy).toHaveBeenCalledWith('event', 'combat_outcome', {
      outcome: 'win',
      encounter_type: 'pve',
      player_level: 5,
    });
  });

  // ── Graceful degradation ───────────────────────────────

  it('does not throw when gtag is undefined', () => {
    delete window.gtag;
    expect(() => trackSignUp('google')).not.toThrow();
    expect(() => trackCombatStarted('Dire Rat', 1, 5)).not.toThrow();
    expect(() => trackLevelUp(3, 'Hero')).not.toThrow();
  });

  it('does not throw when gtag throws', () => {
    window.gtag = () => { throw new Error('gtag broken'); };
    expect(() => trackSignUp('google')).not.toThrow();
  });
});
