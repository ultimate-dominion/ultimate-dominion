// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Test} from "forge-std/Test.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {ConsumableSystem} from "@systems/equipment/ConsumableSystem.sol";
import {Stats, StatsData, Items, ConsumableStats, ConsumableStatsData, StatRestrictions, StatRestrictionsData} from "@codegen/index.sol";
import { ItemType } from "@codegen/common.sol";
import {Classes, PowerSource, Race, ArmorType, AdvancedClass} from "@codegen/common.sol";

contract ConsumableSystemTest is Test {
    address sysAddr;

    function setUp() public {
        StoreSwitch.setStoreAddress(address(this));
        Stats.register();
        Items.register();
        ConsumableStats.register();
        StatRestrictions.register();
        sysAddr = address(new ConsumableSystem());
    }

    function _makeCharacter(bytes32 characterId, uint256 level, int256 str, int256 agi, int256 intel) internal {
        Stats.set(characterId, StatsData({
            strength: str,
            agility: agi,
            class: Classes.Warrior,
            intelligence: intel,
            maxHp: 10,
            currentHp: 5,
            experience: 0,
            level: level,
            powerSource: PowerSource.None,
            race: Race.None,
            startingArmor: ArmorType.None,
            advancedClass: AdvancedClass.None,
            hasSelectedAdvancedClass: false
        }));
    }

    function _validateConsumable(bytes32 cid, uint256 itemId) internal returns (bool) {
        (bool success, bytes memory data) = sysAddr.delegatecall(
            abi.encodeCall(ConsumableSystem.validateConsumable, (cid, itemId))
        );
        require(success, "delegatecall failed");
        return abi.decode(data, (bool));
    }

    function _previewConsumableEffect(uint256 itemId) internal returns (bool isHealing, int256 magnitude) {
        (bool success, bytes memory data) = sysAddr.delegatecall(
            abi.encodeCall(ConsumableSystem.previewConsumableEffect, (itemId))
        );
        require(success, "delegatecall failed");
        return abi.decode(data, (bool, int256));
    }

    function test_validateConsumable_passes() public {
        bytes32 cid = bytes32(uint256(11));
        _makeCharacter(cid, 2, 5, 5, 5);

        uint256 potionId = 5001;
        Items.setItemType(potionId, ItemType.Consumable);
        ConsumableStats.set(potionId, ConsumableStatsData({
            minDamage: -5,
            maxDamage: -2,
            minLevel: 1,
            effects: new bytes32[](0)
        }));
        StatRestrictions.set(potionId, StatRestrictionsData({
            minAgility: 0,
            minIntelligence: 0,
            minStrength: 0
        }));

        bool ok = _validateConsumable(cid, potionId);
        assertTrue(ok, "consumable should be valid");
    }

    function test_previewConsumableEffect_reportsHealing() public {
        uint256 potionId = 5002;
        Items.setItemType(potionId, ItemType.Consumable);
        ConsumableStats.set(potionId, ConsumableStatsData({
            minDamage: -3,
            maxDamage: -1,
            minLevel: 1,
            effects: new bytes32[](0)
        }));

        (bool isHealing, int256 magnitude) = _previewConsumableEffect(potionId);
        assertTrue(isHealing, "should be healing");
        assertEq(magnitude, -1, "magnitude uses maxDamage");
    }
}
