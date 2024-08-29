// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {IEntropyConsumer} from "@pythnetwork/IEntropyConsumer.sol";
import {IEntropy} from "@pythnetwork/IEntropy.sol";
import {EntropyStructs} from "@pythnetwork/EntropyStructs.sol";
import "forge-std/console.sol";

contract MockEntropy is IEntropy {
    uint128 mockFee = 100000;
    uint256 timesCalled;

    function register(
        uint128 feeInWei,
        bytes32 commitment,
        bytes calldata commitmentMetadata,
        uint64 chainLength,
        bytes calldata uri
    ) external {}

    function withdraw(uint128 amount) external {}

    function request(
        address,
        /* provider **/
        bytes32,
        /* userCommitment **/
        bool /* useBlockHash **/
    ) external payable returns (uint64 assignedSequenceNumber) {
        assignedSequenceNumber = uint64(1234567);
    }

    function requestWithCallback(
        address,
        /* provider **/
        bytes32 /* userRandomNumber **/
    ) external payable returns (uint64 assignedSequenceNumber) {
        // require(msg.value == mockFee, 'more fees please');
        assignedSequenceNumber = uint64(1234567);
        bytes32 randomNumber = keccak256(abi.encode(block.number + timesCalled));
        IEntropyConsumer(msg.sender)._entropyCallback(assignedSequenceNumber, address(1), randomNumber);
        timesCalled++;
        return assignedSequenceNumber;
    }

    function reveal(
        address, /* provider **/
        uint64, /* sequenceNumber **/
        bytes32, /* userRevelation **/
        bytes32 /* providerRevelation **/
    ) external pure returns (bytes32 randomNumber) {
        return bytes32(keccak256(abi.encode("random number: reveal")));
    }

    function revealWithCallback(
        address, /* provider **/
        uint64, /* sequenceNumber **/
        bytes32, /* userRandomNumber **/
        bytes32 /* providerRevelation **/
    ) external {}

    function getProviderInfo(address provider) external view returns (EntropyStructs.ProviderInfo memory info) {}

    function getDefaultProvider() external view returns (address provider) {}

    function getRequest(address provider, uint64 sequenceNumber)
        external
        view
        returns (EntropyStructs.Request memory req)
    {}

    function getFee(address /* provider **/ ) external view returns (uint128) {
        return mockFee;
    }

    function getAccruedPythFees() external view returns (uint128 accruedPythFeesInWei) {}

    function setProviderFee(uint128 newFeeInWei) external {}

    function setProviderUri(bytes calldata newUri) external {}

    function constructUserCommitment(bytes32 userRandomness) external pure returns (bytes32 userCommitment) {}

    function combineRandomValues(bytes32 userRandomness, bytes32 providerRandomness, bytes32 blockHash)
        external
        pure
        returns (bytes32 combinedRandomness)
    {}
}
