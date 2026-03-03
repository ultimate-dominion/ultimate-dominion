// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

/// @notice Minimal WETH interface for deposit/withdraw.
interface IWETH {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
}
