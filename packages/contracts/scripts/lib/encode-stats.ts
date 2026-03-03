/**
 * Shared ABI encoding helpers for item stats.
 *
 * Used by zone-loader.ts (create items) and item-sync.ts (update items).
 * Encoding must match the Solidity struct layouts exactly.
 */

import { encodeAbiParameters, Hex } from 'viem';

// ============ Types ============

export interface StatRestrictions {
  minAgility: number;
  minIntelligence: number;
  minStrength: number;
}

export interface ArmorTemplate {
  name: string;
  rarity?: number;
  dropChance: number;
  initialSupply: string | number;
  metadataUri: string;
  price: string | number;
  armorType: 'Cloth' | 'Leather' | 'Plate';
  isStarter?: boolean;
  stats: {
    agiModifier: number;
    armorModifier: number;
    hpModifier: number;
    intModifier: number;
    minLevel: number;
    strModifier: number;
  };
  statRestrictions: StatRestrictions;
}

export interface WeaponTemplate {
  name: string;
  rarity?: number;
  dropChance: number;
  initialSupply: string | number;
  metadataUri: string;
  price: string | number;
  isStarter?: boolean;
  scalingStat?: "STR" | "AGI";
  stats: {
    agiModifier: number;
    effects: Hex[];
    hpModifier: number;
    intModifier: number;
    maxDamage: number;
    minDamage: number;
    minLevel: number;
    strModifier: number;
  };
  statRestrictions: StatRestrictions;
}

export interface ConsumableTemplate {
  name: string;
  rarity?: number;
  dropChance: number;
  initialSupply: string | number;
  metadataUri: string;
  price: string | number;
  isStarter?: boolean;
  stats: {
    effects: Hex[];
    maxDamage: number;
    minDamage: number;
    minLevel: number;
  };
  statRestrictions: StatRestrictions;
}

export interface ItemsJson {
  armor: ArmorTemplate[];
  weapons: WeaponTemplate[];
  consumables: ConsumableTemplate[];
  metadataUriPrefix?: string;
}

// ============ Enums (must match Solidity) ============

export enum ItemType {
  Weapon = 0,
  Armor = 1,
  Spell = 2,
  Consumable = 3,
  QuestItem = 4,
  Accessory = 5,
}

export enum ArmorType {
  None = 0,
  Cloth = 1,
  Leather = 2,
  Plate = 3,
}

// ============ ABI Encoding ============

export function encodeArmorStats(template: ArmorTemplate): Hex {
  const armorTypeValue = ArmorType[template.armorType] ?? ArmorType.None;

  return encodeAbiParameters(
    [
      { type: 'tuple', components: [
        { name: 'agiModifier', type: 'int256' },
        { name: 'armorModifier', type: 'int256' },
        { name: 'hpModifier', type: 'int256' },
        { name: 'intModifier', type: 'int256' },
        { name: 'minLevel', type: 'uint256' },
        { name: 'strModifier', type: 'int256' },
        { name: 'armorType', type: 'uint8' },
      ]},
      { type: 'tuple', components: [
        { name: 'minAgility', type: 'int256' },
        { name: 'minIntelligence', type: 'int256' },
        { name: 'minStrength', type: 'int256' },
      ]},
    ],
    [
      {
        agiModifier: BigInt(template.stats.agiModifier),
        armorModifier: BigInt(template.stats.armorModifier),
        hpModifier: BigInt(template.stats.hpModifier),
        intModifier: BigInt(template.stats.intModifier),
        minLevel: BigInt(template.stats.minLevel),
        strModifier: BigInt(template.stats.strModifier),
        armorType: armorTypeValue,
      },
      {
        minAgility: BigInt(template.statRestrictions.minAgility),
        minIntelligence: BigInt(template.statRestrictions.minIntelligence),
        minStrength: BigInt(template.statRestrictions.minStrength),
      },
    ]
  );
}

export function encodeWeaponStats(template: WeaponTemplate): Hex {
  // Field order must match Solidity WeaponStatsData struct:
  // agiModifier, intModifier, hpModifier, maxDamage, minDamage, minLevel, strModifier, effects
  return encodeAbiParameters(
    [
      { type: 'tuple', components: [
        { name: 'agiModifier', type: 'int256' },
        { name: 'intModifier', type: 'int256' },
        { name: 'hpModifier', type: 'int256' },
        { name: 'maxDamage', type: 'int256' },
        { name: 'minDamage', type: 'int256' },
        { name: 'minLevel', type: 'uint256' },
        { name: 'strModifier', type: 'int256' },
        { name: 'effects', type: 'bytes32[]' },
      ]},
      { type: 'tuple', components: [
        { name: 'minAgility', type: 'int256' },
        { name: 'minIntelligence', type: 'int256' },
        { name: 'minStrength', type: 'int256' },
      ]},
    ],
    [
      {
        agiModifier: BigInt(template.stats.agiModifier),
        intModifier: BigInt(template.stats.intModifier),
        hpModifier: BigInt(template.stats.hpModifier),
        maxDamage: BigInt(template.stats.maxDamage),
        minDamage: BigInt(template.stats.minDamage),
        minLevel: BigInt(template.stats.minLevel),
        strModifier: BigInt(template.stats.strModifier),
        effects: template.stats.effects,
      },
      {
        minAgility: BigInt(template.statRestrictions.minAgility),
        minIntelligence: BigInt(template.statRestrictions.minIntelligence),
        minStrength: BigInt(template.statRestrictions.minStrength),
      },
    ]
  );
}

export function encodeConsumableStats(template: ConsumableTemplate): Hex {
  // Field order must match Solidity struct: minDamage, maxDamage, minLevel, effects
  return encodeAbiParameters(
    [
      { type: 'tuple', components: [
        { name: 'minDamage', type: 'int256' },
        { name: 'maxDamage', type: 'int256' },
        { name: 'minLevel', type: 'uint256' },
        { name: 'effects', type: 'bytes32[]' },
      ]},
      { type: 'tuple', components: [
        { name: 'minAgility', type: 'int256' },
        { name: 'minIntelligence', type: 'int256' },
        { name: 'minStrength', type: 'int256' },
      ]},
    ],
    [
      {
        minDamage: BigInt(template.stats.minDamage),
        maxDamage: BigInt(template.stats.maxDamage),
        minLevel: BigInt(template.stats.minLevel),
        effects: template.stats.effects,
      },
      {
        minAgility: BigInt(template.statRestrictions.minAgility),
        minIntelligence: BigInt(template.statRestrictions.minIntelligence),
        minStrength: BigInt(template.statRestrictions.minStrength),
      },
    ]
  );
}
