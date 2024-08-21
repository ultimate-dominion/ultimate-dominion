// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IGasEstimator {
    function requiredTxGas(address to, uint256 value, bytes calldata data) external returns (uint256);
}
