// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {SetUp} from "./SetUp.sol";
import {CharacterItemDurability, ItemDurability, CharacterEquipment, Items} from "@codegen/index.sol";
import {ItemType, Classes} from "@codegen/common.sol";
import {ItemNotDamageable, ItemAlreadyFullDurability, NotAdmin} from "../src/Errors.sol";
import {
    DURABILITY_LOSS_PER_COMBAT,
    REPAIR_COST_R0,
    REPAIR_COST_R1
} from "../constants.sol";
import {StatRestrictionsData, WeaponStatsData, ArmorStatsData} from "@codegen/index.sol";
import {ArmorType} from "@codegen/common.sol";

contract Test_DurabilitySystem is SetUp {
    uint256 z2WeaponId;
    uint256 z1WeaponId; // newWeaponId from SetUp — no maxDurability set
    uint256 constant Z2_MAX_DURABILITY = 10;

    function setUp() public override {
        super.setUp();

        // Grant admin to this test contract
        vm.startPrank(deployer);
        world.UD__setAdmin(address(this), true);

        // Create a Z2 weapon (rarity=1 so repair cost = REPAIR_COST_R1)
        StatRestrictionsData memory noRestrictions =
            StatRestrictionsData({minStrength: 0, minIntelligence: 0, minAgility: 0});
        WeaponStatsData memory weaponStats = WeaponStatsData({
            agiModifier: 0,
            intModifier: 0,
            hpModifier: 0,
            maxDamage: 4,
            minDamage: 1,
            minLevel: 0,
            strModifier: 0,
            effects: new bytes32[](0)
        });
        z2WeaponId = world.UD__createItem(
            ItemType.Weapon,
            10 ether,
            100000000,
            1 ether,
            1, // rarity = 1 (Common)
            abi.encode(weaponStats, noRestrictions),
            "z2_weapon_uri"
        );

        // Set max durability — makes it a Z2 item
        world.UD__setMaxDurability(z2WeaponId, Z2_MAX_DURABILITY);

        // Drop Z2 weapon to bob
        world.UD__adminDropItem(bobCharacterId, z2WeaponId, 1);

        // Initialize durability for bob's Z2 weapon
        world.UD__initializeDurability(bobCharacterId, z2WeaponId);

        // Give bob gold for repairs
        world.UD__adminDropGold(bobCharacterId, 1000 ether);
        vm.stopPrank();

        // Bob equips the Z2 weapon (he must unequip existing weapon first if slot is full,
        // but enterGame only equips the starter weapon — we can just equip the Z2 additionally)
        vm.startPrank(bob);
        uint256[] memory itemsToEquip = new uint256[](1);
        itemsToEquip[0] = z2WeaponId;
        world.UD__equipItems(bobCharacterId, itemsToEquip);
        vm.stopPrank();

        // Z1 weapon is newWeaponId from SetUp — has no maxDurability set
        z1WeaponId = newWeaponId;
    }

    // ==================== Happy Paths ====================

    function test_degrade_reducesZ2ItemDurability() public {
        uint256 durBefore = CharacterItemDurability.getCurrentDurability(bobCharacterId, z2WeaponId);
        assertEq(durBefore, Z2_MAX_DURABILITY, "should start at max");

        vm.prank(deployer);
        world.UD__degradeEquippedItems(bobCharacterId);

        uint256 durAfter = CharacterItemDurability.getCurrentDurability(bobCharacterId, z2WeaponId);
        assertEq(durAfter, Z2_MAX_DURABILITY - DURABILITY_LOSS_PER_COMBAT, "should decrease by 1");
    }

    function test_degrade_z1ItemsExempt() public {
        // Z1 weapon (newWeaponId) has maxDurability=0, should be unaffected
        uint256 maxDur = ItemDurability.getMaxDurability(z1WeaponId);
        assertEq(maxDur, 0, "Z1 item should have maxDurability=0");

        // Z1 item's currentDurability should stay 0 (never initialized)
        uint256 durBefore = CharacterItemDurability.getCurrentDurability(bobCharacterId, z1WeaponId);

        vm.prank(deployer);
        world.UD__degradeEquippedItems(bobCharacterId);

        uint256 durAfter = CharacterItemDurability.getCurrentDurability(bobCharacterId, z1WeaponId);
        assertEq(durAfter, durBefore, "Z1 item durability should not change");
    }

    function test_degrade_brokenItemStaysAtZero() public {
        // Degrade the Z2 weapon to 0
        for (uint256 i; i < Z2_MAX_DURABILITY; i++) {
            vm.prank(deployer);
            world.UD__degradeEquippedItems(bobCharacterId);
        }
        uint256 durAt0 = CharacterItemDurability.getCurrentDurability(bobCharacterId, z2WeaponId);
        assertEq(durAt0, 0, "should be broken");

        // Degrade again — should stay at 0
        vm.prank(deployer);
        world.UD__degradeEquippedItems(bobCharacterId);

        uint256 durStill0 = CharacterItemDurability.getCurrentDurability(bobCharacterId, z2WeaponId);
        assertEq(durStill0, 0, "broken item should stay at 0");
    }

    function test_repair_restoresDurability() public {
        // Degrade once so there's damage to repair
        vm.prank(deployer);
        world.UD__degradeEquippedItems(bobCharacterId);

        uint256 durBefore = CharacterItemDurability.getCurrentDurability(bobCharacterId, z2WeaponId);
        uint256 pointsToRepair = Z2_MAX_DURABILITY - durBefore;
        uint256 expectedCost = pointsToRepair * REPAIR_COST_R1; // rarity=1

        uint256 goldBefore = goldToken.balanceOf(bob);

        vm.prank(bob);
        world.UD__repairItem(bobCharacterId, z2WeaponId);

        uint256 durAfter = CharacterItemDurability.getCurrentDurability(bobCharacterId, z2WeaponId);
        uint256 goldAfter = goldToken.balanceOf(bob);

        assertEq(durAfter, Z2_MAX_DURABILITY, "should be fully repaired");
        assertEq(goldBefore - goldAfter, expectedCost, "gold burned should match repair cost");
    }

    function test_canEquip_trueForZ1() public {
        bool canEquip = world.UD__canEquipDurability(bobCharacterId, z1WeaponId);
        assertTrue(canEquip, "Z1 item should always be equippable");
    }

    function test_canEquip_trueForHealthyZ2() public {
        bool canEquip = world.UD__canEquipDurability(bobCharacterId, z2WeaponId);
        assertTrue(canEquip, "Z2 item with durability > 0 should be equippable");
    }

    function test_canEquip_falseForBrokenZ2() public {
        // Break the item
        for (uint256 i; i < Z2_MAX_DURABILITY; i++) {
            vm.prank(deployer);
            world.UD__degradeEquippedItems(bobCharacterId);
        }
        assertEq(CharacterItemDurability.getCurrentDurability(bobCharacterId, z2WeaponId), 0);

        bool canEquip = world.UD__canEquipDurability(bobCharacterId, z2WeaponId);
        assertFalse(canEquip, "broken Z2 item should not be equippable");
    }

    function test_initialize_setsToMaxForZ2() public {
        // Create a fresh Z2 armor and drop to alice (who hasn't had durability initialized)
        vm.startPrank(deployer);
        StatRestrictionsData memory noRestrictions =
            StatRestrictionsData({minStrength: 0, minIntelligence: 0, minAgility: 0});
        ArmorStatsData memory armorStats = ArmorStatsData({
            armorModifier: 1,
            minLevel: 0,
            strModifier: 0,
            agiModifier: 0,
            intModifier: 0,
            hpModifier: 0,
            armorType: ArmorType.Cloth
        });

        // Alice needs to enter game first
        vm.stopPrank();
        vm.startPrank(alice);
        world.UD__rollStats(alicesRandomness, alicesCharacterId, Classes.Mage);
        world.UD__enterGame(alicesCharacterId, newWeaponId, newArmorId);
        vm.stopPrank();

        vm.startPrank(deployer);
        uint256 freshItemId = world.UD__createItem(
            ItemType.Armor, 10 ether, 100000000, 1 ether, 0,
            abi.encode(armorStats, noRestrictions), "fresh_z2_armor"
        );
        world.UD__setMaxDurability(freshItemId, 20);
        world.UD__adminDropItem(alicesCharacterId, freshItemId, 1);

        // Before init, current durability should be 0
        uint256 durBefore = CharacterItemDurability.getCurrentDurability(alicesCharacterId, freshItemId);
        assertEq(durBefore, 0, "should be 0 before initialization");

        world.UD__initializeDurability(alicesCharacterId, freshItemId);
        vm.stopPrank();

        uint256 durAfter = CharacterItemDurability.getCurrentDurability(alicesCharacterId, freshItemId);
        assertEq(durAfter, 20, "should be set to maxDurability after init");
    }

    function test_initialize_skipsZ1() public {
        // Z1 item — initializeDurability should be a no-op
        uint256 durBefore = CharacterItemDurability.getCurrentDurability(bobCharacterId, z1WeaponId);

        vm.prank(deployer);
        world.UD__initializeDurability(bobCharacterId, z1WeaponId);

        uint256 durAfter = CharacterItemDurability.getCurrentDurability(bobCharacterId, z1WeaponId);
        assertEq(durAfter, durBefore, "Z1 init should be no-op");
    }

    // ==================== Unhappy Paths ====================

    function test_repair_revertsZ1Item() public {
        vm.prank(bob);
        vm.expectRevert(ItemNotDamageable.selector);
        world.UD__repairItem(bobCharacterId, z1WeaponId);
    }

    function test_repair_revertsAlreadyFull() public {
        // Z2 weapon is at max durability — repair should revert
        vm.prank(bob);
        vm.expectRevert(ItemAlreadyFullDurability.selector);
        world.UD__repairItem(bobCharacterId, z2WeaponId);
    }

    function test_setMaxDurability_revertsNonAdmin() public {
        vm.prank(bob);
        vm.expectRevert(NotAdmin.selector);
        world.UD__setMaxDurability(z2WeaponId, 50);
    }
}
