// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "forge-std/Script.sol";
import {IWorld} from "@world/IWorld.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM} from "@latticexyz/world/src/worldResourceTypes.sol";
import {System} from "@latticexyz/world/src/System.sol";
import {CombatEncounter, CombatEncounterData} from "@codegen/index.sol";

/**
 * @title ClearGhostSystem
 * @notice Root system to end ghost CombatEncounter records.
 *         Root systems run via delegatecall so address(this) = world.
 */
contract ClearGhostSystem is System {
    function clearEncounter(bytes32 encounterId) public {
        CombatEncounterData memory data = CombatEncounter.get(encounterId);
        require(data.end == 0, "Already ended");
        data.end = block.timestamp;
        CombatEncounter.set(encounterId, data);
    }
}

/**
 * @notice Ends ghost CombatEncounter records that have end=0 but whose
 *         EncounterEntity was already cleared. Sets end=block.timestamp
 *         so the client's resolveCurrentBattle() returns null.
 *
 * Targets (2026-04-07):
 *   1. 0xc7dfec42... — AgentSmithy, turn 12/15, stuck since Mar 28
 *   2. 0xe7959044... — Frensleven, turn 10/30, stuck since Mar 20
 *
 * Usage:
 *   cd packages/contracts && \
 *   bash -c 'set -a && source .env.mainnet && set +a && \
 *   FOUNDRY_PROFILE=script forge script script/admin/ClearGhostEncounters.s.sol \
 *     --tc ClearGhostEncounters --sig "run(address)" $WORLD_ADDRESS \
 *     --rpc-url $RPC_URL --private-key $PRIVATE_KEY \
 *     --broadcast --skip-simulation'
 */
contract ClearGhostEncounters is Script {
    function run(address worldAddress) external {
        bytes32 enc1 = 0xc7dfec42a36c1bbcad6a934a426b6735d48eb5228f717953406b35b057d7ab08;
        bytes32 enc2 = 0xe79590449a6e10d7d2926e701c6f6b2957ad26e415de3a5199ee2ead43fde5ea;

        console.log("=== Ghost Encounter Cleanup ===");
        console.log("World:", worldAddress);

        vm.startBroadcast();

        // Deploy root system (delegatecall — address(this) = world, so StoreSwitch works)
        ClearGhostSystem sys = new ClearGhostSystem();
        ResourceId systemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "", "ClearGhost");

        IWorld world = IWorld(worldAddress);
        world.registerSystem(systemId, sys, true);
        console.log("Registered ClearGhostSystem");

        // Clear each ghost encounter
        world.call(systemId, abi.encodeCall(ClearGhostSystem.clearEncounter, (enc1)));
        console.log("Encounter 1 (AgentSmithy) cleared");

        world.call(systemId, abi.encodeCall(ClearGhostSystem.clearEncounter, (enc2)));
        console.log("Encounter 2 (Frensleven) cleared");

        vm.stopBroadcast();

        console.log("Both ghost encounters cleared.");
    }
}
