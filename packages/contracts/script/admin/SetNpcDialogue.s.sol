// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

interface IWorldDialogue {
    function UD__setNpcDialogue(
        bytes32 npcId,
        uint8 fragmentType,
        uint256 fragmentStep,
        uint256 zoneId,
        string memory dialogueLines
    ) external;
}

/**
 * @title SetNpcDialogue
 * @notice Populate NpcDialogue table for Z2 NPCs (Vel Morrow, Edric Thorne).
 *
 *   Usage:
 *     PRIVATE_KEY=0x... FOUNDRY_PROFILE=script forge script \
 *       script/admin/SetNpcDialogue.s.sol \
 *       --sig "run(address,bytes32,bytes32)" <worldAddress> <velEntityId> <edricEntityId> \
 *       --broadcast --rpc-url $RPC_URL
 */
contract SetNpcDialogue is Script {
    function run(address _worldAddress, bytes32 _velEntityId, bytes32 _edricEntityId) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        IWorldDialogue world = IWorldDialogue(_worldAddress);

        console.log("=== Set NPC Dialogue ===");
        console.log("World:", _worldAddress);

        vm.startBroadcast(deployerPrivateKey);

        // Vel Morrow — Covenant deserter, combat trainer
        world.UD__setNpcDialogue(
            _velEntityId,
            0,  // fragmentType = 0 (zone-based iteration for Z2)
            0,  // fragmentStep
            2,  // zoneId = Windy Peaks
            "You made it out of the cave. That means you can fight. But can you fight well?"
            "|I trained with the Covenant's best. Then I killed two of them."
            "|The peaks test everything the cave didn't. Strength isn't enough anymore."
            "|The wind up here covers footsteps. Remember that."
        );
        console.log("  Vel Morrow dialogue set");

        // Edric Thorne — Heretic acolyte, healer, guild founder
        world.UD__setNpcDialogue(
            _edricEntityId,
            0,
            0,
            2,
            "The Covenant says the gods will return. I'm starting to think they won't. But we're still here."
            "|Down in the cave, we survived alone. Up here, alone gets you killed."
            "|What if we organized? Not a church. Not a hierarchy. Just people who choose each other."
            "|I still pray. I just don't know who's listening anymore."
        );
        console.log("  Edric Thorne dialogue set");

        vm.stopBroadcast();
        console.log("=== Done ===");
    }
}
