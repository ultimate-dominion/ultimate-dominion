pragma solidity >=0.8.24;

import {SetUp} from "./SetUp.sol";
import {Classes, ItemType} from "@codegen/common.sol";
import {StatsData} from "@tables/Stats.sol";
import "forge-std/console2.sol";
import {PuppetModule} from "@latticexyz/world-modules/src/modules/puppet/PuppetModule.sol";
import {UltimateDominionConfig} from "@codegen/index.sol";
import {UltimateDominionConfigSystem} from "@systems/UltimateDominionConfigSystem.sol";
import {ERC1155Module} from "@erc1155/ERC1155Module.sol";
import {ERC1155System} from "@erc1155/ERC1155System.sol";
import {IERC1155MetadataURI} from "@erc1155/IERC1155MetadataURI.sol";
import {IERC1155} from "@erc1155/IERC1155.sol";
import {registerERC1155} from "@erc1155/registerERC1155.sol";
import {_erc1155SystemId} from "@erc1155/utils.sol";
import {WeaponStats, ArmorStats, AdjustedCombatStats} from "@interfaces/Structs.sol";
import {ResourceIdLib} from "@latticexyz/store/src/ResourceId.sol";
import {ResourceId, WorldResourceIdLib, WorldResourceIdInstance} from "@latticexyz/world/src/WorldResourceId.sol";
import {_itemsSystemId} from "../src/utils.sol";
import {
    GOLD_NAMESPACE,
    CHARACTERS_NAMESPACE,
    ERC721_NAME,
    ERC721_SYMBOL,
    TOKEN_URI,
    ITEMS_NAMESPACE
} from "../constants.sol";
import {GasReporter} from "@latticexyz/gas-report/src/GasReporter.sol";

contract Test_EquipmentSystem is SetUp, GasReporter {
    function setUp() public virtual override {
        super.setUp();
        vm.prank(deployer);
        world.grantAccess(_itemsSystemId("UD"), address(this));
    }

    function test_equipItems() public {
        uint256[] memory itemIds = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);
        bytes32[] memory characterIds = new bytes32[](1);
        itemIds[0] = newArmorId;
        amounts[0] = 1;
        characterIds[0] = bobCharacterId;
        world.UD__dropItems(itemIds, amounts, characterIds);
        vm.startPrank(bob);
        uint256[] memory itemsToEquip = new uint256[](1);
        itemsToEquip[0] = newArmorId;
        startGasReport("equip 1 item");
        world.UD__equipItems(bobCharacterId, itemsToEquip);
        endGasReport();
        assertTrue(world.UD__isEquipped(bobCharacterId, newArmorId));
    }

    function test_applyEquipmentBonuses() public {
        uint256[] memory itemIds = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);
        bytes32[] memory characterIds = new bytes32[](1);
        itemIds[0] = newArmorId;
        amounts[0] = 1;
        characterIds[0] = bobCharacterId;
        world.UD__dropItems(itemIds, amounts, characterIds);

        vm.startPrank(bob);
        uint256[] memory itemsToEquip = new uint256[](1);
        itemsToEquip[0] = newArmorId;

        world.UD__equipItems(bobCharacterId, itemsToEquip);
        StatsData memory baseStats = world.UD__getStats(bobCharacterId);
        startGasReport("apply stat bonuses");
        AdjustedCombatStats memory modifiedStats = world.UD__applyEquipmentBonuses(bobCharacterId);
        endGasReport();
        ArmorStats memory armorStats = world.UD__getArmorStats(newArmorId);
        assertTrue(world.UD__isEquipped(bobCharacterId, newArmorId));

        assertEq(modifiedStats.adjustedStrength, uint256(int256(baseStats.strength) + armorStats.strModifier));
        assertEq(modifiedStats.adjustedAgility, uint256(int256(baseStats.agility) + armorStats.agiModifier));
        assertEq(modifiedStats.adjustedIntelligence, uint256(int256(baseStats.intelligence) + armorStats.intModifier));
        assertEq(modifiedStats.adjustedMaxHp, uint256(int256(baseStats.baseHitPoints) + armorStats.hitPointModifier));
    }

    function test_unequipItem() public {
        uint256 fees = entropy.getFee(address(1));
        vm.startPrank(alice);
        world.UD__rollStats{value: fees}(alicesRandomness, alicesCharacterId, Classes.Rogue);
        world.UD__enterGame(alicesCharacterId);
        uint256[] memory itemsToEquip = new uint256[](1);
        itemsToEquip[0] = 1;
        world.UD__equipItems(alicesCharacterId, itemsToEquip);
        assertTrue(world.UD__isEquipped(alicesCharacterId, 1));
        startGasReport("uneqip 1 item");
        world.UD__unequipItem(alicesCharacterId, 1);
        endGasReport();
        assertFalse(world.UD__isEquipped(alicesCharacterId, 1));
    }
}
