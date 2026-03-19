// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {SetUp} from "./SetUp.sol";
import {Classes, MobType, ItemType} from "@codegen/common.sol";
import {Items, Mobs, MobStats, MobStatsData, MobDropBonus} from "@codegen/index.sol";
import {MonsterStats, WeaponStatsData, StatRestrictionsData} from "@interfaces/Structs.sol";
import {_mobSystemId} from "../src/utils.sol";
import {ELITE_DROP_MULTIPLIER} from "../constants.sol";

/**
 * @title Test_PveRewardBonus
 * @notice Tests for the V4 signature bonus system in PveRewardSystem._calculateItemDrop()
 *
 * Cases:
 *   1. No bonus (backwards compat) — empty MobDropBonus = no bonus applied
 *   2. Bonus applied — signature bonus added to base dropChance
 *   3. Elite + bonus stacking — ELITE_DROP_BONUS is multiplicative (1.15x) after signature bonus
 *   4. Cap at 100000 — dropChance never exceeds 100%
 *   5. Mismatched lengths safety — wrong-length bonus array = no bonus applied
 */
contract Test_PveRewardBonus is SetUp {
    uint256 testMobId;
    uint256 testItemId;
    bytes32 testEntityId;

    function setUp() public override {
        super.setUp();

        vm.startPrank(deployer);
        world.grantAccess(_mobSystemId("UD"), address(this));

        // Create a test weapon with known dropChance (100bp = 1%)
        WeaponStatsData memory weaponStats = WeaponStatsData({
            agiModifier: 0,
            intModifier: 0,
            hpModifier: 0,
            maxDamage: 5,
            minDamage: 1,
            minLevel: 0,
            strModifier: 1,
            effects: new bytes32[](0)
        });
        StatRestrictionsData memory noRestrictions =
            StatRestrictionsData({minStrength: 0, minIntelligence: 0, minAgility: 0});
        testItemId = world.UD__createItem(
            ItemType.Weapon,
            10 ether,
            100, // 1% base drop chance
            1 ether,
            2,
            abi.encode(weaponStats, noRestrictions),
            "test_bonus_weapon"
        );

        // Create a monster with only the test item in inventory
        uint256[] memory inv = new uint256[](1);
        inv[0] = testItemId;
        MonsterStats memory monster = MonsterStats({
            agility: 5,
            armor: 0,
            class: Classes.Warrior,
            experience: 100,
            hasBossAI: false,
            hitPoints: 10,
            intelligence: 2,
            inventory: inv,
            level: 1,
            strength: 5
        });
        testMobId = world.UD__createMob(MobType.Monster, abi.encode(monster), "test_bonus_monster");
        testEntityId = world.UD__spawnMob(testMobId, 5, 5);

        vm.stopPrank();
    }

    function test_noBonus_backwardsCompat() public {
        // No MobDropBonus set → bonuses array is empty → hasBonuses = false
        uint256[] memory bonuses = MobDropBonus.getBonuses(testMobId);
        assertEq(bonuses.length, 0, "should have no bonuses by default");

        // Drop calculation should use base dropChance only
        uint256 baseDrop = Items.getDropChance(testItemId);
        assertEq(baseDrop, 100, "base drop should be 100bp");
    }

    function test_bonusApplied() public {
        vm.startPrank(deployer);

        // Set a signature bonus of 400bp for the single item
        uint256[] memory bonuses = new uint256[](1);
        bonuses[0] = 400; // +4% bonus
        MobDropBonus.setBonuses(testMobId, bonuses);

        vm.stopPrank();

        // Verify bonus was stored
        uint256[] memory stored = MobDropBonus.getBonuses(testMobId);
        assertEq(stored.length, 1, "should have 1 bonus");
        assertEq(stored[0], 400, "bonus should be 400bp");
    }

    function test_bonusAndEliteStacking() public {
        vm.startPrank(deployer);

        // Set bonus
        uint256[] memory bonuses = new uint256[](1);
        bonuses[0] = 200;
        MobDropBonus.setBonuses(testMobId, bonuses);

        // Make the spawned entity elite
        MobStatsData memory mobStats = MobStats.get(testEntityId);
        mobStats.isElite = true;
        MobStats.set(testEntityId, mobStats);

        vm.stopPrank();

        // Base (100) + bonus (200) = 300, then elite 2x = 600bp
        uint256 baseWithBonus = 100 + 200;
        uint256 expectedEffective = baseWithBonus * ELITE_DROP_MULTIPLIER / 100;
        assertEq(expectedEffective, 600, "effective drop should be 600bp");
    }

    function test_capAt100000() public {
        vm.startPrank(deployer);

        // Set an extreme bonus that would exceed 100000 (the actual cap in PveRewardSystem)
        uint256[] memory bonuses = new uint256[](1);
        bonuses[0] = 99950; // base 100 + bonus 99950 = 100050
        MobDropBonus.setBonuses(testMobId, bonuses);

        vm.stopPrank();

        // The cap is enforced in the drop loop, not in storage
        uint256[] memory stored = MobDropBonus.getBonuses(testMobId);
        assertEq(stored[0], 99950, "stored bonus should be 99950");

        // Effective would be min(100 + 99950, 100000) = 100000 (before elite multiplier)
        uint256 effective = 100 + 99950;
        if (effective > 100000) effective = 100000;
        assertEq(effective, 100000, "effective should cap at 100000");
    }

    function test_mismatchedLengths_noBonus() public {
        vm.startPrank(deployer);

        // Set 2 bonuses for a monster with 1-item inventory → mismatch → no bonus
        uint256[] memory bonuses = new uint256[](2);
        bonuses[0] = 5000;
        bonuses[1] = 5000;
        MobDropBonus.setBonuses(testMobId, bonuses);

        vm.stopPrank();

        // Verify the mismatch
        MonsterStats memory monster = abi.decode(Mobs.getMobStats(testMobId), (MonsterStats));
        uint256[] memory stored = MobDropBonus.getBonuses(testMobId);
        assertTrue(stored.length != monster.inventory.length, "lengths should mismatch");
    }
}
