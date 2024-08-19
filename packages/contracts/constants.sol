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
uint256 constant TO_HIT_MODIFIER = 1;
uint256 constant DEFENSE_MODIFIER = 1;
uint256 constant ATTACK_MODIFIER = 1;
uint256 constant CRIT_MODIFIER = 2;

//Gold Drop constants
uint256 constant BASE_GOLD_DROP = 1e15; //

// LEVELING
uint256 constant BASE_HP_GAIN = 1;
uint256 constant ABILITY_POINTS_PER_LEVEL = 2;

/////////  RNG Constants
// Sets user seed as 0 to so that users don't have to pass it.
uint256 constant _USER_SEED_PLACEHOLDER = 0;
// Gives a fixed buffer so that some logic differ in the callback slightly raising gas used will be supported.
uint32 constant _GAS_FOR_CALLBACK_OVERHEAD = 30_000;
// Dummy randomness for estimating gas of randomness callback.
uint256 constant _RANDOMNESS_PLACEHOLDER =
    103921425973949831153159651530394295952228049817797655588722524414385831936256;
uint32 constant _MAX_GAS_LIMIT = 2000000;
