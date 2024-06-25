pragma solidity >=0.8.24;

import {SetUp} from "./SetUp.sol";
import {Classes, ItemType} from "@codegen/common.sol";
import {CharacterStatsData} from "@tables/CharacterStats.sol";
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
    function test_CreateItem() public {
        startGasReport("creates an item");

        uint8[] memory restrictions = new uint8[](0);
        WeaponStats memory weaponStats = WeaponStats({damage: 1, speed: 2, classRestrictions: restrictions});
        vm.startPrank(deployer);
        uint256 firstItemId =
            world.UD__createItem(ItemType.Weapon, 10 ether, abi.encode(weaponStats), "test_Weapon_uri1/");
        uint256 newItemId =
            world.UD__createItem(ItemType.Weapon, 100 ether, abi.encode(weaponStats), "test_Weapon_uri/");

        assertEq(newItemId, 3);
        assertEq(world.UD__getTotalSupply(newItemId), 100 ether);
        assertEq(world.UD__getTotalSupply(firstItemId), 10 ether);
        assertEq(
            keccak256(abi.encode(erc1155System.uri(newItemId))),
            keccak256(abi.encode("test_Items_uri/test_Weapon_uri/"))
        );

        endGasReport();
    }

    function test_CreateItem_Revert_NotNamespaceOwner() public {
        uint8[] memory restrictions = new uint8[](0);
        WeaponStats memory weaponStats = WeaponStats({damage: 1, speed: 2, classRestrictions: restrictions});
        vm.startPrank(alice);
        vm.expectRevert();
        world.UD__createItem(ItemType.Weapon, 100 ether, abi.encode(weaponStats), "test_Weapon_uri1/");
    }

    function test_GetTotalSupply() public {
        uint8[] memory restrictions = new uint8[](0);
        WeaponStats memory weaponStats = WeaponStats({damage: 1, speed: 2, classRestrictions: restrictions});
        vm.startPrank(deployer);
        uint256 id = world.UD__createItem(ItemType.Weapon, 100 ether, abi.encode(weaponStats), "test_Weapon_uri/");
        assertEq(world.UD__getTotalSupply(id), 100 ether);
    }

    function test_GetBalance() public {
        uint256 fees = entropy.getFee(address(1));
        vm.startPrank(alice);
        world.UD__rollStats{value: fees}(alicesRandomness, alicesCharacterId, Classes.Rogue);
        world.UD__enterGame(alicesCharacterId);
        assertEq(erc1155System.balanceOf(address(alice), 1), 1);
    }
}
