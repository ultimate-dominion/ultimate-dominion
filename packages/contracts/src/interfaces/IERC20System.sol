// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

/**
 * @title IERC20System
 * @dev Interface for ERC20 System with mint and burn functions
 */
interface IERC20System {
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function burn(address account, uint256 value) external;
    function decimals() external view returns (uint8);
    function mint(address account, uint256 value) external;
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function totalSupply() external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}
