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
    //
    //  NEW BASE RATES (items.json): R2=1500, R3=100, R4=15
    //  L1-L4: no R3/R4 in inventory, R2 at base rate (1.5% per item)
    //  L5-L7: R3 gets +300 "journey bump" bonus (effective 400 = 0.4%)
    //  L8-L9: R3 gets +100 taper bonus (effective 200 = 0.2%)
    //  L10:   R3 at base rate only (100 = 0.1%), endgame stays rare
    //  R4:    base rate only (15 = 0.015%), no bonus except Basilisk
    //  Consumable sigs: 5x base (unchanged)
    // =========================================================================

    // Mob 1: Dire Rat — 19 items (expanded: +3 R2)
    // No bonuses — R2 at base 1500 is enough for L1
    function _direRat(uint256[] memory b) internal pure returns (uint256[] memory) {
        return b;
    }

    // Mob 2: Fungal Shaman — 19 items (expanded: +2 R2)
    // [9] Spore Cloud (consumable sig, base 40): +160
    function _fungalShaman(uint256[] memory b) internal pure returns (uint256[] memory) {
        b[9] = 160;   // Spore Cloud
        return b;
    }

    // Mob 3: Cavern Brute — 19 items (expanded: +2 R2)
    // No bonuses — R2 at base 1500
    function _cavernBrute(uint256[] memory b) internal pure returns (uint256[] memory) {
        return b;
    }

    // Mob 4: Crystal Elemental — 21 items (expanded: +2 R2)
    // No bonuses — R2 at base 1500
    function _crystalElemental(uint256[] memory b) internal pure returns (uint256[] memory) {
        return b;
    }

    // Mob 5: Ironhide Troll — 31 items (expanded: +3 R2, +1 R3)
    // [11] Gnarled Cudgel (R3): +300 journey bump
    // [12] Stone Maul (R3): +300 journey bump
    // [14] Bloodrage Tonic (consumable sig, base 80): +320
    // [15] Trollblood Ale (consumable sig, base 80): +320
    function _ironhideTroll(uint256[] memory b) internal pure returns (uint256[] memory) {
        b[11] = 300;  // Gnarled Cudgel — journey bump
        b[12] = 300;  // Stone Maul — journey bump
        b[14] = 320;  // Bloodrage Tonic
        b[15] = 320;  // Trollblood Ale
        return b;
    }

    // Mob 6: Phase Spider — 31 items (expanded: +1 R2, +2 R3)
    // [10] Darkwood Bow (R3): +300 journey bump
    // [11] Dire Rat Fang (R3): +300 journey bump
    // [13] Venom Vial (consumable sig, base 40): +160
    function _phaseSpider(uint256[] memory b) internal pure returns (uint256[] memory) {
        b[10] = 300;  // Darkwood Bow — journey bump
        b[11] = 300;  // Dire Rat Fang — journey bump
        b[13] = 160;  // Venom Vial
        return b;
    }

    // Mob 7: Bonecaster — 32 items (expanded: +1 R3, +1 R4)
    // [8] Bone Staff (R3): +200 (L7 still elevated)
    // [9] Smoldering Rod (R3): +200
    function _bonecaster(uint256[] memory b) internal pure returns (uint256[] memory) {
        b[8] = 200;   // Bone Staff
        b[9] = 200;   // Smoldering Rod
        return b;
    }

    // Mob 8: Rock Golem — 34 items (expanded: +1 R4)
    // [10] Stone Maul (R3 sig): +100 taper
    // [11] Carved Stone Plate (R3 sig): +100 taper
    // [12] Stoneskin Salve (consumable sig, base 80): +320
    function _rockGolem(uint256[] memory b) internal pure returns (uint256[] memory) {
        b[10] = 100;  // Stone Maul — taper
        b[11] = 100;  // Carved Stone Plate — taper
        b[12] = 320;  // Stoneskin Salve
        return b;
    }

    // Mob 9: Pale Stalker — 33 items (expanded: +1 R4)
    // [9] Darkwood Bow (R3 sig): +100 taper
    // [10] Stalker's Cloak (R3 sig): +100 taper
    // [11] Flashpowder (consumable sig, base 40): +160
    function _paleStalker(uint256[] memory b) internal pure returns (uint256[] memory) {
        b[9] = 100;   // Darkwood Bow — taper
        b[10] = 100;  // Stalker's Cloak — taper
        b[11] = 160;  // Flashpowder
        return b;
    }

    // Mob 10: Dusk Drake — 39 items (unchanged inventory)
    // R3 at BASE RATE ONLY (100 = 0.1%) — endgame stays rare, zone 1 winds down
    // No R3 bonuses. No R4 bonuses.
    function _duskDrake(uint256[] memory b) internal pure returns (uint256[] memory) {
        // No bonuses — endgame rares are rare
        return b;
    }

    // Mob 12: Basilisk — 23 items (boss, custom bonuses)
    // Boss loot piñata: high bonuses so every kill is rewarding
    // Effective rates preserved from previous tuning, recalculated for new base rates
    // NEW BASE: R3=100, R4=15, consumables unchanged
    // [0] Basilisk Fangs: combat, no bonus
    // [1] Petrifying Gaze: combat, no bonus
    // [2] Trollhide Cleaver (R4 base 15): +4985 → effective 5000 (5%)
    // [3] Phasefang (R4 base 15): +4985 → effective 5000 (5%)
    // [4] Drakescale Staff (R4 base 15): +4985 → effective 5000 (5%)
    // [5] Drake's Cowl (R3 base 100): +14900 → effective 15000 (15%)
    // [6] Carved Stone Plate (R3 base 100): +14900 → effective 15000 (15%)
    // [7] Stalker's Cloak (R3 base 100): +14900 → effective 15000 (15%)
    // [8] Scorched Scale Vest (R3 base 100): +14900 → effective 15000 (15%)
    // [9-22] Consumables: unchanged (base rates unchanged)
    function _basilisk(uint256[] memory b) internal pure returns (uint256[] memory) {
        // Gear (recalculated for new base rates)
        b[2] = 4985;    // Trollhide Cleaver (R4: 15 + 4985 = 5000)
        b[3] = 4985;    // Phasefang
        b[4] = 4985;    // Drakescale Staff
        b[5] = 14900;   // Drake's Cowl (R3: 100 + 14900 = 15000)
        b[6] = 14900;   // Carved Stone Plate
        b[7] = 14900;   // Stalker's Cloak
        b[8] = 14900;   // Scorched Scale Vest
        // Consumables (unchanged — base rates didn't change)
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
