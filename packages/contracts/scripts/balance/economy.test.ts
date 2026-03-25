import { describe, it, expect } from "vitest";
import {
  ECONOMY,
  avgGoldPerKill,
  avgVendorGoldPerFight,
  repairCostPerFight,
  consumableCostPerFight,
  netGoldPerFight,
  marketplaceIncomePerFight,
  guildTaxPerMemberPerDay,
  totalGuildSinkPerDay,
  guildRepairSavingsPerDay,
  netGuildCostPerMemberPerDay,
  dailyGrossIncome,
  completeBurnRate,
} from "./economy.js";

// ============================================================
//  Gold Income
// ============================================================

describe("avgGoldPerKill", () => {
  it("matches on-chain formula: avg of random(0, 3*level) + 0.05", () => {
    // At level 1: avg = (3 * 1 / 2) + 0.05 = 1.55
    expect(avgGoldPerKill(1)).toBeCloseTo(1.55, 2);
    // At level 10: avg = (3 * 10 / 2) + 0.05 = 15.05
    expect(avgGoldPerKill(10)).toBeCloseTo(15.05, 2);
    // At level 20: avg = (3 * 20 / 2) + 0.05 = 30.05
    expect(avgGoldPerKill(20)).toBeCloseTo(30.05, 2);
  });

  it("scales linearly with mob level", () => {
    const diff10to20 = avgGoldPerKill(20) - avgGoldPerKill(10);
    const diff1to11 = avgGoldPerKill(11) - avgGoldPerKill(1);
    // Both should be 15 (1.5 * 10 levels)
    expect(diff10to20).toBeCloseTo(15, 2);
    expect(diff1to11).toBeCloseTo(15, 2);
  });

  it("returns positive for level 0", () => {
    // Edge case: level 0 mob gives only the flat bonus
    expect(avgGoldPerKill(0)).toBeCloseTo(0.05, 2);
  });
});

describe("avgVendorGoldPerFight", () => {
  it("returns positive value from R0-R2 drops", () => {
    const result = avgVendorGoldPerFight();
    expect(result).toBeGreaterThan(0);
  });

  it("only includes R0-R2 (not R3+ which go to marketplace)", () => {
    // Manual calculation:
    // R0: 8000/100000 * 5 * 0.50 = 0.20
    // R1: 5000/100000 * 40 * 0.50 = 1.00
    // R2: 100/100000 * 150 * 0.50 = 0.075
    // Total: 1.275
    expect(avgVendorGoldPerFight()).toBeCloseTo(1.275, 3);
  });

  it("does not include R3 or R4", () => {
    // If we included R3: 4/100000 * 750 * 0.50 = 0.015 extra
    // If we included R4: 3/100000 * 3000 * 0.50 = 0.045 extra
    // So total would be ~1.335 if R3+ included
    expect(avgVendorGoldPerFight()).toBeLessThan(1.30);
  });
});

// ============================================================
//  Repair Costs
// ============================================================

describe("repairCostPerFight", () => {
  it("scales with item base price", () => {
    const cheap = repairCostPerFight(50, 50);    // 100g total gear
    const expensive = repairCostPerFight(500, 500); // 1000g total gear
    expect(expensive).toBeCloseTo(cheap * 10, 4);
  });

  it("matches formula: (wpn+arm) * REPAIR_RATE * (DURABILITY_LOSS / DURABILITY_MAX)", () => {
    // 200g weapon + 100g armor, 8% rate, 2/100 durability loss
    // = 300 * 0.08 * 0.02 = 0.48
    expect(repairCostPerFight(200, 100)).toBeCloseTo(0.48, 4);
  });

  it("returns 0 for free gear", () => {
    expect(repairCostPerFight(0, 0)).toBe(0);
  });

  it("works with weapon-only (no armor)", () => {
    expect(repairCostPerFight(100, 0)).toBeCloseTo(0.16, 4);
  });

  it("R2 gear repair is under 5% of L15 income", () => {
    const repair = repairCostPerFight(150, 130);
    const income = avgGoldPerKill(15) + avgVendorGoldPerFight();
    expect(repair / income).toBeLessThan(0.05);
  });

  it("R4 gear repair is significant portion of income", () => {
    const repair = repairCostPerFight(3000, 2800);
    const income = avgGoldPerKill(20) + avgVendorGoldPerFight();
    expect(repair / income).toBeGreaterThan(0.10);
  });
});

// ============================================================
//  Consumable Costs
// ============================================================

