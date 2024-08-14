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
uint256 constant TO_HIT_MODIFIER = 100_000;
uint256 constant DEFENSE_MODIFIER = 100_000;
uint256 constant ATTACK_MODIFIER = 100_000;
uint256 constant CRIT_MODIFIER = 2;

//Gold Drop constants
uint256 constant BASE_GOLD_DROP = 1e15; //

// LEVELING
uint256 constant BASE_HP_GAIN = 1;
uint256 constant ABILITY_POINTS_PER_LEVEL = 2;
