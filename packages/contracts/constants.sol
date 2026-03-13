// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

bytes14 constant GOLD_NAMESPACE = "Gold";
bytes14 constant CHARACTERS_NAMESPACE = "Characters";
bytes14 constant ITEMS_NAMESPACE = "Items";
bytes14 constant BADGES_NAMESPACE = "Badges";
bytes14 constant FRAGMENTS_NAMESPACE = "Fragments";
bytes14 constant WORLD_NAMESPACE = "UD";

// Badge Token IDs
uint256 constant BADGE_ADVENTURER = 1;  // Unlocks chat at level 3
uint256 constant BADGE_FOUNDER = 50;    // Limited time launch badge
uint256 constant BADGE_ZONE_CONQUEROR_BASE = 100; // Base for zone conqueror badges
uint256 constant BADGE_ZONE_FRAGMENT_BASE = 200;  // +zoneId → Dark Cave = 201, Zone 2 = 202, etc.

// Fragment rewards
uint256 constant FRAGMENT_XP_REWARD = 1;

// Badge requirements
uint256 constant ADVENTURER_BADGE_LEVEL = 3;
uint256 constant MAX_ZONE_CONQUEROR_BADGES = 10; // Top 10 per zone

// Zone IDs
uint256 constant ZONE_DARK_CAVE = 1;

string constant ERC721_NAME = "UDCharacters";
string constant ERC721_SYMBOL = "UDC";
string constant TOKEN_URI = "ipfs://";

// Shared key for the spawned-player counter (all systems must use the same key)
address constant PLAYER_COUNTER_KEY = address(1);

// Stable key for the character token counter (must NOT be address(this) — that resets on system upgrades)
address constant CHARACTER_TOKEN_COUNTER_KEY = address(2);

uint256 constant DEFAULT_MAX_TURNS = 30;
uint256 constant DEFENSE_MODIFIER = 1 ether;
uint256 constant ATTACK_MODIFIER = 1.2 ether;
uint256 constant AGI_ATTACK_MODIFIER = 1.0 ether;
uint256 constant EVASION_CAP = 35;
uint256 constant DOUBLE_STRIKE_CAP = 40;
uint256 constant DOUBLE_STRIKE_DAMAGE_DIVISOR = 2;
// the amount crits damage is multiplied by
uint256 constant CRIT_MULTIPLIER = 2;
// the character's stats are divided by PROFICIENCY_DENOMINATOR when applying stat bonuses
int256 constant PROFICIENCY_DENOMINATOR = 20;

int256 constant STARTING_HIT_PROBABILITY = 90;
uint256 constant DEFENDER_HIT_DAMPENER = 30;
uint256 constant ATTACKER_HIT_DAMPENER = 95;

//Gold Drop constants
uint256 constant BASE_GOLD_DROP = 3 ether;

// LEVELING - Diminishing returns system
// Stat points: +2/level (1-10), +1/2 levels (11-50), +1/5 levels (51-100)
// HP: +2/level (1-10), +1/level (11-50), +1/2 levels (51-100)
int256 constant BASE_HP_GAIN_EARLY = 2;      // Levels 1-10
int256 constant BASE_HP_GAIN_MID = 1;        // Levels 11-50
int256 constant BASE_HP_GAIN_LATE = 1;       // Levels 51-100 (every 2 levels)
int256 constant STAT_POINTS_EARLY = 1;       // Levels 1-10 (every level)
int256 constant STAT_POINTS_MID = 1;         // Levels 11-50 (every 2 levels)
int256 constant STAT_POINTS_LATE = 1;        // Levels 51-100 (every 5 levels)
uint256 constant EARLY_GAME_CAP = 10;
uint256 constant MID_GAME_CAP = 50;
uint256 constant EXP_MODIFIER = 2;
uint256 constant MAX_LEVEL = 10;
uint256 constant POWER_SOURCE_BONUS_LEVEL = 5;

