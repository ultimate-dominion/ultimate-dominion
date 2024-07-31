// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {SetUp} from "./SetUp.sol";
import {Classes, ItemType} from "@codegen/common.sol";
import {StatsData, StarterItemsData} from "@codegen/index.sol";
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
import {WeaponStats} from "@interfaces/Structs.sol";
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

contract Test_ItemsSystem is SetUp, GasReporter {
    function setUp() public virtual override {
        super.setUp();
        vm.prank(deployer);
        world.grantAccess(_itemsSystemId("UD"), address(this));
    }

    function test_CreateItem() public {
        startGasReport("creates an item");

        uint8[] memory restrictions = new uint8[](0);
        WeaponStats memory weaponStats = WeaponStats({
            agiModifier: 0,
            classRestrictions: restrictions,
            hitPointModifier: 0,
            intModifier: 0,
            maxDamage: 4,
            minDamage: 1,
            minLevel: 0,
            strModifier: 0
        });
        vm.startPrank(deployer);
        uint256 firstItemId =
            world.UD__createItem(ItemType.Weapon, 10 ether, 100000000, abi.encode(weaponStats), "test_Weapon_uri1/");
        uint256 newItemId =
            world.UD__createItem(ItemType.Weapon, 100 ether, 100000000, abi.encode(weaponStats), "test_Weapon_uri/");

        assertEq(newItemId, 7);
        assertEq(world.UD__getTotalSupply(newItemId), 100 ether);
        assertEq(world.UD__getTotalSupply(firstItemId), 10 ether);
        assertEq(
            keccak256(abi.encode(erc1155System.uri(newItemId))),
            keccak256(abi.encode("ipfs://QmVUaqRpQJHyqugYd12Qf2iErNSoGvLF1cbeRHpmX8bChs/test_Weapon_uri/"))
        );

        endGasReport();
    }

    function test_CreateItem_Revert_NotNamespaceOwner() public {
        uint8[] memory restrictions = new uint8[](0);
        WeaponStats memory weaponStats = WeaponStats({
            agiModifier: 0,
            classRestrictions: restrictions,
            hitPointModifier: 0,
            intModifier: 0,
            maxDamage: 4,
            minDamage: 1,
            minLevel: 0,
            strModifier: 0
        });
        vm.startPrank(alice);
        vm.expectRevert();
        world.UD__createItem(ItemType.Weapon, 100 ether, 100000000, abi.encode(weaponStats), "test_Weapon_uri1/");
    }

    function test_GetTotalSupply() public {
        uint8[] memory restrictions = new uint8[](0);
        WeaponStats memory weaponStats = WeaponStats({
            agiModifier: 0,
            classRestrictions: restrictions,
            hitPointModifier: 0,
            intModifier: 0,
            maxDamage: 4,
            minDamage: 1,
            minLevel: 0,
            strModifier: 0
        });
        vm.startPrank(deployer);
        uint256 id =
            world.UD__createItem(ItemType.Weapon, 100 ether, 100000000, abi.encode(weaponStats), "test_Weapon_uri/");
        assertEq(world.UD__getTotalSupply(id), 100 ether);
    }

    function test_GetBalance() public {
        uint256 fees = entropy.getFee(address(1));
        vm.startPrank(alice);
        world.UD__rollStats{value: fees}(alicesRandomness, alicesCharacterId, Classes.Rogue);
        world.UD__enterGame(alicesCharacterId);
        StarterItemsData memory starterDat = world.UD__getStarterItems(Classes.Rogue);
        assertEq(erc1155System.balanceOf(address(alice), starterDat.itemIds[0]), starterDat.amounts[0]);
    }

    function test_dropItems() public {
        uint256[] memory itemIds = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);
        bytes32[] memory characterIds = new bytes32[](1);
        itemIds[0] = newArmorId;
        amounts[0] = 1;
        characterIds[0] = alicesCharacterId;
        world.UD__dropItems(characterIds, itemIds, amounts);

        assertEq(erc1155System.balanceOf(address(alice), newArmorId), 1);
    }

    function test_dropItems_Revert_UnauthorizedCaller() public {
        uint256[] memory itemIds = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);
        bytes32[] memory characterIds = new bytes32[](1);
        itemIds[0] = newArmorId;
        amounts[0] = 1;
        characterIds[0] = alicesCharacterId;
        vm.prank(bob);
        vm.expectRevert();
        world.UD__dropItems(characterIds, itemIds, amounts);
    }
}
