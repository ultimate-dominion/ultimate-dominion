// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {IWorld} from "@world/IWorld.sol";
import {Mobs, MobDropBonus} from "@codegen/index.sol";
import {MonsterStats} from "@interfaces/Structs.sol";

/**
 * @title SetMobDropBonuses
 * @notice Writes MobDropBonus parallel arrays for each monster.
 *         Each bonus[i] is added to item.dropChance for inventory[i] during drop rolls.
 *
 * Standard signature multiplier: 5x base rate (bonus = base * 4)
 * Basilisk: custom high bonuses for boss loot piñata effect
 *
 * MUST run AFTER UpdateMonsterInventories (bonuses are parallel to inventory arrays).
 *
 * Usage:
 *   forge script script/admin/SetMobDropBonuses.s.sol \
 *     --sig "run(address)" <WORLD_ADDRESS> \
 *     --rpc-url <RPC> --broadcast --skip-simulation
 */
contract SetMobDropBonuses is Script {
    function run(address worldAddress) external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);
        StoreSwitch.setStoreAddress(worldAddress);

        console.log("=== SetMobDropBonuses ===");

        // Read each monster's inventory length to build parallel bonus arrays
        for (uint256 mobId = 1; mobId <= 11; mobId++) {
            uint256[] memory bonuses = _getBonuses(mobId);
            MobDropBonus.setBonuses(mobId, bonuses);
            console.log("  Mob", mobId, "bonuses set, length:", bonuses.length);
        }

        vm.stopBroadcast();
        console.log("=== SetMobDropBonuses Complete ===");
    }

    function _getBonuses(uint256 mobId) internal view returns (uint256[] memory) {
        MonsterStats memory stats = abi.decode(Mobs.getMobStats(mobId), (MonsterStats));
        uint256 len = stats.inventory.length;
        uint256[] memory b = new uint256[](len);
        // Default: all zeros (no bonus). Only set non-zero for signature items.

        if (mobId == 1) return _direRat(b);
        if (mobId == 2) return _fungalShaman(b);
        if (mobId == 3) return _cavernBrute(b);
        if (mobId == 4) return _crystalElemental(b);
        if (mobId == 5) return _ironhideTroll(b);
        if (mobId == 6) return _phaseSpider(b);
        if (mobId == 7) return _bonecaster(b);
        if (mobId == 8) return _rockGolem(b);
        if (mobId == 9) return _paleStalker(b);
        if (mobId == 10) return _duskDrake(b);
        if (mobId == 11) return _basilisk(b);

        return b;
    }

    // =========================================================================
    //  BONUS ARRAYS (parallel to inventory from UpdateMonsterInventories)
    //  Signature formula: 5x base → bonus = base * 4
    //  R2 sig: base 10, bonus 40    → effective 50
    //  R3 sig: base 2, bonus 8      → effective 10
    //  R4 sig: base 1, bonus 4      → effective 5
    //  Consumable sig: base * 4     → effective 5x base
    // =========================================================================

    // Mob 1: Dire Rat — 16 items
    // [6] Dire Rat Fang (R3 sig): +8
    function _direRat(uint256[] memory b) internal pure returns (uint256[] memory) {
        b[6] = 8;   // Dire Rat Fang
        return b;
    }

    // Mob 2: Fungal Shaman — 17 items
    // [6] Sporecap Wand (R2 sig): +40
    // [7] Spore Cloud (consumable sig, base 4): +16
    function _fungalShaman(uint256[] memory b) internal pure returns (uint256[] memory) {
        b[6] = 40;  // Sporecap Wand
        b[7] = 16;  // Spore Cloud
        return b;
    }

    // Mob 3: Cavern Brute — 17 items
    // [6] Notched Cleaver (R2 sig): +40
    function _cavernBrute(uint256[] memory b) internal pure returns (uint256[] memory) {
        b[6] = 40;  // Notched Cleaver
        return b;
    }

    // Mob 4: Crystal Elemental — 19 items
    // [7] Crystal Shard (R2 sig): +40
    function _crystalElemental(uint256[] memory b) internal pure returns (uint256[] memory) {
        b[7] = 40;  // Crystal Shard
        return b;
    }

    // Mob 5: Ironhide Troll — 28 items
    // [8] Gnarled Cudgel (R3 sig): +8
    // [9] Trollhide Cleaver (R4 sig): +4
    // [10] Bloodrage Tonic (consumable sig, base 8): +32
    // [11] Trollblood Ale (consumable sig, base 8): +32
    function _ironhideTroll(uint256[] memory b) internal pure returns (uint256[] memory) {
        b[8] = 8;   // Gnarled Cudgel
        b[9] = 4;   // Trollhide Cleaver
        b[10] = 32; // Bloodrage Tonic
        b[11] = 32; // Trollblood Ale
        return b;
    }

    // Mob 6: Phase Spider — 28 items
    // [7] Webspinner Bow (R2 sig): +40
    // [8] Spider Silk Wraps (R2 sig): +40
    // [9] Phasefang (R4 sig): +4
    // [10] Venom Vial (consumable sig, base 4): +16
    function _phaseSpider(uint256[] memory b) internal pure returns (uint256[] memory) {
        b[7] = 40;  // Webspinner Bow
        b[8] = 40;  // Spider Silk Wraps
        b[9] = 4;   // Phasefang
        b[10] = 16; // Venom Vial
        return b;
    }

    // Mob 7: Bonecaster — 30 items
    // [8] Bone Staff (R3 sig): +8
    // No cross-drop bonus for Sporecap Wand [9] (base rate only)
    function _bonecaster(uint256[] memory b) internal pure returns (uint256[] memory) {
        b[8] = 8;   // Bone Staff
        return b;
    }

    // Mob 8: Rock Golem — 33 items
    // [10] Stone Maul (R3 sig): +8
    // [11] Carved Stone Plate (R3 sig): +8
    // [12] Stoneskin Salve (consumable sig, base 8): +32
    // No cross-drop bonus for Gnarled Cudgel [13]
    function _rockGolem(uint256[] memory b) internal pure returns (uint256[] memory) {
        b[10] = 8;  // Stone Maul
        b[11] = 8;  // Carved Stone Plate
        b[12] = 32; // Stoneskin Salve
        return b;
    }

    // Mob 9: Pale Stalker — 32 items
    // [9] Darkwood Bow (R3 sig): +8
    // [10] Stalker's Cloak (R3 sig): +8
    // [11] Flashpowder (consumable sig, base 4): +16
    // No cross-drop bonus for Webspinner Bow [12] or Dire Rat Fang [13]
    function _paleStalker(uint256[] memory b) internal pure returns (uint256[] memory) {
        b[9] = 8;   // Darkwood Bow
        b[10] = 8;  // Stalker's Cloak
        b[11] = 16; // Flashpowder
        return b;
    }

    // Mob 10: Dusk Drake — 39 items
    // [14] Smoldering Rod (R3 sig): +8
    // [15] Scorched Scale Vest (R3 sig): +8
    // [16] Drakescale Staff (R4 sig): +4
    // [17] Drake's Cowl (R4 sig): +4
    // No cross-drop bonus for Bone Staff [18]
    function _duskDrake(uint256[] memory b) internal pure returns (uint256[] memory) {
        b[14] = 8;  // Smoldering Rod
        b[15] = 8;  // Scorched Scale Vest
        b[16] = 4;  // Drakescale Staff
        b[17] = 4;  // Drake's Cowl
        return b;
    }

    // Mob 11: Basilisk — 23 items (boss, custom bonuses)
    // Boss loot piñata: high bonuses so every kill is rewarding
    // [0] Basilisk Fangs: combat, no bonus
    // [1] Petrifying Gaze: combat, no bonus
    // [2] Trollhide Cleaver (R4): +499 → effective 500 (5%)
    // [3] Phasefang (R4): +499 → effective 500 (5%)
    // [4] Drakescale Staff (R4): +499 → effective 500 (5%)
    // [5] Drake's Cowl (R4): +499 → effective 500 (5%)
    // [6] Carved Stone Plate (R3): +1498 → effective 1500 (15%)
    // [7] Stalker's Cloak (R3): +1498 → effective 1500 (15%)
    // [8] Scorched Scale Vest (R3): +1498 → effective 1500 (15%)
    // [9] Minor HP (base 40): +4960 → effective 5000 (50%)
    // [10] HP (base 40): +4960 → effective 5000 (50%)
    // [11] GHP (base 10): +4990 → effective 5000 (50%)
    // [12] Antidote (base 40): +2960 → effective 3000 (30%)
    // [13] Fortifying Stew (base 20): +2980 → effective 3000 (30%)
    // [14] Quickening Berries (base 20): +2980 → effective 3000 (30%)
    // [15] Focusing Tea (base 20): +2980 → effective 3000 (30%)
    // [16] Bloodrage Tonic (base 8): +1992 → effective 2000 (20%)
    // [17] Stoneskin Salve (base 8): +1992 → effective 2000 (20%)
    // [18] Trollblood Ale (base 8): +1992 → effective 2000 (20%)
    // [19] Venom Vial (base 4): +1996 → effective 2000 (20%)
    // [20] Spore Cloud (base 4): +1996 → effective 2000 (20%)
    // [21] Sapping Poison (base 4): +1996 → effective 2000 (20%)
    // [22] Flashpowder (base 4): +1996 → effective 2000 (20%)
    function _basilisk(uint256[] memory b) internal pure returns (uint256[] memory) {
        // Gear
        b[2] = 499;   // Trollhide Cleaver
        b[3] = 499;   // Phasefang
        b[4] = 499;   // Drakescale Staff
        b[5] = 499;   // Drake's Cowl
        b[6] = 1498;  // Carved Stone Plate
        b[7] = 1498;  // Stalker's Cloak
        b[8] = 1498;  // Scorched Scale Vest
        // Consumables
        b[9] = 4960;  // Minor HP
        b[10] = 4960; // HP
        b[11] = 4990; // GHP
        b[12] = 2960; // Antidote
        b[13] = 2980; // Fortifying Stew
        b[14] = 2980; // Quickening Berries
        b[15] = 2980; // Focusing Tea
        b[16] = 1992; // Bloodrage Tonic
        b[17] = 1992; // Stoneskin Salve
        b[18] = 1992; // Trollblood Ale
        b[19] = 1996; // Venom Vial
        b[20] = 1996; // Spore Cloud
        b[21] = 1996; // Sapping Poison
        b[22] = 1996; // Flashpowder
        return b;
    }
}
