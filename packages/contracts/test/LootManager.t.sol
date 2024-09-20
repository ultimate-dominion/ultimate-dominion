// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {SetUp} from "./SetUp.sol";
import {Classes, ItemType} from "@codegen/common.sol";
import {StatsData, StarterItemsData, WeaponStatsData, StatRestrictionsData} from "@codegen/index.sol";
import "forge-std/console.sol";
import {PuppetModule} from "@latticexyz/world-modules/src/modules/puppet/PuppetModule.sol";
import {UltimateDominionConfig} from "@codegen/index.sol";
import {UltimateDominionConfigSystem} from "@systems/UltimateDominionConfigSystem.sol";
import {ERC1155Module} from "@erc1155/ERC1155Module.sol";
import {ERC1155System} from "@erc1155/ERC1155System.sol";
import {IERC1155MetadataURI} from "@erc1155/IERC1155MetadataURI.sol";
import {IERC1155} from "@erc1155/IERC1155.sol";
import {registerERC1155} from "@erc1155/registerERC1155.sol";
import {_erc1155SystemId} from "@erc1155/utils.sol";
import {ResourceIdLib} from "@latticexyz/store/src/ResourceId.sol";
import {ResourceId, WorldResourceIdLib, WorldResourceIdInstance} from "@latticexyz/world/src/WorldResourceId.sol";
import {_itemsSystemId, _lootManagerSystemId} from "../src/utils.sol";
import {
    GOLD_NAMESPACE,
    CHARACTERS_NAMESPACE,
    ERC721_NAME,
    ERC721_SYMBOL,
    TOKEN_URI,
    ITEMS_NAMESPACE
} from "../constants.sol";
import {GasReporter} from "@latticexyz/gas-report/src/GasReporter.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";

contract Test_LootManagerSystem is SetUp, GasReporter {
    address lootManagerSystem;

    function setUp() public override {
        super.setUp();
        lootManagerSystem = Systems.getSystem(_lootManagerSystemId("UD"));
    }

    function test_depositToEscrow() public {
        vm.startPrank(bob);
        goldToken.approve(lootManagerSystem, 1 ether);
        world.UD__depositToEscrow(bobCharacterId, 1 ether);
        assertEq(world.UD__getEscrowBalance(bobCharacterId), 1 ether);
    }

    function test_withDrawFromEscrow() public {
        assertEq(goldToken.balanceOf(bob), 5 ether);
        vm.startPrank(bob);
        goldToken.approve(lootManagerSystem, 1 ether);
        world.UD__depositToEscrow(bobCharacterId, 1 ether);
        assertEq(world.UD__getEscrowBalance(bobCharacterId), 1 ether);
        assertEq(goldToken.balanceOf(bob), 4 ether);

        world.UD__withdrawFromEscrow(bobCharacterId, 0.5 ether);
        assertEq(world.UD__getEscrowBalance(bobCharacterId), 0.5 ether);
        assertEq(goldToken.balanceOf(bob), 4.5 ether);
    }

    function test_calculateExpMultiplier() public {
        vm.prank(deployer);
        world.UD__adminDropGold(bobCharacterId, 10 ether);
        vm.startPrank(bob);
        goldToken.approve(lootManagerSystem, 10 ether);
        world.UD__depositToEscrow(bobCharacterId, 10 ether);
        uint256 expMultiplier = world.UD__calculateExpMultiplier(bobCharacterId);
        assertEq(expMultiplier, 1158113883000000000);
    }
}