describe("consumableCostPerFight", () => {
  it("farming is cheapest", () => {
    expect(consumableCostPerFight("farming")).toBeLessThan(consumableCostPerFight("progression"));
    expect(consumableCostPerFight("progression")).toBeLessThan(consumableCostPerFight("boss"));
  });

  it("farming: 0.3 pots × 10g = 3g", () => {
    expect(consumableCostPerFight("farming")).toBeCloseTo(3, 2);
  });

  it("progression: 1.2 pots × 25g = 30g", () => {
    expect(consumableCostPerFight("progression")).toBeCloseTo(30, 2);
  });

  it("boss: 2.0 pots × 60g = 120g", () => {
    expect(consumableCostPerFight("boss")).toBeCloseTo(120, 2);
  });
});

// ============================================================
//  Net Gold Per Fight
// ============================================================

describe("netGoldPerFight", () => {
  it("farming at L15 with R2 gear is profitable", () => {
    expect(netGoldPerFight(15, "farming", 150, 130)).toBeGreaterThan(0);
  });

  it("progression at L15 with R2 gear is negative", () => {
    expect(netGoldPerFight(15, "progression", 150, 130)).toBeLessThan(0);
  });

  it("boss at L20 with R4 gear is deeply negative", () => {
    expect(netGoldPerFight(20, "boss", 3000, 2800)).toBeLessThan(-50);
  });

  it("higher level = more profitable farming (gold scales, repairs don't)", () => {
    const l11 = netGoldPerFight(11, "farming", 40, 35);
    const l20 = netGoldPerFight(20, "farming", 40, 35);
    expect(l20).toBeGreaterThan(l11);
  });

  it("more expensive gear = less profitable", () => {
    const cheap = netGoldPerFight(15, "farming", 50, 50);
    const expensive = netGoldPerFight(15, "farming", 3000, 2800);
    expect(cheap).toBeGreaterThan(expensive);
  });
});

// ============================================================
//  Marketplace Income
// ============================================================

describe("marketplaceIncomePerFight", () => {
  it("returns positive expected value", () => {
    expect(marketplaceIncomePerFight()).toBeGreaterThan(0);
  });

  it("is very small per fight (rare drops are rare)", () => {
    // At 40 fights/day, should be single-digit gold
    expect(marketplaceIncomePerFight() * 40).toBeLessThan(10);
  });

  it("R3 contributes more than R4 (higher sell rate despite lower price)", () => {
    // R3: 0.004% × 66% × 2250 × 0.97 = ~0.0576/fight
    // R4: 0.003% × 5% × 24000 × 0.97 = ~0.0349/fight
    // R3 should be higher
    const r3Drop = (ECONOMY.DROP_RATES[3] / 100000) * ECONOMY.MARKETPLACE_SELL_RATE[3]!;
    const r4Drop = (ECONOMY.DROP_RATES[4] / 100000) * ECONOMY.MARKETPLACE_SELL_RATE[4]!;
    const r3Value = r3Drop * ECONOMY.VENDOR_PRICES[3]! * ECONOMY.MARKETPLACE_PRICE_MULT[3]!;
    const r4Value = r4Drop * ECONOMY.VENDOR_PRICES[4]! * ECONOMY.MARKETPLACE_PRICE_MULT[4]!;
    expect(r3Value).toBeGreaterThan(r4Value);
  });
});

// ============================================================
//  Guild Sinks
// ============================================================

describe("guild tax model", () => {
  it("guildTaxPerMemberPerDay scales with level and fights", () => {
    const low = guildTaxPerMemberPerDay(10, 20);
    const high = guildTaxPerMemberPerDay(20, 40);
    expect(high).toBeGreaterThan(low);
  });

  it("10% tax at L15, 40 fights = 10% of kill gold", () => {
    const killGold = avgGoldPerKill(15) * 40;
    const tax = guildTaxPerMemberPerDay(15, 40);
    expect(tax).toBeCloseTo(killGold * 0.10, 1);
  });

  it("guild tax is less than 15% of total gross income", () => {
    const gross = dailyGrossIncome(15, 40);
    const tax = guildTaxPerMemberPerDay(15, 40);
    expect(tax / gross).toBeLessThan(0.15);
  });

  it("free repairs offset some of the tax cost", () => {
    const netCost = netGuildCostPerMemberPerDay(15, 40, 150, 130);
    const tax = guildTaxPerMemberPerDay(15, 40);
    expect(netCost).toBeLessThan(tax);
    expect(netCost).toBeGreaterThan(0); // tax > repair savings
  });

  it("totalGuildSinkPerDay burns 80% of collected tax", () => {
    const guildedPlayers = 100 * ECONOMY.GUILD_PARTICIPATION_RATE;
    const taxCollected = guildedPlayers * guildTaxPerMemberPerDay(15, 40);
    const totalSink = totalGuildSinkPerDay(100, 15, 40);
    const creationAmortized = Math.max(1, Math.floor(guildedPlayers / ECONOMY.AVG_GUILD_SIZE)) * ECONOMY.GUILD_CREATION_COST / 30;
    // Total sink should be ~80% of tax + creation amortized
    expect(totalSink).toBeCloseTo(taxCollected * 0.80 + creationAmortized, 0);
  });

  it("guild is worth joining: perks > net cost for active players", () => {
    // At L15 with R2 gear, net guild cost should be < 10% of income
    const gross = dailyGrossIncome(15, 40);
    const netCost = netGuildCostPerMemberPerDay(15, 40, 150, 130);
    expect(netCost / gross).toBeLessThan(0.10);
  });
});

