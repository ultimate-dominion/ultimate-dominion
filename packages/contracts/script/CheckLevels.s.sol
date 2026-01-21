// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Script.sol";
import {Levels} from "@codegen/index.sol";

contract CheckLevels is Script {
    function run() external view {
        console.log("Level 0 exp:", Levels.get(0));
        console.log("Level 1 exp:", Levels.get(1));
        console.log("Level 10 exp:", Levels.get(10));
        console.log("Level 50 exp:", Levels.get(50));
        console.log("Level 99 exp:", Levels.get(99));
        console.log("Level 100 exp:", Levels.get(100));
    }
}
