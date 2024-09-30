pragma solidity >=0.8.24;

import {SetUp} from "./SetUp.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";
import {Classes, ItemType, EncounterType} from "@codegen/common.sol";
import {StatsData, Stats} from "@tables/Stats.sol";
import {EncounterEntity} from "@tables/EncounterEntity.sol";
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
import {Action, AdjustedCombatStats} from "@interfaces/Structs.sol";
import {ResourceIdLib} from "@latticexyz/store/src/ResourceId.sol";
import {ResourceId, WorldResourceIdLib, WorldResourceIdInstance} from "@latticexyz/world/src/WorldResourceId.sol";
import {
    CombatEncounterData,
    MagicDamageStats,
    PhysicalDamageStatsData,
    StatusEffectStatsData,
    StatusEffectValidityData
} from "@codegen/index.sol";
import {_mobSystemId, _lootManagerSystemId} from "../src/utils.sol";
import {GasReporter} from "@latticexyz/gas-report/src/GasReporter.sol";

contract Test_EffectsSystem is SetUp, GasReporter {
    bytes32[] public defenders;
    bytes32[] public attackers;
    bytes32[] public pvpDefenders;
    bytes32 entityId;
    bytes32 entityId2;

    function setUp() public virtual override {
        super.setUp();
        vm.prank(deployer);
        world.UD__setAdmin(address(this), true);

        vm.prank(deployer);
        world.grantAccess(_mobSystemId("UD"), address(this));

        entityId = world.UD__spawnMob(1, 0, 1);
        entityId2 = world.UD__spawnMob(1, 0, 1);

        vm.startPrank(alice);
        world.UD__rollStats(alicesRandomness, alicesCharacterId, Classes.Rogue);
        world.UD__enterGame(alicesCharacterId);
        vm.stopPrank();

        // alice has lower agi to go second
        StatsData memory alicesStats = world.UD__getStats(alicesCharacterId);
        alicesStats.agility = 9;
        world.UD__adminSetStats(alicesCharacterId, alicesStats);

        // bob has higher agi to go first
        StatsData memory BobStats = world.UD__getStats(bobCharacterId);
        BobStats.agility = 10;
        world.UD__adminSetStats(bobCharacterId, BobStats);

        // spawn characters
        vm.prank(bob);
        world.UD__spawn(bobCharacterId);
        vm.prank(alice);
        world.UD__spawn(alicesCharacterId);

        vm.prank(bob);
        world.UD__move(bobCharacterId, 0, 1);
        vm.prank(alice);
        world.UD__move(alicesCharacterId, 0, 1);

        defenders.push(entityId);
        attackers.push(bobCharacterId);
        pvpDefenders.push(alicesCharacterId);
    }

    function test_applyStatusEffect() public {
        entityId = world.UD__spawnMob(1, 0, 1);
        vm.prank(bob);
        bytes32 encounterId = world.UD__createEncounter(EncounterType.PvE, attackers, defenders);
        CombatEncounterData memory encounterData = world.UD__getEncounter(encounterId);
        StatsData memory startingStats = world.UD__getStats(bobCharacterId);
        world.UD__adminApplyStatusEffect(
            bobCharacterId, bytes32(0xd2812fe9b0b2cad2000000000000000000000000000000000000000000000000)
        );
        AdjustedCombatStats memory endingStats = world.UD__calculateAllStatusEffects(bobCharacterId);
        assertEq(endingStats.agility, startingStats.agility - int256(8));
    }

    function test_Consumable_Heals() public {
        StatsData memory newStats = world.UD__getStats(bobCharacterId);
        console.log("TEST STATS");
        console.logInt(newStats.maxHp);
        newStats.currentHp = int256(newStats.maxHp) - 1;
        world.UD__adminSetStats(bobCharacterId, newStats);
        // health potion
        uint256 healthPotionId = startingConsumableId;
        assertEq(erc1155System.balanceOf(bob, healthPotionId), 1);
        vm.startPrank(bob);
        erc1155System.setApprovalForAll(Systems.getSystem(_lootManagerSystemId("UD")), true);
        world.UD__useWorldConsumableItem(bobCharacterId, bobCharacterId, healthPotionId);

        assertEq(erc1155System.balanceOf(bob, healthPotionId), 0);
        assertEq(world.UD__getStats(bobCharacterId).currentHp, newStats.maxHp);
    }

    function test_Consumable_Heals_Revert_NoItem() public {
        StatsData memory newStats = world.UD__getStats(bobCharacterId);
        newStats.currentHp = 1;
        world.UD__adminSetStats(bobCharacterId, newStats);
        // health potion
        uint256 healthPotionId = startingConsumableId;
        assertEq(erc1155System.balanceOf(bob, healthPotionId), 1);
        vm.startPrank(bob);
        erc1155System.setApprovalForAll(Systems.getSystem(_lootManagerSystemId("UD")), true);
        world.UD__useWorldConsumableItem(bobCharacterId, bobCharacterId, healthPotionId);

        assertEq(erc1155System.balanceOf(bob, healthPotionId), 0);
        assertGt(world.UD__getStats(bobCharacterId).currentHp, 1);
        vm.expectRevert();
        world.UD__useWorldConsumableItem(bobCharacterId, bobCharacterId, healthPotionId);
    }

    function test_consumable_strBuff() public {
        StatsData memory beginningStats = world.UD__getStats(bobCharacterId);
        uint256 strBuffId = startingConsumableId + 1;
        world.UD__adminDropItem(bobCharacterId, strBuffId, 1);

        assertEq(erc1155System.balanceOf(bob, strBuffId), 1);
        vm.startPrank(bob);
        erc1155System.setApprovalForAll(Systems.getSystem(_lootManagerSystemId("UD")), true);
        world.UD__useWorldConsumableItem(bobCharacterId, bobCharacterId, strBuffId);

        StatsData memory endingStats = world.UD__getStats(bobCharacterId);
        assertEq(endingStats.strength, beginningStats.strength + 5);
    }

    function test_consumable_strBuff_consume2() public {
        StatsData memory beginningStats = world.UD__getStats(bobCharacterId);
        uint256 strBuffId = startingConsumableId + 1;
        world.UD__adminDropItem(bobCharacterId, strBuffId, 2);

        assertEq(erc1155System.balanceOf(bob, strBuffId), 2);
        vm.startPrank(bob);
        erc1155System.setApprovalForAll(Systems.getSystem(_lootManagerSystemId("UD")), true);
        world.UD__useWorldConsumableItem(bobCharacterId, bobCharacterId, strBuffId);

        StatsData memory endingStats = world.UD__getStats(bobCharacterId);
        assertEq(endingStats.strength, beginningStats.strength + 5);
        world.UD__useWorldConsumableItem(bobCharacterId, bobCharacterId, strBuffId);
        assertEq(endingStats.strength, beginningStats.strength + 5);
    }

    function test_consumable_strBuff_expired() public {
        StatsData memory beginningStats = world.UD__getStats(bobCharacterId);
        uint256 strBuffId = startingConsumableId + 1;
        world.UD__adminDropItem(bobCharacterId, strBuffId, 1);

        assertEq(erc1155System.balanceOf(bob, strBuffId), 1);

        vm.prank(deployer);
        bytes32 entityId = world.UD__spawnMob(2, 0, 1);

        vm.startPrank(bob);
        erc1155System.setApprovalForAll(Systems.getSystem(_lootManagerSystemId("UD")), true);
        world.UD__useWorldConsumableItem(bobCharacterId, bobCharacterId, strBuffId);

        vm.warp(block.timestamp + 1000);

        bytes32[] memory defenders = new bytes32[](1);
        bytes32[] memory attackers = new bytes32[](1);

        attackers[0] = bobCharacterId;
        defenders[0] = entityId;

        bytes32 encounterId = world.UD__createEncounter(EncounterType.PvE, attackers, defenders);
        Action[] memory actions = new Action[](1);
        actions[0] = Action({attackerEntityId: bobCharacterId, defenderEntityId: entityId, itemId: startingSpellId});

        world.UD__endTurn(encounterId, bobCharacterId, actions);
        StatsData memory endingStats = world.UD__getStats(bobCharacterId);
        assertEq(endingStats.strength, beginningStats.strength);
    }

    function test_Poison() public {
        StatsData memory newStats = world.UD__getStats(bobCharacterId);
        newStats.agility = 20;
        newStats.strength = 20;
        newStats.currentHp = 100;
        world.UD__adminSetStats(bobCharacterId, newStats);

        uint256 poisonDartId = startingWeaponId + 7;

        vm.prank(deployer);
        bytes32 entityId = world.UD__spawnMob(2, 0, 1);
        StatsData memory mobStats = world.UD__getStats(entityId);

        bytes32[] memory defenders = new bytes32[](1);
        bytes32[] memory attackers = new bytes32[](1);

        attackers[0] = bobCharacterId;
        defenders[0] = entityId;

        vm.startPrank(bob);
        bytes32 encounterId = world.UD__createEncounter(EncounterType.PvE, attackers, defenders);
        Action[] memory actions = new Action[](1);
        actions[0] = Action({attackerEntityId: bobCharacterId, defenderEntityId: entityId, itemId: poisonDartId});

        world.UD__endTurn(encounterId, bobCharacterId, actions);

        StatsData memory endingStats = world.UD__getStats(entityId);

        assertLt(endingStats.currentHp, mobStats.currentHp);
    }
}
