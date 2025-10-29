// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

/**
 * @title AttackTypeUtils
 * @notice Utilities for attack type effectiveness, bonuses and penalties
 */
library AttackTypeUtils {
    /**
     * @notice Rock-paper-scissors style effectiveness between types
     * @dev Returns multiplier in basis points (1e4 = 1.0x)
     */
    function calculateAttackTypeEffectiveness(uint8 attackerType, uint8 defenderType)
        internal
        pure
        returns (uint256 bp)
    {
        if (attackerType == defenderType) return 10_000; // neutral
        // Simple cyclical advantage: (attackerType + 1) % 3 beats defenderType
        if ((attackerType + 1) % 3 == defenderType) return 12_500; // 1.25x
        return 8_000; // 0.8x
    }

    /**
     * @notice Calculate type-based bonus (basis points)
     */
    function calculateTypeBonuses(uint8 attackerType, uint8 context) internal pure returns (uint256 bp) {
        // Placeholder: minor context bonus if matches type
        return attackerType == context ? 1_0500 : 10_000; // 1.05x or neutral
    }

    /**
     * @notice Calculate type-based penalty (basis points)
     */
    function calculateTypePenalties(uint8 attackerType, uint8 context) internal pure returns (uint256 bp) {
        // Placeholder: minor penalty if mismatched context
        return attackerType != context ? 9_500 : 10_000; // 0.95x or neutral
    }

    /**
     * @notice Scale a base value by basis points
     */
    function calculateTypeScaling(int256 baseValue, uint256 bp) internal pure returns (int256) {
        return (baseValue * int256(bp)) / int256(10_000);
    }
}


