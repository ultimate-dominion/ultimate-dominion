pragma solidity 0.8.26;
pragma experimental ABIEncoderV2;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockGold is ERC20{
    constructor() ERC20("Gold", "GLD") {
        _mint(msg.sender, 10**18);
    }
}