pragma solidity >=0.8.24;

import {SetUp} from "./SetUp.sol";
import {Classes, ItemType, EncounterType} from "@codegen/common.sol";
import {StatsData, Stats} from "@tables/Stats.sol";
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
import {WeaponStats, ArmorStats, Action} from "@interfaces/Structs.sol";
import {ResourceIdLib} from "@latticexyz/store/src/ResourceId.sol";
import {ResourceId, WorldResourceIdLib, WorldResourceIdInstance} from "@latticexyz/world/src/WorldResourceId.sol";
import {_itemsSystemId, _mobSystemId} from "../src/utils.sol";
import {
    GOLD_NAMESPACE,
    CHARACTERS_NAMESPACE,
    ERC721_NAME,
    ERC721_SYMBOL,
    TOKEN_URI,
    ITEMS_NAMESPACE
} from "../constants.sol";
import {GasReporter} from "@latticexyz/gas-report/src/GasReporter.sol";

contract Test_CombatSystem is SetUp, GasReporter {
    bytes32[] public defenders;
    bytes32[] public attackers;
    bytes32 entityId;

    function setUp() public override {
        super.setUp();
        vm.prank(deployer);
        world.grantAccess(_mobSystemId("UD"), address(this));

        entityId = world.UD__spawnMob(1, 1, 2);

        defenders.push(entityId);
        attackers.push(bobCharacterId);
    }

    function test_createMatch() public {
        vm.prank(bob);
        bytes32 matchId = world.UD__createMatch(EncounterType.PvE, attackers, defenders);
        assertEq(world.UD__getEncounter(matchId).start, block.timestamp);
    }

    function test_EndTurn() public {
        vm.prank(bob);
        bytes32 matchId = world.UD__createMatch(EncounterType.PvE, attackers, defenders);
        Action[] memory actions = new Action[](1);
        actions[0] =
            Action({attackerEntityId: bobCharacterId, defenderEntityId: entityId, actionId: basicAttackId, weaponId: 1});
        uint256 fees = entropy.getFee(address(1));
        vm.prank(bob);
        world.UD__endTurn{value: fees}(matchId, bobCharacterId, actions);

        assertGt(Stats.get(entityId).currentDamage, 0);
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
