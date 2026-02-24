// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {SetUp} from "../SetUp.sol";
import {console} from "forge-std/console.sol";
import {CharacterEquipment, CharacterEquipmentData, Stats, StatsData} from "@codegen/index.sol";
import {Classes, ItemType} from "@codegen/common.sol";

contract EquipFlowIntegrationTest is SetUp {
    address account;

    function setUp() public override {
        super.setUp();
        account = alice;
    }

    function testEnterGameAndEquipStarterItem() public {
        vm.startPrank(account);

        // Mint + roll + enter (issues starter items in enterGame)
        bytes32 name = keccak256(abi.encodePacked("EquipHero_", block.timestamp, account));
        bytes32 characterId = world.UD__mintCharacter(account, name, "ipfs://test-uri");

        bytes32 userRandom = keccak256(abi.encodePacked("rand_", block.number, account));
        world.UD__rollStats{value: 0.0001 ether}(userRandom, characterId, Classes.Warrior);
        world.UD__enterGame(characterId, newWeaponId, newArmorId);

        // Use the selected starter items
        uint256 starterItem = newWeaponId;

        // Equip via coordinator: UD__equipItems
        uint256[] memory items = new uint256[](1);
        items[0] = starterItem;
        world.UD__equipItems(characterId, items);

        // Validate equipment reflects item
        CharacterEquipmentData memory eq = CharacterEquipment.get(characterId);
        bool equipped = false;
        // check both armor and weapons arrays depending on type
        for (uint256 i = 0; i < eq.equippedWeapons.length; i++) {
            if (eq.equippedWeapons[i] == starterItem) { equipped = true; break; }
        }
        if (!equipped) {
            for (uint256 i = 0; i < eq.equippedArmor.length; i++) {
                if (eq.equippedArmor[i] == starterItem) { equipped = true; break; }
            }
        }
        assertTrue(equipped, "starter item should be equipped");

        // Verify stats updated (at least maxHp > 0 and armor possibly >= 0)
        StatsData memory s = Stats.get(characterId);
        assertTrue(s.maxHp > 0, "maxHp should be > 0");

        vm.stopPrank();
    }
}
