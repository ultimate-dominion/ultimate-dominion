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
        // mobId 11 is the shop NPC — skip it
        for (uint256 mobId = 1; mobId <= 12; mobId++) {
            if (mobId == 11) continue;
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
        if (mobId == 12) return _basilisk(b);

        return b;
    }

    // =========================================================================
    //  BONUS ARRAYS (parallel to inventory from UpdateMonsterInventories)
    //  All values in /100000 scale (PveRewardSystem rolls % 100000)
    //  Signature formula: 5x base → bonus = base * 4
    //  R2 sig: base 100, bonus 400   → effective 500  (0.50%)
    //  R3 sig: base 3,   bonus 12    → effective 15   (0.015%)
    //  R4 sig: base 2,   bonus 8     → effective 10   (0.010%)
    //  Consumable sig: base * 4      → effective 5x base
    // =========================================================================

    // Mob 1: Dire Rat — 16 items
    // [6] Dire Rat Fang (R3 sig): +12
    function _direRat(uint256[] memory b) internal pure returns (uint256[] memory) {
        b[6] = 12;    // Dire Rat Fang
        return b;
    }

    // Mob 2: Fungal Shaman — 17 items
    // [6] Sporecap Wand (R2 sig): +400
    // [7] Spore Cloud (consumable sig, base 40): +160
    function _fungalShaman(uint256[] memory b) internal pure returns (uint256[] memory) {
        b[6] = 400;   // Sporecap Wand
        b[7] = 160;   // Spore Cloud
        return b;
    }

    // Mob 3: Cavern Brute — 17 items
    // [6] Notched Cleaver (R2 sig): +400
    function _cavernBrute(uint256[] memory b) internal pure returns (uint256[] memory) {
        b[6] = 400;   // Notched Cleaver
        return b;
    }

    // Mob 4: Crystal Elemental — 19 items
    // [7] Crystal Shard (R2 sig): +400
    function _crystalElemental(uint256[] memory b) internal pure returns (uint256[] memory) {
        b[7] = 400;   // Crystal Shard
        return b;
    }

    // Mob 5: Ironhide Troll — 28 items
    // [8] Gnarled Cudgel (R3 sig): +12
    // [9] Trollhide Cleaver (R4 sig): +8
    // [10] Bloodrage Tonic (consumable sig, base 80): +320
    // [11] Trollblood Ale (consumable sig, base 80): +320
    function _ironhideTroll(uint256[] memory b) internal pure returns (uint256[] memory) {
        b[8] = 12;    // Gnarled Cudgel
        b[9] = 8;     // Trollhide Cleaver
        b[10] = 320;  // Bloodrage Tonic
        b[11] = 320;  // Trollblood Ale
        return b;
    }

    // Mob 6: Phase Spider — 28 items
    // [7] Webspinner Bow (R2 sig): +400
    // [8] Spider Silk Wraps (R2 sig): +400
    // [9] Phasefang (R4 sig): +8
    // [10] Venom Vial (consumable sig, base 40): +160
    function _phaseSpider(uint256[] memory b) internal pure returns (uint256[] memory) {
        b[7] = 400;   // Webspinner Bow
        b[8] = 400;   // Spider Silk Wraps
        b[9] = 8;     // Phasefang
        b[10] = 160;  // Venom Vial
        return b;
    }

    // Mob 7: Bonecaster — 30 items
    // [8] Bone Staff (R3 sig): +12
    // No cross-drop bonus for Sporecap Wand [9] (base rate only)
    function _bonecaster(uint256[] memory b) internal pure returns (uint256[] memory) {
        b[8] = 12;    // Bone Staff
        return b;
    }

    // Mob 8: Rock Golem — 33 items
    // [10] Stone Maul (R3 sig): +12
    // [11] Carved Stone Plate (R3 sig): +12
    // [12] Stoneskin Salve (consumable sig, base 80): +320
    // No cross-drop bonus for Gnarled Cudgel [13]
    function _rockGolem(uint256[] memory b) internal pure returns (uint256[] memory) {
        b[10] = 12;   // Stone Maul
        b[11] = 12;   // Carved Stone Plate
        b[12] = 320;  // Stoneskin Salve
        return b;
    }

    // Mob 9: Pale Stalker — 32 items
    // [9] Darkwood Bow (R3 sig): +12
    // [10] Stalker's Cloak (R3 sig): +12
    // [11] Flashpowder (consumable sig, base 40): +160
    // No cross-drop bonus for Webspinner Bow [12] or Dire Rat Fang [13]
    function _paleStalker(uint256[] memory b) internal pure returns (uint256[] memory) {
        b[9] = 12;    // Darkwood Bow
        b[10] = 12;   // Stalker's Cloak
        b[11] = 160;  // Flashpowder
        return b;
    }

    // Mob 10: Dusk Drake — 39 items
    // [14] Smoldering Rod (R3 sig): +12
    // [15] Scorched Scale Vest (R3 sig): +12
    // [16] Drakescale Staff (R4 sig): +8
    // [17] Drake's Cowl (R3 sig): +12
    // No cross-drop bonus for Bone Staff [18]
    function _duskDrake(uint256[] memory b) internal pure returns (uint256[] memory) {
        b[14] = 12;   // Smoldering Rod
        b[15] = 12;   // Scorched Scale Vest
        b[16] = 8;    // Drakescale Staff
        b[17] = 12;   // Drake's Cowl
        return b;
    }

    // Mob 12: Basilisk — 23 items (boss, custom bonuses)
    // Boss loot piñata: high bonuses so every kill is rewarding
    // All values /100000. Effective %s unchanged from previous /10000 scale.
    // [0] Basilisk Fangs: combat, no bonus
    // [1] Petrifying Gaze: combat, no bonus
    // [2] Trollhide Cleaver (R4): +4998 → effective 5000 (5%)
    // [3] Phasefang (R4): +4998 → effective 5000 (5%)
    // [4] Drakescale Staff (R4): +4998 → effective 5000 (5%)
    // [5] Drake's Cowl (R3): +14997 → effective 15000 (15%)
    // [6] Carved Stone Plate (R3): +14997 → effective 15000 (15%)
    // [7] Stalker's Cloak (R3): +14997 → effective 15000 (15%)
    // [8] Scorched Scale Vest (R3): +14997 → effective 15000 (15%)
    // [9] Minor HP (base 400): +49600 → effective 50000 (50%)
    // [10] HP (base 400): +49600 → effective 50000 (50%)
    // [11] GHP (base 100): +49900 → effective 50000 (50%)
    // [12] Antidote (base 400): +29600 → effective 30000 (30%)
    // [13] Fortifying Stew (base 200): +29800 → effective 30000 (30%)
    // [14] Quickening Berries (base 200): +29800 → effective 30000 (30%)
    // [15] Focusing Tea (base 200): +29800 → effective 30000 (30%)
    // [16] Bloodrage Tonic (base 80): +19920 → effective 20000 (20%)
    // [17] Stoneskin Salve (base 80): +19920 → effective 20000 (20%)
    // [18] Trollblood Ale (base 80): +19920 → effective 20000 (20%)
    // [19] Venom Vial (base 40): +19960 → effective 20000 (20%)
    // [20] Spore Cloud (base 40): +19960 → effective 20000 (20%)
    // [21] Sapping Poison (base 40): +19960 → effective 20000 (20%)
    // [22] Flashpowder (base 40): +19960 → effective 20000 (20%)
    function _basilisk(uint256[] memory b) internal pure returns (uint256[] memory) {
        // Gear
        b[2] = 4998;    // Trollhide Cleaver
        b[3] = 4998;    // Phasefang
        b[4] = 4998;    // Drakescale Staff
        b[5] = 14997;   // Drake's Cowl
        b[6] = 14997;   // Carved Stone Plate
        b[7] = 14997;   // Stalker's Cloak
        b[8] = 14997;   // Scorched Scale Vest
        // Consumables
        b[9] = 49600;   // Minor HP
        b[10] = 49600;  // HP
        b[11] = 49900;  // GHP
        b[12] = 29600;  // Antidote
        b[13] = 29800;  // Fortifying Stew
        b[14] = 29800;  // Quickening Berries
        b[15] = 29800;  // Focusing Tea
        b[16] = 19920;  // Bloodrage Tonic
        b[17] = 19920;  // Stoneskin Salve
        b[18] = 19920;  // Trollblood Ale
        b[19] = 19960;  // Venom Vial
        b[20] = 19960;  // Spore Cloud
        b[21] = 19960;  // Sapping Poison
        b[22] = 19960;  // Flashpowder
        return b;
    }
}
