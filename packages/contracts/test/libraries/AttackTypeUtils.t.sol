// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Test} from "forge-std/Test.sol";
import {AttackTypeUtils} from "@libraries/AttackTypeUtils.sol";

contract AttackTypeUtilsTest is Test {
    function test_calculateAttackTypeEffectiveness_neutralWhenSame() public {
        uint256 bp = AttackTypeUtils.calculateAttackTypeEffectiveness(1, 1);
        assertEq(bp, 10_000, "neutral");
    }

    function test_calculateAttackTypeEffectiveness_advantageCycle() public {
        // (0 + 1) % 3 == 1 ⇒ advantage
        uint256 bp01 = AttackTypeUtils.calculateAttackTypeEffectiveness(0, 1);
        assertEq(bp01, 12_500, "0 beats 1");

        // (1 + 1) % 3 == 2 ⇒ advantage
        uint256 bp12 = AttackTypeUtils.calculateAttackTypeEffectiveness(1, 2);
        assertEq(bp12, 12_500, "1 beats 2");
    }

    function test_calculateAttackTypeEffectiveness_disadvantage() public {
        // 2 does not beat 1 (since (2+1)%3==0), so vs 1 should be disadvantage
        uint256 bp = AttackTypeUtils.calculateAttackTypeEffectiveness(2, 1);
        assertEq(bp, 8_000, "disadvantage");
    }

    function test_calculateTypeBonuses_matchesContext() public {
        uint256 bpMatch = AttackTypeUtils.calculateTypeBonuses(2, 2);
        assertEq(bpMatch, 1_0500, "1.05x on match");
        uint256 bpNo = AttackTypeUtils.calculateTypeBonuses(0, 2);
        assertEq(bpNo, 10_000, "neutral otherwise");
    }

    function test_calculateTypePenalties_mismatch() public {
        uint256 bpMis = AttackTypeUtils.calculateTypePenalties(0, 2);
        assertEq(bpMis, 9_500, "0.95x mismatch");
        uint256 bpNeutral = AttackTypeUtils.calculateTypePenalties(1, 1);
        assertEq(bpNeutral, 10_000, "neutral on match");
    }

    function test_calculateTypeScaling_appliesBasisPoints() public {
        int256 base = 100;
        int256 scaled = AttackTypeUtils.calculateTypeScaling(base, 12_500); // 1.25x
        assertEq(scaled, 125);
    }
}


