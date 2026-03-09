// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {
    FragmentProgress,
    CharacterFirstActions,
    Characters
} from "@codegen/index.sol";
import {FragmentType} from "@codegen/common.sol";
import {CRYSTAL_ELEMENTAL_MOB_ID, SHADOW_STALKER_MOB_ID, LICH_ACOLYTE_MOB_ID} from "../../constants.sol";
import {_requireSystemOrAdmin} from "../utils.sol";

/**
 * @title FragmentCombatSystem
 * @notice Handles combat-related fragment trigger checks
 * @dev Split from FragmentSystem to reduce contract size
 */
contract FragmentCombatSystem is System {
    event FragmentTriggered(bytes32 indexed characterId, uint8 fragmentType, uint16 tileX, uint16 tileY);

    function checkCombatFragmentTriggersForGroup(
        bytes32[] memory winners,
        bytes32[] memory defeated,
        uint16 tileX,
        uint16 tileY,
        bool defeatedAreMobs
    ) public {
        _requireSystemOrAdmin(_msgSender());
        for (uint256 i = 0; i < winners.length; i++) {
            if (_isCharacter(winners[i])) {
                checkCombatFragmentTriggers(winners[i], defeated, tileX, tileY, defeatedAreMobs);
            }
        }
    }

    function checkCombatFragmentTriggers(
        bytes32 characterId,
        bytes32[] memory defeated,
        uint16 tileX,
        uint16 tileY,
        bool defeatedAreMobs
    ) public {
        _requireSystemOrAdmin(_msgSender());
        // Fragment III: The Restless - first monster kill
        if (defeatedAreMobs && !CharacterFirstActions.getHasKilledMonster(characterId)) {
            CharacterFirstActions.setHasKilledMonster(characterId, true);
            _triggerFragment(characterId, 3, tileX, tileY);
        }

        for (uint256 i = 0; i < defeated.length; i++) {
            bytes32 defeatedId = defeated[i];

            if (defeatedAreMobs) {
                // Inline getMobId: upper 32 bits of entityId encode the mob template ID
                uint256 mobId = uint256(uint256(defeatedId) >> 224);

                // Fragment IV: Souls That Linger - kill Crystal Elemental
                if (mobId == CRYSTAL_ELEMENTAL_MOB_ID) {
                    _triggerFragment(characterId, 4, tileX, tileY);
                }
                // Fragment VI: Death of the Death God - kill Lich Acolyte
                else if (mobId == LICH_ACOLYTE_MOB_ID) {
                    _triggerFragment(characterId, 6, tileX, tileY);
                }
                // Fragment VII: Betrayer's Truth - kill Shadow Stalker
                else if (mobId == SHADOW_STALKER_MOB_ID) {
                    _triggerFragment(characterId, 7, tileX, tileY);
                }
            } else {
                // PvP kill
                if (_isCharacter(defeatedId)) {
                    if (!CharacterFirstActions.getHasKilledPlayer(characterId)) {
                        CharacterFirstActions.setHasKilledPlayer(characterId, true);
                        _triggerFragment(characterId, 8, tileX, tileY);
                    }
                }
            }
        }
    }

    function _isCharacter(bytes32 entityId) private view returns (bool) {
        return Characters.getOwner(entityId) != address(0);
    }

    function _triggerFragment(bytes32 characterId, uint8 fragmentType, uint16 tileX, uint16 tileY) private {
        FragmentType fType = FragmentType(fragmentType);

        // Check if already triggered
        if (FragmentProgress.getTriggered(characterId, fType)) {
            return; // Already triggered, no-op
        }

        FragmentProgress.set(characterId, fType, true, block.timestamp, tileX, tileY, false, 0, 0);

        emit FragmentTriggered(characterId, fragmentType, tileX, tileY);
    }
}
