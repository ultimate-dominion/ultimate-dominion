// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Script.sol";
import {IWorld} from "@world/IWorld.sol";
import {ClassMultipliers, Stats, StatsData} from "@codegen/index.sol";
import {AdvancedClass, Classes, PowerSource, Race, ArmorType} from "@codegen/common.sol";

contract TestAdvancedClass is Script {
    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address player = vm.addr(privateKey);

        vm.startBroadcast(privateKey);

        IWorld world = IWorld(0xd44c31e8442D546aCAB16ea121Ffa00380fca7CA);

        // Mint a character
        bytes32 characterId = world.UD__mintCharacter(player, bytes32("TestChar"), "test_uri");
        console.log("Minted character:");
        console.logBytes32(characterId);

        // Roll stats
        world.UD__rollStats(bytes32(uint256(12345)), characterId, Classes.Warrior);
        console.log("Stats rolled");

        // Get stats
        StatsData memory stats = Stats.get(characterId);
        console.log("Level:", stats.level);
        console.log("Strength:", uint256(int256(stats.strength)));
        console.log("hasSelectedAdvancedClass:", stats.hasSelectedAdvancedClass);

        // Check multipliers before selection (should be 0)
        uint256 physBefore = ClassMultipliers.getPhysicalDamageMultiplier(characterId);
        console.log("Physical multiplier before:", physBefore);

        // Set character to level 10 to allow class selection
        stats.level = 10;
        stats.experience = 1000;
        Stats.set(characterId, stats);
        console.log("Set level to 10");

        // Select Warrior class
        world.UD__selectAdvancedClass(characterId, AdvancedClass.Warrior);
        console.log("Selected Warrior class");

        // Check multipliers after selection
        uint256 physAfter = ClassMultipliers.getPhysicalDamageMultiplier(characterId);
        uint256 spellAfter = ClassMultipliers.getSpellDamageMultiplier(characterId);
        uint256 healAfter = ClassMultipliers.getHealingMultiplier(characterId);
        uint256 critAfter = ClassMultipliers.getCritDamageMultiplier(characterId);
        uint256 hpAfter = ClassMultipliers.getMaxHpMultiplier(characterId);

        console.log("=== Warrior Multipliers ===");
        console.log("Physical:", physAfter);  // Should be 1100 (110%)
        console.log("Spell:", spellAfter);     // Should be 1000 (100%)
        console.log("Healing:", healAfter);    // Should be 1000 (100%)
        console.log("Crit:", critAfter);       // Should be 1000 (100%)
        console.log("MaxHP:", hpAfter);        // Should be 1000 (100%)

        // Verify the class was set
        StatsData memory finalStats = Stats.get(characterId);
        console.log("Advanced class:", uint8(finalStats.advancedClass));
        console.log("hasSelectedAdvancedClass:", finalStats.hasSelectedAdvancedClass);

        vm.stopBroadcast();
    }
}
