// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";

import {IWorld} from "@world/IWorld.sol";
import {FragmentChainStep, NpcDialogue, Position} from "@codegen/index.sol";
import {FragmentType, FragmentTriggerType} from "@codegen/common.sol";

/**
 * @title DeployFragmentChains
 * @notice Configures the 8 Z2 (Windy Peaks) fragment chains with step data and NPC placement.
 *
 * Chains IX-XVI:
 *   IX  (FirstLight)          - 1 step:  tile
 *   X   (TheBladesEdge)       - 3 steps: tile -> npc -> tile
 *   XI  (DividedGround)       - 3 steps: tile -> tile -> tile
 *   XII (TheDirectors)        - 2 steps: tile -> tile
 *   XIII(TheStormsMemory)     - 3 steps: tile -> combat -> tile
 *   XIV (WhatGrows)           - 3 steps: tile -> tile -> tile
 *   XV  (TheBakersStand)      - 3 steps: npc -> combat -> tile
 *   XVI (TheLightsBelow)      - 3 steps: tile -> tile -> npc
 *
 * Tile coordinates use Z2 grid: x 0-9, y 100-109 (zone origin 0,100).
 *
 * Prerequisites:
 * - World must be deployed with FragmentChainStep, NpcDialogue, Position tables
 * - FragmentType enum must include Z2 entries (FirstLight through TheLightsBelow)
 *
 * Usage:
 *   forge script DeployFragmentChains --broadcast --sig "run(address)" <WORLD_ADDRESS>
 */
