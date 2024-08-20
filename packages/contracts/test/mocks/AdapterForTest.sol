// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAdapter} from "@interfaces/IAdapter.sol";
import {IRngSystem} from "@interfaces/IRngSystem.sol";
import "forge-std/console2.sol";

struct PartialSignature {
    uint256 index;
    uint256 partialSignature;
}

contract AdapterForTest {
    /* solhint-disable */
    uint64 currentSubId = 0;
    uint256 timesCalled;
    mapping(uint64 => mapping(address => bool)) hasPermission;

    struct RequestData {
        address callbackAddress;
        bytes32 requestId;
    }

    mapping(bytes32 => RequestData) public pendingRequests;

    function createSubscription() external returns (uint64) {
        currentSubId += 1;
        return currentSubId;
    }

    function addConsumer(uint64 subId, address consumer) external {
        hasPermission[subId][consumer] = true;
    }

    function fundSubscription(uint64 subId) external payable {}

    function removeConsumer(uint64 subId, address consumer) external {}

    function getLastSubscription(address /* consumer */ ) external view returns (uint64) {
        return currentSubId;
    }

    function getSubscription(uint64 subId)
        external
        pure
        returns (
            address owner,
            address[] memory consumers,
            uint256 balance,
            uint256 inflightCost,
            uint64 reqCount,
            uint64 freeRequestCount,
            uint64 referralSubId,
            uint64 reqCountInCurrentPeriod,
            uint256 lastRequestTimestamp
        )
    {
        return (address(0), new address[](0), subId != 0 ? 1000000000 : 0, 0, 0, 0, 0, 0, 0);
    }

    function getCurrentSubId() external view returns (uint64) {
        return currentSubId;
    }

    function estimatePaymentAmountInETH(
        uint32, /* callbackGasLimit */
        uint32, /* gasExceptCallback */
        uint32, /* fulfillmentFlatFeeEthPPM */
        uint256, /* weiPerUnitGas */
        uint32 /* groupSize */
    ) external pure returns (uint256) {
        return 1000000000;
    }

    function cancelSubscription(uint64 subId, address to) external {}

    function getAdapterConfig()
        external
        pure
        returns (
            uint16 minimumRequestConfirmations,
            uint32 maxGasLimit,
            uint32 gasAfterPaymentCalculation,
            uint32 gasExceptCallback,
            uint256 signatureTaskExclusiveWindow,
            uint256 rewardPerSignature,
            uint256 committerRewardPerSignature
        )
    {
        return (3, 200000, 0, 0, 0, 0, 0);
    }

    function getFlatFeeConfig()
        external
        pure
        returns (
            uint32 fulfillmentFlatFeeLinkPPMTier1,
            uint32 fulfillmentFlatFeeLinkPPMTier2,
            uint32 fulfillmentFlatFeeLinkPPMTier3,
            uint32 fulfillmentFlatFeeLinkPPMTier4,
            uint32 fulfillmentFlatFeeLinkPPMTier5,
            uint24 reqsForTier2,
            uint24 reqsForTier3,
            uint24 reqsForTier4,
            uint24 reqsForTier5,
            uint16 flatFeePromotionGlobalPercentage,
            bool isFlatFeePromotionEnabledPermanently,
            uint256 flatFeePromotionStartTimestamp,
            uint256 flatFeePromotionEndTimestamp
        )
    {
        return (100, 200, 300, 400, 500, 10, 20, 30, 40, 0, false, 0, 0);
    }

    function estimateFeeTier(uint64 /* reqCount */ ) external pure returns (uint32) {
        return 1;
    }

    function requestRandomness(IAdapter.RandomnessRequestParams memory params) public returns (bytes32 requestId) {
        require(hasPermission[params.subId][msg.sender], "you don't have permssion to use this sub");
        requestId = keccak256(abi.encodePacked(block.timestamp, "test"));
        pendingRequests[requestId] = RequestData(msg.sender, requestId);
        fulfillRandomness(requestId);
    }

    function fulfillRandomness(bytes32 requestId) public {
        RequestData memory data = pendingRequests[requestId];
        uint256 randomness = uint256(keccak256(abi.encode(block.number + timesCalled)));
        // (bool success,) = data.callbackAddress.call(
        //     abi.encodeWithSignature("_fulfillRandomness(bytes32,uint256)", data.requestId, randomness)
        // );
        IRngSystem(data.callbackAddress).rawFulfillRandomness(data.requestId, randomness);
        // if (!success) {
        //     revert("Call back failed");
        // }
        timesCalled++;
    }

    function _fulfillRandomness(bytes32 requestId, uint256 randomness) internal {}

    /* solhint-enable */
}
