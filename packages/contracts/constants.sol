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

// Badge requirements
uint256 constant ADVENTURER_BADGE_LEVEL = 3;

string constant ERC721_NAME = "UDCharacters";
string constant ERC721_SYMBOL = "UDC";
string constant TOKEN_URI = "ipfs://";

uint256 constant DEFAULT_MAX_TURNS = 15;
uint256 constant DEFENSE_MODIFIER = 1 ether;
uint256 constant ATTACK_MODIFIER = 1.2 ether;
// the amount crits damage is multiplied by
uint256 constant CRIT_MULTIPLIER = 2;
// the character's stats are divided by PROFICIENCY_DENOMINATOR when applying stat bonuses
int256 constant PROFICIENCY_DENOMINATOR = 20;

int256 constant STARTING_HIT_PROBABILITY = 90;
uint256 constant DEFENDER_HIT_DAMPENER = 30;
uint256 constant ATTACKER_HIT_DAMPENER = 95;

//Gold Drop constants
uint256 constant BASE_GOLD_DROP = 5 ether; //

// LEVELING - Diminishing returns system
// Stat points: +1/level (1-10), +1/2 levels (11-50), +1/5 levels (51-100)
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
uint256 constant MAX_LEVEL = 100;

// Class multipliers (stored as basis points: 1000 = 100%, 1100 = 110%)
uint256 constant CLASS_MULTIPLIER_BASE = 1000;  // 100% base
uint256 constant SESSION_TIMEOUT = 10 minutes;
uint256 constant PVP_GOLD_DENOMINATOR = 2;

uint256 constant PVP_TIMER = 30 seconds;
uint256 constant MAX_MONSTERS = 20;
uint256 constant MOVE_COOLDOWN = 1; // 1 second between moves
uint256 constant MAX_PARTY_SIZE = 10;

// Fragment system constants
uint16 constant FRAGMENT_CENTER_X = 5;
uint16 constant FRAGMENT_CENTER_Y = 5;
uint16 constant TAL_SHOP_X = 9;
uint16 constant TAL_SHOP_Y = 9;

// Fragment-triggering mob IDs (assigned at deploy time based on creation order)
// These must match the mob IDs assigned when zone content is loaded
uint256 constant DARK_WISP_MOB_ID = 13;
uint256 constant VOID_WHISPER_MOB_ID = 22;
uint256 constant LICH_ACOLYTE_MOB_ID = 25;

// GameDelegation constants
bytes16 constant GAME_DELEGATION_NAME = "GameDelegation";

// GasStation constants
uint256 constant DEFAULT_ETH_PER_GOLD = 1e12;         // 0.000001 ETH per Gold (1 Gold = 1e18 units)
uint256 constant DEFAULT_MAX_GOLD_PER_SWAP = 500e18;   // 500 Gold max per swap
uint256 constant DEFAULT_GAS_COOLDOWN = 60;            // 60 seconds between swaps
uint256 constant GAS_STATION_MIN_LEVEL = 3;            // Must be level 3+ to use GasStation
