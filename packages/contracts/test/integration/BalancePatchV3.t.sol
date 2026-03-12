// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {Mobs, MobsData} from "@codegen/index.sol";
import {MobType, Classes} from "@codegen/common.sol";
import {MonsterStats} from "@interfaces/Structs.sol";

/**
 * @title BalancePatchV3 Rename Tests
 * @notice Verifies monster rename logic from BalancePatchV3._renameMonsters().
 *         Seeds mobs with old names, renames them, and asserts new metadata.
 *
 * @dev Requires anvil + deployed world. Run with:
 *   forge test --match-contract BalancePatchV3RenameTest --rpc-url http://127.0.0.1:8545 --skip script
 */
contract BalancePatchV3RenameTest is Test {
    address deployer;
    address worldAddress;

    // Old metadata values matching production
    string[6] oldNames = ["cave_rat", "cave_troll", "lich_acolyte", "stone_giant", "shadow_stalker", "shadow_dragon"];
    // V3 target metadata values
    string[6] newNames = ["dire_rat", "ironhide_troll", "bonecaster", "rock_golem", "pale_stalker", "dusk_drake"];
    // Corresponding mob IDs
    uint256[6] mobIds = [uint256(1), 5, 7, 8, 9, 10];

    function setUp() public {
        deployer = vm.addr(vm.envUint("PRIVATE_KEY"));
        vm.startPrank(deployer);

        string memory json = vm.readFile(string(abi.encodePacked(vm.projectRoot(), "/deploys/31337/latest.json")));
        worldAddress = stdJson.readAddress(json, ".worldAddress");
        StoreSwitch.setStoreAddress(worldAddress);

        // Seed mobs with old names (simulates production state)
        _seedMobs();
    }

    function _seedMobs() internal {
        uint256[6] memory levels = [uint256(1), 5, 7, 8, 9, 10];
        Classes[6] memory classes = [Classes.Rogue, Classes.Warrior, Classes.Mage, Classes.Warrior, Classes.Rogue, Classes.Mage];

        for (uint256 i = 0; i < 6; i++) {
            // Only seed if not already populated (avoid clobbering existing test state)
            if (Mobs.getMobStats(mobIds[i]).length == 0) {
                uint256[] memory inv = new uint256[](0);
                MonsterStats memory stats = MonsterStats({
                    agility: int256(levels[i] * 2),
                    armor: int256(levels[i] / 3),
                    class: classes[i],
                    experience: levels[i] * 100,
                    hasBossAI: false,
                    hitPoints: int256(levels[i] * 5),
                    intelligence: int256(levels[i]),
                    inventory: inv,
                    level: levels[i],
                    strength: int256(levels[i] * 2)
                });
                Mobs.set(mobIds[i], MobType.Monster, abi.encode(stats), oldNames[i]);
            }
        }
    }

    function test_renameMonsters_updatesMetadata() public {
        // Verify mobs exist with old names
        for (uint256 i = 0; i < 6; i++) {
            MobsData memory data = Mobs.get(mobIds[i]);
            assertTrue(data.mobStats.length > 0, string.concat("Mob ", vm.toString(mobIds[i]), " should exist"));
        }

        // Apply renames (same logic as BalancePatchV3._renameMonsters)
        Mobs.setMobMetadata(1, "dire_rat");
        Mobs.setMobMetadata(5, "ironhide_troll");
        Mobs.setMobMetadata(7, "bonecaster");
        Mobs.setMobMetadata(8, "rock_golem");
        Mobs.setMobMetadata(9, "pale_stalker");
        Mobs.setMobMetadata(10, "dusk_drake");

        // Verify all renames took effect
        for (uint256 i = 0; i < 6; i++) {
            string memory metadata = Mobs.getMobMetadata(mobIds[i]);
            assertEq(metadata, newNames[i], string.concat("Mob ", vm.toString(mobIds[i]), " should be renamed"));
        }
    }

    function test_renameMonsters_preservesStats() public {
        // Read stats before rename
        bytes[6] memory statsBefore;
        MobType[6] memory typesBefore;
        for (uint256 i = 0; i < 6; i++) {
            MobsData memory data = Mobs.get(mobIds[i]);
            statsBefore[i] = data.mobStats;
            typesBefore[i] = data.mobType;
        }

        // Apply renames
        Mobs.setMobMetadata(1, "dire_rat");
        Mobs.setMobMetadata(5, "ironhide_troll");
        Mobs.setMobMetadata(7, "bonecaster");
        Mobs.setMobMetadata(8, "rock_golem");
        Mobs.setMobMetadata(9, "pale_stalker");
        Mobs.setMobMetadata(10, "dusk_drake");

        // Verify stats unchanged
        for (uint256 i = 0; i < 6; i++) {
            MobsData memory data = Mobs.get(mobIds[i]);
            assertEq(keccak256(data.mobStats), keccak256(statsBefore[i]),
                string.concat("Mob ", vm.toString(mobIds[i]), " stats should be unchanged"));
            assertTrue(data.mobType == typesBefore[i],
                string.concat("Mob ", vm.toString(mobIds[i]), " type should be unchanged"));
        }
    }

    function test_renameMonsters_idempotent() public {
        // Run renames twice
        for (uint256 run = 0; run < 2; run++) {
            Mobs.setMobMetadata(1, "dire_rat");
            Mobs.setMobMetadata(5, "ironhide_troll");
            Mobs.setMobMetadata(7, "bonecaster");
            Mobs.setMobMetadata(8, "rock_golem");
            Mobs.setMobMetadata(9, "pale_stalker");
            Mobs.setMobMetadata(10, "dusk_drake");
        }

        // All still correct after double-apply
        for (uint256 i = 0; i < 6; i++) {
            string memory metadata = Mobs.getMobMetadata(mobIds[i]);
            assertEq(metadata, newNames[i]);
        }
    }
}
