// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {SetUp} from "./SetUp.sol";
import {Classes} from "../src/codegen/common.sol";
import {RandomNumbersData} from "../src/codegen/tables/RandomNumbers.sol";
import {IRngSystem} from "../src/interfaces/IRngSystem.sol";

import "forge-std/console2.sol";

contract Test_RngSystem is SetUp {
    function test_estimateFee() public {
        assertEq(IRngSystem(address(world)).estimateFee(), 100000);
    }
}
