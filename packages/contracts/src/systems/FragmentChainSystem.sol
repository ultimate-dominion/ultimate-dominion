// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {IWorld} from "@world/IWorld.sol";
import {
    FragmentChainProgress,
    FragmentChainStep,
    FragmentChainStepData,
    FragmentChainStepReward,
    FragmentProgress,
    Admin
} from "@codegen/index.sol";
import {FragmentType, FragmentTriggerType} from "@codegen/common.sol";
import {_requireSystemOrAdmin} from "../utils.sol";
import {
    ChainNotInitialized,
    ChainAlreadyCompleted,
    WrongTriggerType,
    InvalidChainStep,
    NotAdmin
} from "../Errors.sol";

/**
 * @title FragmentChainSystem
 * @notice Multi-step fragment chains for Zone 2+. Each chain has N steps,
 *         each step has a trigger type (tile, combat, npc) and trigger data.
 *         When all steps complete, the standard FragmentProgress flow is triggered.
 */
contract FragmentChainSystem is System {

    event ChainStepCompleted(bytes32 indexed characterId, uint8 fragmentType, uint256 step, uint256 totalSteps);
    event ChainCompleted(bytes32 indexed characterId, uint8 fragmentType);

    /**
     * @notice Try to advance a chain step. Called by MapSystem, FragmentCombatSystem,
     *         or NpcDialogueSystem when a potential trigger occurs.
     * @param characterId The character
     * @param fragmentType The fragment chain type (9-16 for Z2)
     * @param triggerType 0=tile, 1=combat, 2=npc
     * @param triggerData Encoded data: (uint16 x, uint16 y) for tile, (uint256 mobId) for combat, (bytes32 npcId) for npc
     */
    function tryAdvanceChain(
        bytes32 characterId,
        uint8 fragmentType,
        uint8 triggerType,
        bytes memory triggerData
    ) public {
        _requireSystemOrAdmin(_msgSender());

        uint256 totalSteps = FragmentChainProgress.getTotalSteps(characterId, FragmentType(fragmentType));
        if (totalSteps == 0) return; // Chain not initialized, no-op

        bool completed = FragmentChainProgress.getCompleted(characterId, FragmentType(fragmentType));
        if (completed) return; // Already done, no-op

        // Fragment XVI prerequisite: 4+ of fragments IX-XV must be claimed
        if (fragmentType == 16) {
            uint256 z2Claimed;
            for (uint8 i = 9; i <= 15; i++) {
                if (FragmentProgress.getClaimed(characterId, FragmentType(i))) {
                    unchecked { z2Claimed++; }
                }
            }
            if (z2Claimed < 4) return; // Not enough fragments, no-op
        }

        uint256 currentStep = FragmentChainProgress.getCurrentStep(characterId, FragmentType(fragmentType));

        // Read current step config
        FragmentChainStepData memory stepConfig = FragmentChainStep.get(FragmentType(fragmentType), currentStep);

        // Verify trigger type matches
        if (uint8(stepConfig.triggerType) != triggerType) return; // Wrong trigger type, no-op

        // Verify trigger data matches
        if (!_matchesTriggerData(triggerType, stepConfig.triggerData, triggerData)) return;

        // Advance step
        uint256 newStep = currentStep + 1;
        FragmentChainProgress.setCurrentStep(characterId, FragmentType(fragmentType), newStep);

        // Drop quest item reward if configured for this step
        uint256 rewardItemId = FragmentChainStepReward.getRewardItemId(FragmentType(fragmentType), currentStep);
        if (rewardItemId != 0) {
            IWorld(_world()).UD__dropItem(characterId, rewardItemId, 1);
        }

        emit ChainStepCompleted(characterId, fragmentType, newStep, totalSteps);

        // Check if chain is complete
        if (newStep >= totalSteps) {
            FragmentChainProgress.setCompleted(characterId, FragmentType(fragmentType), true);

            // Trigger the standard fragment claim flow
            // Use 0,0 as tile coords — chain fragments don't have a single trigger tile
            IWorld(_world()).UD__triggerFragment(characterId, fragmentType, 0, 0);

            emit ChainCompleted(characterId, fragmentType);
        }
    }

    /**
     * @notice Admin: initialize a chain with total steps.
     */
    function initializeChain(uint8 fragmentType, uint256 totalSteps) public {
        if (!Admin.get(_msgSender())) revert NotAdmin();
        // Set totalSteps at the "template" level — actual progress is per-character.
        // We store totalSteps on a sentinel character key for lookup.
        // Actually, we set it via the step config — totalSteps = max stepIndex + 1.
        // This is stored per-character on first access. Admin scripts initialize per-character.
        // For simplicity: chain totalSteps is part of the deploy script that initializes
        // FragmentChainProgress for each character as they encounter it.
        // Instead, we use the step count from config.
    }

    /**
     * @notice Admin: configure a chain step.
     */
    function setChainStep(
        uint8 fragmentType,
        uint256 stepIndex,
        uint8 triggerType,
        bytes memory triggerData,
        string memory narrative
    ) public {
        if (!Admin.get(_msgSender())) revert NotAdmin();
        FragmentChainStep.set(
            FragmentType(fragmentType),
            stepIndex,
            FragmentTriggerType(triggerType),
            triggerData,
            narrative
        );
    }

    /**
     * @notice Initialize chain progress for a character (called on zone entry).
     */
    function initializeCharacterChain(bytes32 characterId, uint8 fragmentType, uint256 totalSteps) public {
        _requireSystemOrAdmin(_msgSender());
        uint256 existing = FragmentChainProgress.getTotalSteps(characterId, FragmentType(fragmentType));
        if (existing > 0) return; // Already initialized
        FragmentChainProgress.set(characterId, FragmentType(fragmentType), 0, totalSteps, false);
    }

    // ========== Internal ==========

    function _matchesTriggerData(
        uint8 triggerType,
        bytes memory expected,
        bytes memory actual
    ) internal pure returns (bool) {
        if (triggerType == uint8(FragmentTriggerType.TileVisit)) {
            // Both encode (uint16 x, uint16 y)
            (uint16 expX, uint16 expY) = abi.decode(expected, (uint16, uint16));
            (uint16 actX, uint16 actY) = abi.decode(actual, (uint16, uint16));
            return expX == actX && expY == actY;
        } else if (triggerType == uint8(FragmentTriggerType.CombatKill)) {
            // Both encode (uint256 mobId)
            uint256 expMob = abi.decode(expected, (uint256));
            uint256 actMob = abi.decode(actual, (uint256));
            return expMob == actMob;
        } else if (triggerType == uint8(FragmentTriggerType.NpcInteract)) {
            // Both encode (bytes32 npcId)
            bytes32 expNpc = abi.decode(expected, (bytes32));
            bytes32 actNpc = abi.decode(actual, (bytes32));
            return expNpc == actNpc;
        }
        return false;
    }
}
