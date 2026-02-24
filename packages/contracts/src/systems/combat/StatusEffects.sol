// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {EffectProcessor} from "@libraries/EffectProcessor.sol";

/**
 * @title StatusEffects
 * @notice Minimal status effect helpers leveraging EffectProcessor
 */
contract StatusEffects is System {
    /**
     * @notice Compute the applied effect id that would be created
     */
    function previewAppliedEffectId(bytes32 effectId, uint256 currentTurn)
        public
        view
        returns (bytes32 appliedEffectId)
    {
        appliedEffectId = EffectProcessor.createAppliedEffectId(effectId, block.timestamp, currentTurn);
    }

    /**
     * @notice Mark an applied effect as expired (preview only)
     */
    function previewExpire(bytes32 appliedEffectId) public view returns (bytes32 expiredId) {
        expiredId = EffectProcessor.markEffectAsExpired(appliedEffectId, block.timestamp);
    }

    /**
     * @notice Check whether an applied effect id is not expired
     */
    function isNotExpired(bytes32 appliedEffectId) public pure returns (bool) {
        return EffectProcessor.isNotExpired(appliedEffectId);
    }
}


