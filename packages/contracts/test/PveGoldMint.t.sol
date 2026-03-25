// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {SetUp} from "./SetUp.sol";
import {Classes, EncounterType} from "@codegen/common.sol";
import {StatsData, Stats, StarterItemsData, GasReserve} from "@codegen/index.sol";
import {Action} from "@interfaces/Structs.sol";
import {_mobSystemId} from "../src/utils.sol";
import {_balancesTableId} from "@latticexyz/world-modules/src/modules/erc20-puppet/utils.sol";
import {Balances as ERC20Balances} from "@latticexyz/world-modules/src/modules/tokens/tables/Balances.sol";
import {GOLD_NAMESPACE} from "../constants.sol";

/**
 * @title Test_PveGoldMint
 * @notice Commit 3: PvE rewards mint real Gold to wallet + GasReserve.
 *
 * Cases:
 *   1. PvE kill mints Gold to player wallet
 *   2. PvE kill updates GasReserve with 5% split
 *   3. XP gain is flat — no escrow-based multiplier
 */
contract Test_PveGoldMint is SetUp {
    bytes32[] public defenders;
    bytes32[] public attackers;
    bytes32 entityId;

    function setUp() public override {
        super.setUp();

        vm.prank(deployer);
        world.UD__setAdmin(address(this), true);

        vm.prank(deployer);
        world.grantAccess(_mobSystemId("UD"), address(this));

        entityId = world.UD__spawnMob(5, 0, 1);

        // spawn bob
        vm.prank(bob);
        world.UD__spawn(bobCharacterId);

        // equip bob's starter items
        StarterItemsData memory starterDat = world.UD__getStarterItems(Classes.Mage);
        vm.prank(bob);
        world.UD__equipItems(bobCharacterId, starterDat.itemIds);

        defenders.push(entityId);
        attackers.push(bobCharacterId);
    }

    /// @notice Helper: buff bob to guarantee he wins the fight
    function _buffBob() internal {
        StatsData memory bobStats = world.UD__getStats(bobCharacterId);
        bobStats.agility = 50;
        bobStats.strength = 50;
        bobStats.intelligence = 50;
        bobStats.currentHp = 200;
        world.UD__adminSetStats(bobCharacterId, bobStats);
    }

    /// @notice Helper: run a PvE fight to completion
    function _fightToEnd(bytes32 encounterId) internal {
        Action[] memory actions = new Action[](1);
        actions[0] = Action({
            attackerEntityId: bobCharacterId,
            defenderEntityId: entityId,
            itemId: startingConsumableId
        });

        while (world.UD__getEncounter(encounterId).end == 0) {
            vm.prank(bob);
            world.UD__endTurn(encounterId, bobCharacterId, actions);
        }
    }

    // ===== 1. PvE kill mints Gold to player wallet =====
    function test_pveKill_mintsGoldToWallet() public {
        _buffBob();

        uint256 walletBefore = goldToken.balanceOf(bob);

        vm.prank(bob);
        world.UD__move(bobCharacterId, 0, 1);

        vm.prank(bob);
        bytes32 encounterId = world.UD__createEncounter(EncounterType.PvE, attackers, defenders);
        _fightToEnd(encounterId);

        uint256 walletAfter = goldToken.balanceOf(bob);
        assertGt(walletAfter, walletBefore, "Player wallet should have more Gold after PvE kill");
    }

    // ===== 2. PvE kill updates GasReserve with 5% split =====
    function test_pveKill_updatesGasReserve() public {
        _buffBob();

        uint256 reserveBefore = GasReserve.getBalance(bobCharacterId);
        assertEq(reserveBefore, 0, "GasReserve should start at 0");

        vm.prank(bob);
        world.UD__move(bobCharacterId, 0, 1);

        vm.prank(bob);
        bytes32 encounterId = world.UD__createEncounter(EncounterType.PvE, attackers, defenders);
        _fightToEnd(encounterId);

        uint256 reserveAfter = GasReserve.getBalance(bobCharacterId);
        assertGt(reserveAfter, 0, "GasReserve should have a balance after PvE kill");

        // Verify the 95/5 split: playerGold = totalGold - reserveGold
        // reserveGold = totalGold / 20, so playerGold = totalGold - totalGold/20
        // Check: reserve * 19 <= playerGold (within integer rounding)
        uint256 walletGained = goldToken.balanceOf(bob) - 5 ether; // subtract the 5 Gold from enterGame
        // playerSplit = goldPerPlayer - reserveSplit, where reserveSplit = goldPerPlayer / 20
        // so walletGained = goldPerPlayer - goldPerPlayer/20 = goldPerPlayer * 19/20
        // and reserveAfter = goldPerPlayer / 20
        // so walletGained * 1 should be roughly reserveAfter * 19
        assertApproxEqAbs(walletGained, reserveAfter * 19, 1, "95/5 split should hold");
    }

    // ===== 3. World receives Gold backing for GasReserve =====
    function test_pveKill_worldReceivesGoldBacking() public {
        _buffBob();

        uint256 worldGoldBefore = goldToken.balanceOf(worldAddress);

        vm.prank(bob);
        world.UD__move(bobCharacterId, 0, 1);

        vm.prank(bob);
        bytes32 encounterId = world.UD__createEncounter(EncounterType.PvE, attackers, defenders);
        _fightToEnd(encounterId);

        uint256 worldGoldAfter = goldToken.balanceOf(worldAddress);
        uint256 reserveBalance = GasReserve.getBalance(bobCharacterId);

        assertGt(worldGoldAfter, worldGoldBefore, "World should receive Gold backing for GasReserve");
        // World Gold increase should equal the GasReserve increase
        assertEq(worldGoldAfter - worldGoldBefore, reserveBalance, "World Gold increase should match GasReserve");
    }
}