contract DeployFragmentChains is Script {
    IWorld public world;

    // Z2 zone ID (Windy Peaks)
    uint256 constant ZONE_ID = 2;

    // Placeholder mob ID for combat triggers (update after Z2 mob loading)
    uint256 constant PLACEHOLDER_MOB_ID = 100;

    function run(address _worldAddress) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        world = IWorld(_worldAddress);
        StoreSwitch.setStoreAddress(_worldAddress);

        console.log("=== DeployFragmentChains (Z2) ===");

        _deployChainIX();
        _deployChainX();
        _deployChainXI();
        _deployChainXII();
        _deployChainXIII();
        _deployChainXIV();
        _deployChainXV();
        _deployChainXVI();

        vm.stopBroadcast();

        console.log("=== DeployFragmentChains Complete ===");
    }

    // ========== Helper functions ==========

    function _npcId(string memory name) internal pure returns (bytes32) {
        return keccak256(abi.encode(name));
    }

    function _tileTrigger(uint16 x, uint16 y) internal pure returns (bytes memory) {
        return abi.encode(x, y);
    }

    function _combatTrigger(uint256 mobId) internal pure returns (bytes memory) {
        return abi.encode(mobId);
    }

    function _npcTrigger(bytes32 npcId) internal pure returns (bytes memory) {
        return abi.encode(npcId);
    }

    // ========== Chain IX: First Light (1 step) ==========

    function _deployChainIX() internal {
        console.log("Deploying Chain IX: First Light...");

        FragmentChainStep.set(
            FragmentType.FirstLight,
            0,
            FragmentTriggerType.TileVisit,
            _tileTrigger(1, 101),
            "A pale light seeps through the ridgeline. You feel the wind for the first time since the cave."
        );

        console.log("  Chain IX deployed (1 step)");
    }

    // ========== Chain X: The Blade's Edge (3 steps: tile -> npc -> tile) ==========

    function _deployChainX() internal {
        console.log("Deploying Chain X: The Blade's Edge...");

        bytes32 bladesmithId = _npcId("Kael the Bladesmith");

        // Step 0: tile
        FragmentChainStep.set(
            FragmentType.TheBladesEdge,
            0,
            FragmentTriggerType.TileVisit,
            _tileTrigger(3, 102),
            "A broken blade juts from the rock face, still humming with old purpose."
        );

        // Step 1: npc
        FragmentChainStep.set(
            FragmentType.TheBladesEdge,
            1,
            FragmentTriggerType.NpcInteract,
            _npcTrigger(bladesmithId),
            "The bladesmith turns the shard in his hands. 'This edge was folded by someone who understood endings.'"
        );

        // Step 2: tile
        FragmentChainStep.set(
            FragmentType.TheBladesEdge,
            2,
            FragmentTriggerType.TileVisit,
            _tileTrigger(5, 104),
            "At the cliff's edge, the wind carries the ring of steel. The blade remembers."
        );

        // Place NPC
        Position.set(bladesmithId, 4, 103);
        NpcDialogue.set(
            bladesmithId,
            FragmentType.TheBladesEdge,
            1,
            ZONE_ID,
            unicode"Every edge tells a story. This one speaks of a war that never ended \u2014 it just moved underground."
        );

        console.log("  Chain X deployed (3 steps, 1 NPC)");
    }

    // ========== Chain XI: Divided Ground (3 steps: tile -> tile -> tile) ==========

    function _deployChainXI() internal {
        console.log("Deploying Chain XI: Divided Ground...");

        FragmentChainStep.set(
            FragmentType.DividedGround,
            0,
            FragmentTriggerType.TileVisit,
            _tileTrigger(6, 101),
            unicode"The earth is split here \u2014 not by quake, but by something deliberate. The halves don't match."
        );

        FragmentChainStep.set(
            FragmentType.DividedGround,
            1,
            FragmentTriggerType.TileVisit,
            _tileTrigger(7, 103),
            "Carved markers line both sides of the divide. Names you can't read, in a script that predates the kingdom."
        );

        FragmentChainStep.set(
            FragmentType.DividedGround,
            2,
            FragmentTriggerType.TileVisit,
            _tileTrigger(8, 105),
            "At the narrowest point, someone built a bridge. It was never finished."
        );

        console.log("  Chain XI deployed (3 steps)");
    }

    // ========== Chain XII: The Director's Instruments (2 steps: tile -> tile) ==========

    function _deployChainXII() internal {
        console.log("Deploying Chain XII: The Director's Instruments...");

        FragmentChainStep.set(
            FragmentType.TheDirectors,
            0,
            FragmentTriggerType.TileVisit,
            _tileTrigger(2, 106),
            "Brass instruments hang from the dead trees, swaying in the wind. They play a melody no one composed."
        );

        FragmentChainStep.set(
            FragmentType.TheDirectors,
            1,
            FragmentTriggerType.TileVisit,
            _tileTrigger(3, 107),
            "A conductor's podium stands at the clearing's center. The baton is missing, but the music continues."
        );

        console.log("  Chain XII deployed (2 steps)");
    }

    // ========== Chain XIII: The Storm's Memory (3 steps: tile -> combat -> tile) ==========

    function _deployChainXIII() internal {
        console.log("Deploying Chain XIII: The Storm's Memory...");

        FragmentChainStep.set(
            FragmentType.TheStormsMemory,
            0,
            FragmentTriggerType.TileVisit,
            _tileTrigger(4, 106),
            "Lightning scars pattern the stone in perfect spirals. This storm remembered where it struck."
        );

        FragmentChainStep.set(
            FragmentType.TheStormsMemory,
            1,
            FragmentTriggerType.CombatKill,
            _combatTrigger(PLACEHOLDER_MOB_ID),
            unicode"The storm's echo takes form \u2014 crackling, angry, defending what it was made to forget."
        );

        FragmentChainStep.set(
            FragmentType.TheStormsMemory,
            2,
            FragmentTriggerType.TileVisit,
            _tileTrigger(5, 108),
            "Where the echo fell, the spirals realign. The storm's memory is complete."
        );

        console.log("  Chain XIII deployed (3 steps)");
    }

    // ========== Chain XIV: What Grows in the Dark (3 steps: tile -> tile -> tile) ==========

    function _deployChainXIV() internal {
        console.log("Deploying Chain XIV: What Grows in the Dark...");

        FragmentChainStep.set(
            FragmentType.WhatGrows,
            0,
            FragmentTriggerType.TileVisit,
            _tileTrigger(8, 101),
            unicode"Luminous fungi carpet the overhang. They pulse in rhythm \u2014 not with your heartbeat, but with something deeper."
        );

        FragmentChainStep.set(
            FragmentType.WhatGrows,
            1,
            FragmentTriggerType.TileVisit,
            _tileTrigger(9, 103),
            "The fungi form a trail. Where it leads, the rock is warm to the touch."
        );

        FragmentChainStep.set(
            FragmentType.WhatGrows,
            2,
            FragmentTriggerType.TileVisit,
            _tileTrigger(9, 105),
            "A garden in full bloom, fed by no sun. Whatever grows here chose to."
        );

        console.log("  Chain XIV deployed (3 steps)");
    }

    // ========== Chain XV: The Baker's Stand (3 steps: npc -> combat -> tile) ==========

    function _deployChainXV() internal {
        console.log("Deploying Chain XV: The Baker's Stand...");

        bytes32 bakerId = _npcId("Maren the Baker");

        // Step 0: npc
        FragmentChainStep.set(
            FragmentType.TheBakersStand,
            0,
            FragmentTriggerType.NpcInteract,
            _npcTrigger(bakerId),
            "The baker offers you bread. 'Even at the end of things, someone has to feed the living.'"
        );

        // Step 1: combat
        FragmentChainStep.set(
            FragmentType.TheBakersStand,
            1,
            FragmentTriggerType.CombatKill,
            _combatTrigger(PLACEHOLDER_MOB_ID + 1),
            unicode"Scavengers descend on the stand. The baker doesn't run \u2014 she reaches for a rolling pin."
        );

        // Step 2: tile
        FragmentChainStep.set(
            FragmentType.TheBakersStand,
            2,
            FragmentTriggerType.TileVisit,
            _tileTrigger(7, 108),
            "The stand still smells of fresh bread. A sign reads: 'Open tomorrow.' It always does."
        );

        // Place NPC
        Position.set(bakerId, 6, 107);
        NpcDialogue.set(
            bakerId,
            FragmentType.TheBakersStand,
            0,
            ZONE_ID,
            "They burned my first stand. And my second. The bread kept rising. Some things are harder to kill than people."
        );

        console.log("  Chain XV deployed (3 steps, 1 NPC)");
    }

    // ========== Chain XVI: The Lights Below (3 steps: tile -> tile -> npc) ==========

    function _deployChainXVI() internal {
        console.log("Deploying Chain XVI: The Lights Below...");

        bytes32 watcherId = _npcId("The Watcher Below");

        // Step 0: tile
        FragmentChainStep.set(
            FragmentType.TheLightsBelow,
            0,
            FragmentTriggerType.TileVisit,
            _tileTrigger(1, 107),
            unicode"Through a crack in the stone, lights drift upward \u2014 soft, patient, impossibly deep."
        );

        // Step 1: tile
        FragmentChainStep.set(
            FragmentType.TheLightsBelow,
            1,
            FragmentTriggerType.TileVisit,
            _tileTrigger(2, 108),
            "The lights respond to your presence. They gather, forming shapes that almost resolve into faces."
        );

        // Step 2: npc
        FragmentChainStep.set(
            FragmentType.TheLightsBelow,
            2,
            FragmentTriggerType.NpcInteract,
            _npcTrigger(watcherId),
            "A figure waits at the deepest point. 'You followed the lights. Most don't. Most can't.'"
        );

        // Place NPC
        Position.set(watcherId, 3, 109);
        NpcDialogue.set(
            watcherId,
            FragmentType.TheLightsBelow,
            2,
            ZONE_ID,
            "The lights are memories. Not mine. Not yours. They belong to the mountain. I only keep them company."
        );

        console.log("  Chain XVI deployed (3 steps, 1 NPC)");
    }
}
