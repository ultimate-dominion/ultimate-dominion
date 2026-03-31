/**
 * Economy simulation functions — extracted for testability.
 * Used by journey-z2.ts --economy flag.
 *
 * See docs/ECONOMY_TUNING_GUIDE.md for design rationale.
 */

export const ECONOMY = {
  // Gold faucets
  BASE_GOLD_DROP: 2,
  GOLD_PER_KILL_FLAT: 0.05,
  SHOP_SELL_MARKDOWN: 0.50,
  MARKETPLACE_FEE: 0.03,

  // Gear degradation — flat per-rarity cost model (matches constants.sol)
  DURABILITY_LOSS_PER_FIGHT: 1,
  REPAIR_COST_PER_POINT: {
    0: 0.05,   // R0 (Worn)     — max dur 20, full repair: 1g
    1: 0.25,   // R1 (Common)   — max dur 30, full repair: 7.5g
    2: 0.75,   // R2 (Uncommon) — max dur 40, full repair: 30g
    3: 1.5,    // R3 (Rare)     — max dur 50, full repair: 75g
    4: 2.5,    // R4 (Epic)     — max dur 60, full repair: 150g
  } as Record<number, number>,
  MAX_DURABILITY: {
    0: 20, 1: 30, 2: 40, 3: 50, 4: 60,
  } as Record<number, number>,
  // Legacy compat (used by some callers)
  DURABILITY_MAX: 40,       // avg for R2
  REPAIR_RATE: 0.10,        // approximate, actual is per-point flat
  FIGHTS_PER_DURABILITY_CYCLE: 40,

  // Drop rates (/100000)
  DROP_RATES: {
    0: 8000,
    1: 5000,
    2: 100,
    3: 4,
    4: 3,
  } as Record<number, number>,

  // Vendor sell values by rarity (representative base prices in Gold)
  VENDOR_PRICES: {
    0: 5,
    1: 40,
    2: 150,
    3: 750,
    4: 3000,
  } as Record<number, number>,

  // Death/flee sinks
  PVE_DEATH_BURN_PCT: 0.05,
  PVE_FLEE_BURN_PCT: 0.05,
  PVP_DEATH_BURN_PCT: 0.10,
  DEATH_RATE_NORMAL: 0.15,
  FLEE_RATE_NORMAL: 0.05,

  // Consumable usage rates by mode
  CONSUMABLE_USAGE: {
    farming:     { potsPerFight: 0.3, potTier: "Minor HP",   potCost: 10 },
    progression: { potsPerFight: 1.2, potTier: "Health Pot",  potCost: 25 },
    boss:        { potsPerFight: 2.0, potTier: "Greater HP",  potCost: 60 },
  } as Record<string, { potsPerFight: number; potTier: string; potCost: number }>,

  // Marketplace income
  MARKETPLACE_PRICE_MULT: {
    3: 3.0,
    4: 8.0,
  } as Record<number, number>,
  MARKETPLACE_SELL_RATE: {
    3: 0.66,
    4: 0.05,
  } as Record<number, number>,

  // Speculative holder absorption
  SPECULATIVE_ABSORPTION_RATE: 0.0,

  // Guild sinks
  // Guild takes a % of member PvE gold income → guild treasury.
  // Treasury spent on: war declarations, territory upkeep, buffs.
  // Member perks: free repairs, drop rate bonus, gold bonus, XP bonus.
  // Net effect: guild tax > repair savings = net gold drain for members.
  GUILD_CREATION_COST: 500,
  GUILD_TAX_RATE: 0.10,             // 10% of PvE kill gold goes to guild treasury
  GUILD_PARTICIPATION_RATE: 0.20,   // % of DAU in a guild
  AVG_GUILD_SIZE: 8,
  GUILD_FREE_REPAIRS: true,         // guilded players don't pay repair costs (perk)
  // Treasury burn: how much of treasury gold gets burned (wars, upkeep) vs recirculated
  GUILD_TREASURY_BURN_RATE: 0.80,   // 80% of treasury gold is burned (wars, territory, buffs), 20% recirculated

  // Inflation modeling
  DEFAULT_DAU: 50,
  GOLD_PER_DAU_PER_DAY: 340,
};

/** Average gold dropped per kill at a given mob level. On-chain: random(0, BASE_GOLD_DROP * level) + 0.05 */
export function avgGoldPerKill(mobLevel: number): number {
  return (ECONOMY.BASE_GOLD_DROP * mobLevel / 2) + ECONOMY.GOLD_PER_KILL_FLAT;
}

/** Average vendor gold per fight from item drops (R0-R2 vendored at 50% markdown) */
export function avgVendorGoldPerFight(): number {
  let total = 0;
  for (const [rarityStr, dropChance] of Object.entries(ECONOMY.DROP_RATES)) {
    const rarity = parseInt(rarityStr);
    if (rarity > 2) continue;
    const dropPct = dropChance / 100000;
    const vendorValue = (ECONOMY.VENDOR_PRICES[rarity] ?? 0) * ECONOMY.SHOP_SELL_MARKDOWN;
    total += dropPct * vendorValue;
  }
  return total;
}