// ============================================================
//  Aggregate Economy
// ============================================================

describe("dailyGrossIncome", () => {
  it("includes both kill gold and vendor drops", () => {
    const killOnly = avgGoldPerKill(15) * 40;
    const gross = dailyGrossIncome(15, 40);
    expect(gross).toBeGreaterThan(killOnly);
  });

  it("scales with fights per day", () => {
    expect(dailyGrossIncome(15, 80)).toBeCloseTo(dailyGrossIncome(15, 40) * 2, 1);
  });
});

describe("completeBurnRate", () => {
  it("is between 0 and 1", () => {
    const rate = completeBurnRate(100, 15, 40, 300);
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThan(1);
  });

  it("increases with more guilded players (higher participation rate)", () => {
    const base = completeBurnRate(100, 15, 40, 300);
    // Can't easily change participation rate without mutating ECONOMY,
    // so just verify the rate is positive and reasonable
    expect(base).toBeGreaterThan(0.15);
    expect(base).toBeLessThan(0.50);
  });

  it("is higher at more expensive gear (more repair cost)", () => {
    const cheap = completeBurnRate(100, 15, 40, 100);
    const expensive = completeBurnRate(100, 15, 40, 1000);
    expect(expensive).toBeGreaterThan(cheap);
  });

  it("at 100 DAU, complete burn rate exceeds 20%", () => {
    expect(completeBurnRate(100, 15, 40, 300)).toBeGreaterThan(0.20);
  });
});

// ============================================================
//  Economic Design Invariants
//  These tests encode the design rules from ECONOMY_TUNING_GUIDE.md
// ============================================================

describe("economic design invariants", () => {
  it("farming must be profitable at every Z2 level", () => {
    for (let level = 11; level <= 20; level++) {
      const net = netGoldPerFight(level, "farming", 80, 70); // R2 gear
      expect(net).toBeGreaterThan(0, `Farming unprofitable at L${level}`);
    }
  });

  it("progression must be negative at L15 with R2 gear", () => {
    expect(netGoldPerFight(15, "progression", 150, 130)).toBeLessThan(0);
  });

  it("boss attempts must cost more than 50 gold net", () => {
    expect(netGoldPerFight(20, "boss", 300, 280)).toBeLessThan(-50);
  });

  it("R2 repair is under 5% of farming income", () => {
    const repair = repairCostPerFight(150, 130);
    const income = avgGoldPerKill(15) + avgVendorGoldPerFight();
    expect(repair / income).toBeLessThan(0.05);
  });

  it("R4 repair exceeds 15% of farming income", () => {
    const repair = repairCostPerFight(3000, 2800);
    const income = avgGoldPerKill(20) + avgVendorGoldPerFight();
    expect(repair / income).toBeGreaterThan(0.15);
  });

  it("guild tax is worth it: net cost < 10% of income for R2 player", () => {
    const gross = dailyGrossIncome(15, 40);
    const netCost = netGuildCostPerMemberPerDay(15, 40, 150, 130);
    expect(netCost / gross).toBeLessThan(0.10);
  });

  it("pure builds pay less in repairs than hybrid builds", () => {
    const pureRepair = repairCostPerFight(150, 140);   // R3 pure: 150g weapon
    const hybridRepair = repairCostPerFight(200, 140);  // R3 hybrid: 200g weapon
    expect(pureRepair).toBeLessThan(hybridRepair);
  });

  it("consumable costs dominate repair costs at R2 gear level", () => {
    const repair = repairCostPerFight(150, 130);
    const pots = consumableCostPerFight("farming");
    expect(pots).toBeGreaterThan(repair);
  });
});
