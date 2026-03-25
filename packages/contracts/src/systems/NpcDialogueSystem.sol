// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {IWorld} from "@world/IWorld.sol";
import {
    NpcDialogue,
    NpcDialogueData,
    Position,
    Characters,
    Admin
} from "@codegen/index.sol";
import {FragmentType, FragmentTriggerType} from "@codegen/common.sol";
import {PauseLib} from "../libraries/PauseLib.sol";
import {NotAtNpcPosition, NpcHasNoDialogue, NotAdmin} from "../Errors.sol";

/**
 * @title NpcDialogueSystem
 * @notice Linear dialogue system for NPCs. Talking to an NPC returns dialogue
 *         lines and can advance fragment chain steps.
 */
contract NpcDialogueSystem is System {

    event NpcInteraction(bytes32 indexed characterId, bytes32 indexed npcId, uint8 fragmentType);

    /**
     * @notice Talk to an NPC. Returns dialogue lines and advances fragment chain if linked.
     */
    function talkToNpc(bytes32 characterId, bytes32 npcId) public {
        PauseLib.requireNotPaused();
        address owner = Characters.getOwner(characterId);
        require(owner == _msgSender(), "Not character owner");

        // Validate same position
        uint16 charX = Position.getX(characterId);
        uint16 charY = Position.getY(characterId);
        uint16 npcX = Position.getX(npcId);
        uint16 npcY = Position.getY(npcId);
        if (charX != npcX || charY != npcY) revert NotAtNpcPosition();

        NpcDialogueData memory dialogue = NpcDialogue.get(npcId);
        if (bytes(dialogue.dialogueLines).length == 0) revert NpcHasNoDialogue();

        // Advance fragment chain if NPC is linked to one
        if (uint8(dialogue.fragmentType) != 0) {
            // Encode npcId as trigger data
            bytes memory triggerData = abi.encode(npcId);
            IWorld(_world()).UD__tryAdvanceChain(
                characterId,
                uint8(dialogue.fragmentType),
                uint8(FragmentTriggerType.NpcInteract),
                triggerData
            );
        }

        emit NpcInteraction(characterId, npcId, uint8(dialogue.fragmentType));
    }

    /**
     * @notice Admin: configure NPC dialogue and fragment chain link.
     */
    function setNpcDialogue(
        bytes32 npcId,
        uint8 fragmentType,
        uint256 fragmentStep,
        uint256 zoneId,
        string memory dialogueLines
    ) public {
        if (!Admin.get(_msgSender())) revert NotAdmin();
        NpcDialogue.set(npcId, FragmentType(fragmentType), fragmentStep, zoneId, dialogueLines);
    }
}