/** Repair cost per fight for a given weapon + armor rarity (flat per-point model) */
export function repairCostPerFight(weaponPrice: number, armorPrice: number, weaponRarity = 2, armorRarity = 2): number {
  const wCost = ECONOMY.REPAIR_COST_PER_POINT[weaponRarity] ?? 0.75;
  const aCost = ECONOMY.REPAIR_COST_PER_POINT[armorRarity] ?? 0.75;
  return (wCost + aCost) * ECONOMY.DURABILITY_LOSS_PER_FIGHT;
}

/** Consumable cost per fight by play mode */
export function consumableCostPerFight(mode: "farming" | "progression" | "boss"): number {
  const cfg = ECONOMY.CONSUMABLE_USAGE[mode];
  return cfg.potsPerFight * cfg.potCost;
}

/** Net gold per fight for a given mode, level, and gear value */
export function netGoldPerFight(
  level: number,
  mode: "farming" | "progression" | "boss",
  weaponPrice: number,
  armorPrice: number,
): number {
  return avgGoldPerKill(level) + avgVendorGoldPerFight() - consumableCostPerFight(mode) - repairCostPerFight(weaponPrice, armorPrice);
}

/** Expected marketplace income per fight from R3+ drops */
export function marketplaceIncomePerFight(): number {
  let total = 0;
  for (const rarity of [3, 4]) {
    const dropChance = ECONOMY.DROP_RATES[rarity] / 100000;
    const sellRate = ECONOMY.MARKETPLACE_SELL_RATE[rarity] ?? 0;
    const basePrice = ECONOMY.VENDOR_PRICES[rarity] ?? 0;
    const mktMult = ECONOMY.MARKETPLACE_PRICE_MULT[rarity] ?? 1;
    const mktPrice = basePrice * mktMult;
    const netToSeller = mktPrice * (1 - ECONOMY.MARKETPLACE_FEE);
    total += dropChance * sellRate * netToSeller;
  }
  return total;
}

/** Guild tax per guilded player per day (% of kill gold taxed → treasury) */
export function guildTaxPerMemberPerDay(avgLevel: number, fightsPerDay: number): number {
  return fightsPerDay * avgGoldPerKill(avgLevel) * ECONOMY.GUILD_TAX_RATE;
}

/** Gold burned from guild treasury per day (tax collected × treasury burn rate) */
export function totalGuildSinkPerDay(dau: number, avgLevel: number, fightsPerDay: number): number {
  const guildedPlayers = dau * ECONOMY.GUILD_PARTICIPATION_RATE;
  const numGuilds = Math.max(1, Math.floor(guildedPlayers / ECONOMY.AVG_GUILD_SIZE));
  const taxCollected = guildedPlayers * guildTaxPerMemberPerDay(avgLevel, fightsPerDay);
  const treasuryBurned = taxCollected * ECONOMY.GUILD_TREASURY_BURN_RATE;
  const creationAmortized = numGuilds * ECONOMY.GUILD_CREATION_COST / 30;
  return treasuryBurned + creationAmortized;
}

/** Repair savings per guilded player per day (free repairs perk) */
export function guildRepairSavingsPerDay(fightsPerDay: number, weaponPrice: number, armorPrice: number, weaponRarity = 2, armorRarity = 2): number {
  return ECONOMY.GUILD_FREE_REPAIRS ? fightsPerDay * repairCostPerFight(weaponPrice, armorPrice, weaponRarity, armorRarity) : 0;
}

/** Net guild cost to a member per day: tax paid - repair savings */
export function netGuildCostPerMemberPerDay(avgLevel: number, fightsPerDay: number, weaponPrice: number, armorPrice: number): number {
  const tax = guildTaxPerMemberPerDay(avgLevel, fightsPerDay);
  const savings = guildRepairSavingsPerDay(fightsPerDay, weaponPrice, armorPrice);
  return tax - savings;
}

/** Daily gross income per player (kills + vendor drops) for a given level and fights/day */
export function dailyGrossIncome(avgLevel: number, fightsPerDay: number): number {
  return fightsPerDay * (avgGoldPerKill(avgLevel) + avgVendorGoldPerFight());
}

/** Complete burn rate including all sinks for a given DAU */
export function completeBurnRate(dau: number, avgLevel: number, fightsPerDay: number, avgGearValue: number, avgRarity = 2): number {
  const gross = dailyGrossIncome(avgLevel, fightsPerDay) * dau;

  const repairSink = fightsPerDay * repairCostPerFight(0, 0, avgRarity, avgRarity) * dau;
  const potSink = fightsPerDay * consumableCostPerFight("farming") * dau;
  const dailyKillGold = fightsPerDay * avgGoldPerKill(avgLevel);
  const deathSink = dailyKillGold * ECONOMY.DEATH_RATE_NORMAL * ECONOMY.PVE_DEATH_BURN_PCT * 5 * dau;
  const fleeSink = dailyKillGold * ECONOMY.FLEE_RATE_NORMAL * ECONOMY.PVE_FLEE_BURN_PCT * 3 * dau;
  const guildSink = totalGuildSinkPerDay(dau, avgLevel, fightsPerDay);
  const mktFees = fightsPerDay * marketplaceIncomePerFight() * dau * ECONOMY.MARKETPLACE_FEE / (1 - ECONOMY.MARKETPLACE_FEE);

  const totalSinks = repairSink + potSink + deathSink + fleeSink + guildSink + mktFees;
  return gross > 0 ? totalSinks / gross : 0;
}
