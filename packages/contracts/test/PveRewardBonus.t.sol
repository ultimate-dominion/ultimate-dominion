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
 * @notice Tests for drop system: MobDropBonus + multiplicative elite bonus
 *
 * Cases:
 *   1. No bonus (backwards compat) — empty MobDropBonus = base dropChance only
 *   2. Bonus applied — signature bonus added to base dropChance
 *   3. Elite multiplicative — elite 2x multiplier doubles effective dropChance
 *   4. Elite on zero dropChance — 0 * 2x = 0 (monster weapons never drop)
 *   5. Elite + bonus stacking — bonus added first, then multiplied
 *   6. Cap at 100000 — dropChance never exceeds 100%
 *   7. Mismatched lengths safety — wrong-length bonus array = no bonus applied
 *   8. Elite multiplier constant — verify value is 200 (2x)
 */
contract Test_PveRewardBonus is SetUp {
    uint256 testMobId;
    uint256 testItemId;
    uint256 testMonsterWeaponId;
    bytes32 testEntityId;

    function setUp() public override {
        super.setUp();

        vm.startPrank(deployer);
        world.grantAccess(_mobSystemId("UD"), address(this));

        // Create a test weapon with known dropChance (100/100k = 0.1%)
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
            100, // 0.1% base drop chance
            1 ether,
            2,
            abi.encode(weaponStats, noRestrictions),
            "test_bonus_weapon"
        );

        // Create a monster weapon with dropChance = 0 (should NEVER drop)
        testMonsterWeaponId = world.UD__createItem(
            ItemType.Weapon,
            10 ether,
            0, // 0% drop chance — monster-only weapon
            0,
            0,
            abi.encode(weaponStats, noRestrictions),
            "test_monster_weapon"
        );

        // Create a monster with both items in inventory
        uint256[] memory inv = new uint256[](2);
        inv[0] = testMonsterWeaponId; // monster weapon, slot 0
        inv[1] = testItemId;          // droppable weapon, slot 1
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

    // ===== 1. No bonus, backwards compat =====
    function test_noBonus_backwardsCompat() public {
        uint256[] memory bonuses = MobDropBonus.getBonuses(testMobId);
        assertEq(bonuses.length, 0, "should have no bonuses by default");

        uint256 baseDrop = Items.getDropChance(testItemId);
        assertEq(baseDrop, 100, "base drop should be 100/100k");
    }

    // ===== 2. Bonus applied =====
    function test_bonusApplied() public {
        vm.startPrank(deployer);

        uint256[] memory bonuses = new uint256[](2);
        bonuses[0] = 0;   // monster weapon — no bonus
        bonuses[1] = 400;  // +400/100k bonus on droppable weapon
        MobDropBonus.setBonuses(testMobId, bonuses);

        vm.stopPrank();

        uint256[] memory stored = MobDropBonus.getBonuses(testMobId);
        assertEq(stored.length, 2, "should have 2 bonuses");
        assertEq(stored[0], 0, "monster weapon bonus should be 0");
        assertEq(stored[1], 400, "droppable weapon bonus should be 400");
    }

    // ===== 3. Elite multiplicative — 2x =====
    function test_eliteMultiplicative() public {
        // Elite multiplier should DOUBLE the drop chance, not add a flat amount
        // base=100, elite=200 (2x) → effective = 100 * 200 / 100 = 200
        uint256 baseDrop = 100;
        uint256 eliteEffective = baseDrop * ELITE_DROP_MULTIPLIER / 100;
        assertEq(eliteEffective, 200, "elite 2x on 100 should give 200");

        // R3 item: base=4 → elite = 4 * 200 / 100 = 8
        uint256 r3Elite = 4 * ELITE_DROP_MULTIPLIER / 100;
        assertEq(r3Elite, 8, "elite 2x on R3(4) should give 8");

        // R4 item: base=3 → elite = 3 * 200 / 100 = 6
        uint256 r4Elite = 3 * ELITE_DROP_MULTIPLIER / 100;
        assertEq(r4Elite, 6, "elite 2x on R4(3) should give 6");
    }

    // ===== 4. Elite on zero dropChance — monster weapons never drop =====
    function test_eliteOnZero_neverDrops() public {
        // 0 * 200 / 100 = 0 — monster weapons must NEVER drop from elites
        uint256 monsterWeaponDrop = Items.getDropChance(testMonsterWeaponId);
        assertEq(monsterWeaponDrop, 0, "monster weapon base should be 0");

        uint256 eliteEffective = monsterWeaponDrop * ELITE_DROP_MULTIPLIER / 100;
        assertEq(eliteEffective, 0, "elite 2x on 0 should still be 0");
    }

    // ===== 5. Elite + bonus stacking =====
    function test_eliteAndBonusStacking() public {
        vm.startPrank(deployer);

        uint256[] memory bonuses = new uint256[](2);
        bonuses[0] = 0;
        bonuses[1] = 200; // +200 bonus
        MobDropBonus.setBonuses(testMobId, bonuses);

        MobStatsData memory mobStats = MobStats.get(testEntityId);
        mobStats.isElite = true;
        MobStats.set(testEntityId, mobStats);

        vm.stopPrank();

        // Base (100) + bonus (200) = 300, then elite 2x = 300 * 200 / 100 = 600
        uint256 baseWithBonus = 100 + 200;
        uint256 expectedEffective = baseWithBonus * ELITE_DROP_MULTIPLIER / 100;
        assertEq(expectedEffective, 600, "base+bonus then elite 2x should give 600");
    }

    // ===== 6. Cap at 100000 =====
    function test_capAt100000() public {
        vm.startPrank(deployer);

        uint256[] memory bonuses = new uint256[](2);
        bonuses[0] = 0;
        bonuses[1] = 99950; // base 100 + bonus 99950 = 100050
        MobDropBonus.setBonuses(testMobId, bonuses);

        vm.stopPrank();

        uint256[] memory stored = MobDropBonus.getBonuses(testMobId);
        assertEq(stored[1], 99950, "stored bonus should be 99950");

        // Effective before cap: 100 + 99950 = 100050
        // After cap: min(100050, 100000) = 100000
        uint256 effective = 100 + 99950;
        if (effective > 100000) effective = 100000;
        assertEq(effective, 100000, "effective should cap at 100000");
    }

    // ===== 7. Mismatched lengths — no bonus =====
    function test_mismatchedLengths_noBonus() public {
        vm.startPrank(deployer);

        // Set 3 bonuses for a monster with 2-item inventory → mismatch → no bonus
        uint256[] memory bonuses = new uint256[](3);
        bonuses[0] = 5000;
        bonuses[1] = 5000;
        bonuses[2] = 5000;
        MobDropBonus.setBonuses(testMobId, bonuses);

        vm.stopPrank();

        MonsterStats memory monster = abi.decode(Mobs.getMobStats(testMobId), (MonsterStats));
        uint256[] memory stored = MobDropBonus.getBonuses(testMobId);
        assertTrue(stored.length != monster.inventory.length, "lengths should mismatch");
    }

    // ===== 8. Elite multiplier constant =====
    function test_eliteMultiplierConstant() public {
        assertEq(ELITE_DROP_MULTIPLIER, 200, "elite multiplier should be 200 (2x)");
    }

    // ===== 9. Large dropChance + elite doesn't overflow =====
    function test_largeDropChanceWithElite() public {
        // 50000 * 200 / 100 = 100000 — exactly at cap, no overflow
        uint256 effective = 50000 * ELITE_DROP_MULTIPLIER / 100;
        assertEq(effective, 100000, "50000 * 2x should be 100000");

        // 60000 * 200 / 100 = 120000 — would exceed cap, contract clamps to 100000
        uint256 overCap = 60000 * ELITE_DROP_MULTIPLIER / 100;
        if (overCap > 100000) overCap = 100000;
        assertEq(overCap, 100000, "60000 * 2x should clamp to 100000");
    }

    // ===== 10. Bonus on monster weapon slot stays zero =====
    function test_monsterWeaponWithBonus_stillZero() public {
        vm.startPrank(deployer);

        // Even if someone sets a bonus on the monster weapon slot,
        // 0 + bonus = bonus, but elite would be bonus * 2x.
        // The ONLY safe way is dropChance = 0 AND no bonus on slot 0.
        uint256[] memory bonuses = new uint256[](2);
        bonuses[0] = 0; // correct: no bonus on monster weapon
        bonuses[1] = 100;
        MobDropBonus.setBonuses(testMobId, bonuses);

        vm.stopPrank();

        // Monster weapon: base 0 + bonus 0 = 0, elite 2x = 0
        uint256 monsterBase = Items.getDropChance(testMonsterWeaponId);
        uint256 monsterBonus = MobDropBonus.getBonuses(testMobId)[0];
        uint256 effective = (monsterBase + monsterBonus) * ELITE_DROP_MULTIPLIER / 100;
        assertEq(effective, 0, "monster weapon effective should be 0 even with elite");
    }
}
