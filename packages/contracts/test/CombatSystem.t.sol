pragma solidity >=0.8.24;

import {SetUp} from "./SetUp.sol";
import {Classes, ItemType, EncounterType} from "@codegen/common.sol";
import {StatsData, Stats} from "@tables/Stats.sol";
import {EncounterEntity} from "@tables/EncounterEntity.sol";
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
import {WeaponStats, ArmorStats, Action, Action} from "@interfaces/Structs.sol";
import {ResourceIdLib} from "@latticexyz/store/src/ResourceId.sol";
import {ResourceId, WorldResourceIdLib, WorldResourceIdInstance} from "@latticexyz/world/src/WorldResourceId.sol";
import {_itemsSystemId, _mobSystemId, _rngSystemId} from "../src/utils.sol";
import {
    GOLD_NAMESPACE,
    CHARACTERS_NAMESPACE,
    ERC721_NAME,
    ERC721_SYMBOL,
    TOKEN_URI,
    ITEMS_NAMESPACE
} from "../constants.sol";
import {CombatEncounterData} from "@codegen/index.sol";
import {GasReporter} from "@latticexyz/gas-report/src/GasReporter.sol";

contract Test_CombatSystem is SetUp, GasReporter {
    bytes32[] public defenders;
    bytes32[] public attackers;
    bytes32[] public pvpDefenders;
    bytes32 entityId;
    bytes32 entityId2;

    function setUp() public override {
        super.setUp();
        vm.prank(deployer);
        world.UD__setAdmin(address(this), true);

        vm.prank(deployer);
        world.grantAccess(_mobSystemId("UD"), address(this));

        entityId = world.UD__spawnMob(1, 0, 0);
        entityId2 = world.UD__spawnMob(1, 0, 0);

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

        defenders.push(entityId);
        attackers.push(bobCharacterId);
        pvpDefenders.push(alicesCharacterId);
    }

    function test_createEncounter_PvE() public {
        vm.prank(bob);
        bytes32 encounterId = world.UD__createEncounter(EncounterType.PvE, attackers, defenders);
        CombatEncounterData memory encounterData = world.UD__getEncounter(encounterId);
        assertEq(encounterData.start, block.timestamp);
        assertEq(encounterData.end, 0);
        assertEq(encounterData.attackers[0], bobCharacterId);
        assertEq(encounterData.defenders[0], entityId);
        assertEq(encounterData.attackers.length, encounterData.defenders.length);
    }

    function test_createEncounterPvP() public {
        // spawn characters
        vm.prank(bob);
        world.UD__spawn(bobCharacterId);
        vm.prank(alice);
        world.UD__spawn(alicesCharacterId);

        // cannot teleport entities from spawn point
        vm.prank(bob);
        world.UD__move(bobCharacterId, 0, 1);
        vm.prank(alice);
        world.UD__move(alicesCharacterId, 0, 1);

        // move entities to pvp zone
        world.UD__adminMoveEntity(bobCharacterId, 0, 1, 5, 5);
        world.UD__adminMoveEntity(alicesCharacterId, 0, 1, 5, 5);

        // if alice creates the encounter and has lower agi, she should still be the defender
        vm.prank(alice);
        bytes32 encounterId = world.UD__createEncounter(EncounterType.PvP, pvpDefenders, attackers);
        CombatEncounterData memory encounterData = world.UD__getEncounter(encounterId);
        assertEq(encounterData.start, block.timestamp);
        assertEq(encounterData.defenders[0], alicesCharacterId);
        assertEq(encounterData.attackers[0], bobCharacterId);
    }

    function test_PvPTimer() public {
        // spawn characters
        vm.prank(bob);
        world.UD__spawn(bobCharacterId);
        vm.prank(alice);
        world.UD__spawn(alicesCharacterId);

        // cannot teleport entities from spawn point
        vm.prank(bob);
        world.UD__move(bobCharacterId, 0, 1);
        vm.prank(alice);
        world.UD__move(alicesCharacterId, 0, 1);

        // move entities to pvp zone
        world.UD__adminMoveEntity(bobCharacterId, 0, 1, 5, 5);
        world.UD__adminMoveEntity(alicesCharacterId, 0, 1, 5, 5);

        // if alice creates the encounter and has lower agi, she should still be the defender
        vm.prank(alice);
        bytes32 encounterId = world.UD__createEncounter(EncounterType.PvP, pvpDefenders, attackers);

        Action[] memory bobActions = new Action[](1);
        Action[] memory aliceActions = new Action[](1);

        vm.prank(bob);
        // bob's move
        bobActions[0] = Action({
            attackerEntityId: bobCharacterId,
            defenderEntityId: alicesCharacterId,
            actionId: basicAttackId,
            weaponId: 2
        });

        //alice's move

        aliceActions[0] = Action({
            attackerEntityId: alicesCharacterId,
            defenderEntityId: bobCharacterId,
            actionId: basicAttackId,
            weaponId: 2
        });

        uint256 fees = 0; // entropy.getFee(address(1));

        //assert alice is a defender
        assertEq(alicesCharacterId, world.UD__getEncounter(encounterId).defenders[0]);
        // alice should move 1st even though she is defender if combat timer is out
        vm.warp(block.timestamp + 31);
        vm.prank(alice);
        world.UD__endTurn{value: fees}(encounterId, alicesCharacterId, aliceActions);
        vm.prank(bob);
        world.UD__endTurn{value: fees}(encounterId, bobCharacterId, bobActions);
    }

    function test_CreateEncounterPvP_Revert_WrongPosition() public {
        // expect revert because both characters are in the safe zone
        vm.expectRevert();
        vm.prank(alice);
        world.UD__createEncounter(EncounterType.PvP, attackers, pvpDefenders);
    }

    function test_createPvEEncounter_Revert_Entities_Wrong_Position() public {
        entityId2 = world.UD__spawnMob(1, 0, 1);
        defenders[0] = entityId2;
        vm.prank(bob);
        vm.expectRevert("COMBAT SYSTEM: INVALID PVE");
        world.UD__createEncounter(EncounterType.PvE, attackers, defenders);
    }

    function test_CreateEncounter_Revert_ENTITY_OCCUPIED() public {
        vm.prank(bob);
        bytes32 encounterId = world.UD__createEncounter(EncounterType.PvE, attackers, defenders);
        assertEq(world.UD__getEncounter(encounterId).start, block.timestamp);
        vm.prank(bob);
        vm.expectRevert("COMBAT SYSTEM: INVALID ENTITY");
        world.UD__createEncounter(EncounterType.PvE, attackers, defenders);
    }

    function test_EndTurn_Revert_No_Access() public {
        vm.prank(bob);
        bytes32 encounterId = world.UD__createEncounter(EncounterType.PvE, attackers, defenders);
        vm.expectRevert();
        world.UD__endEncounter(encounterId, 1000000000, true);
    }

    function test_ExecutePvECombat_Revert_No_Access(address caller) public {
        vm.assume(caller != world.UD__getSystemAddress(_rngSystemId("")));
        Action[] memory actions = new Action[](1);
        vm.expectRevert();
        world.UD__executePvECombat(1000000000, keccak256(abi.encode("11111")), actions);
    }

    function test_EndTurn_EndsPvEEncounter() public {
        StatsData memory startingStats = Stats.get(bobCharacterId);
        uint256 startingGold = goldToken.balanceOf(bob);
        vm.prank(bob);
        bytes32 encounterId = world.UD__createEncounter(EncounterType.PvE, attackers, defenders);
        Action[] memory actions = new Action[](1);

        actions[0] =
            Action({attackerEntityId: bobCharacterId, defenderEntityId: entityId, actionId: basicAttackId, weaponId: 2});
        uint256 fees = 0; // entropy.getFee(address(1));
        vm.prank(bob);
        world.UD__endTurn{value: fees}(encounterId, bobCharacterId, actions);

        while (world.UD__getEncounter(encounterId).end == 0) {
            vm.prank(bob);
            world.UD__endTurn{value: fees}(encounterId, bobCharacterId, actions);
        }

        StatsData memory endingStats = Stats.get(bobCharacterId);
        uint256 endingGold = goldToken.balanceOf(bob);
        int256 bobEndingHp = Stats.get(bobCharacterId).currentHp;

        if (bobEndingHp > 0) {
            assertGt(endingStats.experience, startingStats.experience, "incorrect exp");
            assertGt(endingGold, startingGold);
            assertNotEq(startingStats.currentHp, Stats.get(entityId).currentHp);
        } else {
            assertNotEq(startingStats.currentHp, Stats.get(bobCharacterId).currentHp);
            assertFalse(EncounterEntity.getDied(entityId), "incorrect died");
        }

        assertEq(EncounterEntity.getEncounterId(bobCharacterId), bytes32(0));
    }

    function test_EndTurn_EndsPvPEncounter() public {
        StatsData memory startingBobStats = Stats.get(bobCharacterId);
        StatsData memory startingAliceStats = Stats.get(alicesCharacterId);
        uint256 startingGold = goldToken.balanceOf(bob);

        // spawn characters
        vm.prank(bob);
        world.UD__spawn(bobCharacterId);
        vm.prank(alice);
        world.UD__spawn(alicesCharacterId);

        // cannot teleport entities from spawn point
        vm.prank(bob);
        world.UD__move(bobCharacterId, 0, 1);
        vm.prank(alice);
        world.UD__move(alicesCharacterId, 0, 1);

        // move entities to pvp zone
        world.UD__adminMoveEntity(bobCharacterId, 0, 1, 5, 5);
        world.UD__adminMoveEntity(alicesCharacterId, 0, 1, 5, 5);

        vm.prank(bob);
        bytes32 encounterId = world.UD__createEncounter(EncounterType.PvP, attackers, pvpDefenders);

        Action[] memory bobActions = new Action[](1);
        Action[] memory aliceActions = new Action[](1);

        vm.prank(bob);
        // bob's move
        bobActions[0] = Action({
            attackerEntityId: bobCharacterId,
            defenderEntityId: alicesCharacterId,
            actionId: basicAttackId,
            weaponId: 2
        });

        uint256 fees = 0; // entropy.getFee(address(1));

        //alice's move

        aliceActions[0] = Action({
            attackerEntityId: alicesCharacterId,
            defenderEntityId: bobCharacterId,
            actionId: basicAttackId,
            weaponId: 2
        });

        while (world.UD__getEncounter(encounterId).end == 0) {
            vm.prank(bob);
            world.UD__endTurn{value: fees}(encounterId, bobCharacterId, bobActions);
            // break if bob wins
            if (world.UD__getEncounter(encounterId).end != 0) {
                break;
            }
            // bob's move
            vm.prank(alice);
            world.UD__endTurn{value: fees}(encounterId, alicesCharacterId, aliceActions);
        }

        StatsData memory endingBobStats = Stats.get(bobCharacterId);
        StatsData memory endingAliceStats = Stats.get(alicesCharacterId);
        uint256 endingGold = goldToken.balanceOf(bob);
        int256 bobEndingHp = Stats.get(bobCharacterId).currentHp;

        if (bobEndingHp > 0) {
            assertNotEq(startingAliceStats.currentHp, endingAliceStats.currentHp);
        } else {
            assertNotEq(startingBobStats.currentHp, endingBobStats.currentHp);
        }

        assertEq(EncounterEntity.getEncounterId(bobCharacterId), bytes32(0));
        assertEq(EncounterEntity.getEncounterId(alicesCharacterId), bytes32(0));
    }

    function test_EndTurn_Revert_NonCombatant() public {
        vm.prank(bob);
        bytes32 encounterId = world.UD__createEncounter(EncounterType.PvE, attackers, defenders);
        Action[] memory actions = new Action[](1);
        actions[0] =
            Action({attackerEntityId: bobCharacterId, defenderEntityId: entityId, actionId: basicAttackId, weaponId: 1});
        uint256 fees = entropy.getFee(address(1));
        vm.expectRevert("COMBAT SYSTEM: NON-COMBATANT");
        world.UD__endTurn{value: fees}(encounterId, bobCharacterId, actions);
    }
}
