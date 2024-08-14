// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {RngRequestType, RandcastRequestType} from "@codegen/common.sol";

interface IRngSystem {
    function getRng(bytes32 userRandomNumber, RngRequestType requestType, bytes memory data) external;
    function getFee() external returns (uint256);
}
