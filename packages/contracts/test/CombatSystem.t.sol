pragma solidity >=0.8.24;

import {SetUp} from "./SetUp.sol";
import {Classes, ItemType, EncounterType} from "@codegen/common.sol";
import {StatsData, Stats} from "@tables/Stats.sol";
import {MatchEntity} from "@tables/MatchEntity.sol";
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
        world.grantAccess(_mobSystemId("UD"), address(this));

        entityId = world.UD__spawnMob(1, 0, 0);
        entityId2 = world.UD__spawnMob(1, 0, 0);

        vm.startPrank(alice);
        world.UD__rollStats(alicesRandomness, alicesCharacterId, Classes.Rogue);
        world.UD__enterGame(alicesCharacterId);
        vm.stopPrank();

        defenders.push(entityId);
        attackers.push(bobCharacterId);
        pvpDefenders.push(alicesCharacterId);
    }

    function test_createMatch_PvE() public {
        vm.prank(bob);
        bytes32 matchId = world.UD__createMatch(EncounterType.PvE, attackers, defenders);
        assertEq(world.UD__getEncounter(matchId).start, block.timestamp);
    }

    function test_createMatchPvP() public {
        vm.prank(alice);
        world.UD__setPvpFlag(alicesCharacterId, true);
        vm.prank(bob);
        world.UD__setPvpFlag(bobCharacterId, true);

        vm.prank(bob);
        bytes32 matchId = world.UD__createMatch(EncounterType.PvP, attackers, pvpDefenders);
        CombatEncounterData memory encounterData = world.UD__getEncounter(matchId);
        assertEq(encounterData.start, block.timestamp);
        assertEq(encounterData.defenders[0], alicesCharacterId);
        assertEq(encounterData.attackers[0], bobCharacterId);
    }

    function test_createMatch_Revert_Entities_Wrong_Position() public {
        entityId2 = world.UD__spawnMob(1, 0, 1);
        defenders[0] = entityId2;
        vm.prank(bob);
        vm.expectRevert("COMBAT SYSTEM: INVALID PVE");
        bytes32 matchId = world.UD__createMatch(EncounterType.PvE, attackers, defenders);
    }

    function test_CreateMatch_Revert_ENTITY_OCCUPIED() public {
        vm.prank(bob);
        bytes32 matchId = world.UD__createMatch(EncounterType.PvE, attackers, defenders);
        assertEq(world.UD__getEncounter(matchId).start, block.timestamp);
        vm.prank(bob);
        vm.expectRevert("COMBAT SYSTEM: INVALID ENTITY");
        world.UD__createMatch(EncounterType.PvE, attackers, defenders);
    }

    function test_EndTurn_Revert_No_Access() public {
        StatsData memory startingStats = Stats.get(bobCharacterId);
        uint256 startingGold = goldToken.balanceOf(bob);
        vm.prank(bob);
        bytes32 matchId = world.UD__createMatch(EncounterType.PvE, attackers, defenders);
        vm.expectRevert();
        world.UD__endMatch(matchId, 1000000000, true);
    }

    function test_ExecutePvECombat_Revert_No_Access(address caller) public {
        vm.assume(caller != world.UD__getSystemAddress(_rngSystemId("")));
        Action[] memory actions = new Action[](1);
        vm.expectRevert();
        world.UD__executePvECombat(1000000000, keccak256(abi.encode("11111")), actions);
    }

    function test_EndTurn_EndsMatch() public {
        StatsData memory startingStats = Stats.get(bobCharacterId);
        uint256 startingGold = goldToken.balanceOf(bob);
        vm.prank(bob);
        bytes32 matchId = world.UD__createMatch(EncounterType.PvE, attackers, defenders);
        Action[] memory actions = new Action[](1);
        actions[0] =
            Action({attackerEntityId: bobCharacterId, defenderEntityId: entityId, actionId: basicAttackId, weaponId: 2});
        uint256 fees = entropy.getFee(address(1));
        vm.prank(bob);
        world.UD__endTurn{value: fees}(matchId, bobCharacterId, actions);

        while (world.UD__getEncounter(matchId).end == 0) {
            vm.prank(bob);
            world.UD__endTurn{value: fees}(matchId, bobCharacterId, actions);
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
            assertFalse(MatchEntity.getDied(entityId), "incorrect died");
        }

        assertEq(MatchEntity.getEncounterId(bobCharacterId), bytes32(0));
    }

    function test_EndTurn_Revert_NonCombatant() public {
        vm.prank(bob);
        bytes32 matchId = world.UD__createMatch(EncounterType.PvE, attackers, defenders);
        Action[] memory actions = new Action[](1);
        actions[0] =
            Action({attackerEntityId: bobCharacterId, defenderEntityId: entityId, actionId: basicAttackId, weaponId: 1});
        uint256 fees = entropy.getFee(address(1));
        vm.expectRevert("COMBAT SYSTEM: NON-COMBATANT");
        world.UD__endTurn{value: fees}(matchId, bobCharacterId, actions);
    }
}
