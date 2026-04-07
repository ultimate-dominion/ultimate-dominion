// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Test} from "forge-std/Test.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {EquipmentCore} from "@systems/equipment/EquipmentCore.sol";
import {Stats, StatsData, Items, WeaponStats, WeaponStatsData, ArmorStats, ArmorStatsData, StatRestrictions, StatRestrictionsData} from "@codegen/index.sol";
import { ItemType } from "@codegen/common.sol";
import {Classes, PowerSource, Race, ArmorType, AdvancedClass} from "@codegen/common.sol";

contract EquipmentCoreTest is Test {
    address coreAddr;

    function setUp() public {
        StoreSwitch.setStoreAddress(address(this));
        Stats.register();
        Items.register();
        WeaponStats.register();
        ArmorStats.register();
        StatRestrictions.register();
        coreAddr = address(new EquipmentCore());
    }

    function _makeCharacter(bytes32 characterId, uint256 level, int256 str, int256 agi, int256 intel) internal {
        Stats.set(characterId, StatsData({
            strength: str,
            agility: agi,
            class: Classes.Warrior,
            intelligence: intel,
            maxHp: 10,
            currentHp: 10,
            experience: 0,
            level: level,
            powerSource: PowerSource.None,
            race: Race.None,
            startingArmor: ArmorType.None,
            advancedClass: AdvancedClass.None,
            hasSelectedAdvancedClass: false
        }));
    }

    function _validateEquipment(bytes32 cid, uint256 itemId) internal returns (bool) {
        (bool success, bytes memory data) = coreAddr.delegatecall(
            abi.encodeCall(EquipmentCore.validateEquipment, (cid, itemId))
        );
        require(success, "delegatecall failed");
        return abi.decode(data, (bool));
    }

    function test_validateEquipment_weapon_minLevelAndStatsPass() public {
        bytes32 cid = bytes32(uint256(1));
        _makeCharacter(cid, 5, 10, 8, 7);

        uint256 weaponId = 1001;
        Items.setItemType(weaponId, ItemType.Weapon);
        WeaponStats.set(weaponId, WeaponStatsData({
            agiModifier: 0,
            effects: new bytes32[](0),
            hpModifier: 0,
            intModifier: 0,
            maxDamage: 5,
            minDamage: 1,
            minLevel: 3,
            strModifier: 0
        }));
        StatRestrictions.set(weaponId, StatRestrictionsData({
            minAgility: 5,
            minIntelligence: 5,
            minStrength: 5
        }));

        bool ok = _validateEquipment(cid, weaponId);
        assertTrue(ok, "weapon should be valid for character");
    }

    function test_validateEquipment_usesTotalStats() public {
        bytes32 cid = bytes32(uint256(10));
        _makeCharacter(cid, 5, 12, 10, 8);

        uint256 weaponId = 1002;
        Items.setItemType(weaponId, ItemType.Weapon);
        WeaponStats.set(weaponId, WeaponStatsData({
            agiModifier: 0,
            effects: new bytes32[](0),
            hpModifier: 0,
            intModifier: 0,
            maxDamage: 10,
            minDamage: 3,
            minLevel: 5,
            strModifier: 0
        }));
        StatRestrictions.set(weaponId, StatRestrictionsData({
            minAgility: 0,
            minIntelligence: 0,
            minStrength: 10
        }));

        bool ok = _validateEquipment(cid, weaponId);
        assertTrue(ok, "should pass using total stats from Stats table");
    }

    function test_validateEquipment_armor_failsMinLevel() public {
        bytes32 cid = bytes32(uint256(2));
        _makeCharacter(cid, 1, 5, 5, 5);

        uint256 armorId = 2001;
        Items.setItemType(armorId, ItemType.Armor);
        ArmorStats.set(armorId, ArmorStatsData({
            agiModifier: 0,
            armorModifier: 1,
            hpModifier: 0,
            intModifier: 0,
            minLevel: 3,
            strModifier: 0,
            armorType: ArmorType.Cloth
        }));
        StatRestrictions.set(armorId, StatRestrictionsData({
            minAgility: 0,
            minIntelligence: 0,
            minStrength: 0
        }));

        bool ok = _validateEquipment(cid, armorId);
        assertFalse(ok, "armor should fail min level");
    }
}
