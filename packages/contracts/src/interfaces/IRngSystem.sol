// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {RngRequestType} from "@codegen/common.sol";

interface IRngSystem {
    function getRng(bytes32 userRandomNumber, RngRequestType requestType, bytes memory data) external;
    function estimateFee() external returns (uint256);
    function createSubscription() external returns (uint64);
}
