pragma solidity 0.8.26;
pragma experimental ABIEncoderV2;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockCharacter is ERC721 {
    constructor() ERC721("Character", "CHR") {
        _mint(msg.sender, 1);
    }

}
