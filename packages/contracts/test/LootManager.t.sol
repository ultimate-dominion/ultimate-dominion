// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {SetUp} from "./SetUp.sol";
import {Classes, ItemType} from "@codegen/common.sol";
import {
    StatsData,
    StarterItemsData,
    WeaponStatsData,
    StatRestrictionsData,
    UltimateDominionConfig,
    Stats,
    Levels
} from "@codegen/index.sol";
import {EncounterType} from "@codegen/common.sol";
import "forge-std/console.sol";
import {PuppetModule} from "@latticexyz/world-modules/src/modules/puppet/PuppetModule.sol";
import {UltimateDominionConfigSystem} from "@systems/UltimateDominionConfigSystem.sol";
import {ERC1155Module} from "@erc1155/ERC1155Module.sol";
import {ERC1155System} from "@erc1155/ERC1155System.sol";
import {IERC1155MetadataURI} from "@erc1155/IERC1155MetadataURI.sol";
import {IERC1155} from "@erc1155/IERC1155.sol";
import {registerERC1155} from "@erc1155/registerERC1155.sol";
import {_erc1155SystemId} from "@erc1155/utils.sol";
import {ResourceIdLib} from "@latticexyz/store/src/ResourceId.sol";
import {ResourceId, WorldResourceIdLib, WorldResourceIdInstance} from "@latticexyz/world/src/WorldResourceId.sol";
import {_itemsSystemId, _lootManagerSystemId, _mobSystemId} from "../src/utils.sol";
import {
    GOLD_NAMESPACE,
    CHARACTERS_NAMESPACE,
    ERC721_NAME,
    ERC721_SYMBOL,
    TOKEN_URI,
    ITEMS_NAMESPACE,
    MAX_LEVEL
} from "../constants.sol";
import {Action} from "@interfaces/Structs.sol";
import {GasReporter} from "@latticexyz/gas-report/src/GasReporter.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";

contract Test_LootManagerSystem is SetUp, GasReporter {
    address lootManagerSystem;
    bytes32[] public defenders;
    bytes32[] public attackers;
    bytes32[] public pvpDefenders;
    bytes32 entityId;
    bytes32 entityId2;
    uint256 spawnedMobId;

    function setUp() public override {
        super.setUp();
        lootManagerSystem = Systems.getSystem(_lootManagerSystemId("UD"));

        vm.prank(deployer);
        world.UD__setAdmin(address(this), true);

        vm.prank(deployer);
        world.grantAccess(_mobSystemId("UD"), address(this));
        spawnedMobId = 5;
        entityId = world.UD__spawnMob(spawnedMobId, 0, 1);
        entityId2 = world.UD__spawnMob(spawnedMobId, 0, 1);

        // spawn characters
        vm.prank(bob);
        world.UD__spawn(bobCharacterId);

        // buff bob
        StatsData memory bobStats = world.UD__getStats(bobCharacterId);
        bobStats.agility = 10;
        bobStats.strength = 10;
        bobStats.intelligence = 10;
        bobStats.currentHp = 100;
        world.UD__adminSetStats(bobCharacterId, bobStats);

        // get alice starter Items
        StarterItemsData memory starterDat = world.UD__getStarterItems(Classes.Rogue);

        // get bob starter items
        starterDat = world.UD__getStarterItems(Classes.Mage);

        vm.prank(bob);
        world.UD__equipItems(bobCharacterId, starterDat.itemIds);

        defenders.push(entityId);
        attackers.push(bobCharacterId);
        pvpDefenders.push(alicesCharacterId);
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

    function test_expCap() public {
        vm.prank(bob);
        world.UD__move(bobCharacterId, 0, 1);
        // buff bob
        StatsData memory bobStats = world.UD__getStats(bobCharacterId);
        bobStats.agility = 5;
        bobStats.strength = 10;
        bobStats.intelligence = 10;
        bobStats.currentHp = 100;
        bobStats.experience = 84999;
        world.UD__adminSetStats(bobCharacterId, bobStats);

        vm.prank(bob);
        bytes32 encounterId = world.UD__createEncounter(EncounterType.PvE, attackers, defenders);
        Action[] memory actions = new Action[](1);
        actions[0] = Action({attackerEntityId: bobCharacterId, defenderEntityId: entityId, itemId: startingConsumableId});
        uint256 fees = 0; // entropy.getFee(address(1));
        vm.prank(bob);
        world.UD__endTurn(encounterId, bobCharacterId, actions);

        while (world.UD__getEncounter(encounterId).end == 0) {
            vm.prank(bob);
            world.UD__endTurn(encounterId, bobCharacterId, actions);
            int256 bobHp = Stats.getCurrentHp(bobCharacterId);
            int256 entityHp = Stats.getCurrentHp(entityId);
        }

        assertEq(Stats.getExperience(bobCharacterId), Levels.get(MAX_LEVEL));
    }
}
