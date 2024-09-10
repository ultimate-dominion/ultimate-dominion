// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

bytes14 constant GOLD_NAMESPACE = "Gold";
bytes14 constant CHARACTERS_NAMESPACE = "Characters";
bytes14 constant ITEMS_NAMESPACE = "Items";
bytes14 constant WORLD_NAMESPACE = "UD";

string constant ERC721_NAME = "UDCharacters";
string constant ERC721_SYMBOL = "UDC";
string constant TOKEN_URI = "ipfs://";

uint256 constant DEFAULT_MAX_TURNS = 15;
uint256 constant TO_HIT_MODIFIER = 1.4 ether;
uint256 constant DEFENSE_MODIFIER = 1 ether;
uint256 constant ATTACK_MODIFIER = 1 ether;
// the amount crits damage is multiplied by
uint256 constant CRIT_MULTIPLIER = 4;
// attack roll has to be CRIT_MODIFIER times greater than the defense roll in order to crit
uint256 constant CRIT_MODIFIER = 10;
// the character's stats are divided by STAT_MODIFIER when applying stat bonuses
int256 constant STAT_MODIFIER = 200;

//Gold Drop constants
uint256 constant BASE_GOLD_DROP = 1e17; //

// LEVELING
int256 constant BASE_HP_GAIN = 1;
int256 constant ABILITY_POINTS_PER_LEVEL = 2;