// Class multipliers (stored as basis points: 1000 = 100%, 1100 = 110%)
uint256 constant CLASS_MULTIPLIER_BASE = 1000;  // 100% base
uint256 constant SESSION_TIMEOUT = 10 minutes;
uint256 constant PVP_GOLD_DENOMINATOR = 2;
uint256 constant PVP_BASE_XP = 1; // PvP XP = level^2 * 1 (scaled /75 to match /100 XP rescale)

uint256 constant PVP_TIMER = 30 seconds;
uint256 constant MAX_MONSTERS = 20;
uint256 constant MOVE_COOLDOWN = 0; // Cooldown enforced client-side via isMovePending mutex + debounce
uint256 constant MAX_PARTY_SIZE = 10;

// Fragment system constants
uint16 constant FRAGMENT_CENTER_X = 5;
uint16 constant FRAGMENT_CENTER_Y = 5;
uint16 constant TAL_SHOP_X = 9;
uint16 constant TAL_SHOP_Y = 9;

// Fragment-triggering mob IDs (assigned at deploy time based on creation order)
// These must match the mob IDs assigned when zone content is loaded
// Dark Cave roster (10 monsters): 1=Cave Rat, 2=Fungal Shaman, 3=Cavern Brute,
// 4=Crystal Elemental, 5=Cave Troll, 6=Phase Spider, 7=Lich Acolyte,
// 8=Stone Giant, 9=Shadow Stalker, 10=Shadow Dragon
uint256 constant CRYSTAL_ELEMENTAL_MOB_ID = 4;   // Fragment IV: Souls That Linger
uint256 constant LICH_ACOLYTE_MOB_ID = 7;         // Fragment VI: Death of the Death God
uint256 constant SHADOW_STALKER_MOB_ID = 9;       // Fragment VII: Betrayer's Truth

// GameDelegation constants
bytes16 constant GAME_DELEGATION_NAME = "GameDelegation";

// Elite monster constants
uint256 constant ELITE_CHANCE = 15;           // 15% spawn chance
uint256 constant ELITE_STAT_MULTIPLIER = 130; // 1.3x STR/AGI/INT
uint256 constant ELITE_HP_MULTIPLIER = 150;   // 1.5x HP
uint256 constant ELITE_REWARD_MULTIPLIER = 150; // 1.5x XP/gold
uint256 constant ELITE_DROP_BONUS = 1500;     // +15% additive drop chance (basis points)
uint256 constant STAT_VARIANCE_PCT = 10;      // ±10% variance on all spawns

// Flashpowder / Smoke Cloak — flee without gold penalty
bytes8 constant SMOKE_CLOAK_EFFECT_STAT_ID = 0x5db83b18b4d1bdc3; // keccak256(abi.encode("smoke_cloak"))[:8]

// Character creation
uint256 constant MAX_STAT_ROLLS = 4; // 1 initial roll + 3 re-rolls

// GasStation constants
uint256 constant DEFAULT_ETH_PER_GOLD = 1e12;         // 0.000001 ETH per Gold (1 Gold = 1e18 units)
uint256 constant DEFAULT_MAX_GOLD_PER_SWAP = 500e18;   // 500 Gold max per swap
uint256 constant DEFAULT_GAS_COOLDOWN = 60;            // 60 seconds between swaps
uint256 constant GAS_STATION_MIN_LEVEL = 3;            // Must be level 3+ to use GasStation

// Uniswap / WETH constants (Base Mainnet)
address constant BASE_WETH = 0x4200000000000000000000000000000000000006;
address constant BASE_SWAP_ROUTER = 0x2626664c2603336E57B271c5C0b26F421741e481;
uint24 constant DEFAULT_POOL_FEE = 10000;              // 1% fee tier for exotic pairs
uint256 constant DEFAULT_GOLD_PER_GAS_CHARGE = 1e18;   // 1 gold per relayer gas charge
uint256 constant UNISWAP_MIN_OUTPUT = 1;               // Accept any output — gas swaps are tiny
