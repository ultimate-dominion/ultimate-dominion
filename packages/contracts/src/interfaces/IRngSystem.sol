// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {RngRequestType} from "@codegen/common.sol";

abstract contract IRngSystem {
    function getRng(bytes32 userRandomNumber, RngRequestType requestType, bytes memory data)
        external
        payable
        virtual
        returns (bytes32 _requestId);
    function estimateFee() external virtual returns (uint256);
    function createSubscription() external virtual returns (uint64);
    function fundSubscription() external payable virtual;
    function getRandcastAdapter() internal virtual returns (address);

    function rawFulfillRandomness(bytes32 requestId, uint256 randomness) external {
        address randcastAdapter = getRandcastAdapter();
        require(randcastAdapter != address(0), "Randcast Adapter address not set");
        require(msg.sender == randcastAdapter, "Only Randcast Adapter can call this function");

        fulfillRandomness(requestId, randomness);
    }

    function fulfillRandomness(bytes32 requestId, uint256 randomness) internal virtual;
}
