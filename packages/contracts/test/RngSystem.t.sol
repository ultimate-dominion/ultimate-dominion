// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {SetUp} from "./SetUp.sol";
import {Classes} from "../src/codegen/common.sol";
import {RandomNumbersData} from "../src/codegen/tables/RandomNumbers.sol";
import {IRngSystem} from "../src/interfaces/IRngSystem.sol";

import "forge-std/console2.sol";

contract Test_RngSystem is SetUp {
    function test_estimateFee() public {
        assertEq(IRngSystem(address(world)).estimateFee(), 1000000000);
    }

    function test_fundSubscription() public {
        uint256 mockAdapterBalanceBefore = world.UD__getRandcastAdapter().balance;
        uint256 fundingAmount = 100000000;
        vm.prank(bob);
        IRngSystem(address(world)).fundSubscription{value: fundingAmount}();
        uint256 mockAdapterBalanceAfter = world.UD__getRandcastAdapter().balance;
        assertEq(mockAdapterBalanceAfter, mockAdapterBalanceBefore + fundingAmount);
    }
}
