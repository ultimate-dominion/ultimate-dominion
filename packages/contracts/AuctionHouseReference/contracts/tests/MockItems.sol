pragma solidity 0.8.26;
pragma experimental ABIEncoderV2;

/*import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract MockItems is ERC1155 {
    constructor() ERC1155("https://game.example/api/item/{id}.json") {
        _mint(msg.sender, 0, 1, new bytes(0));
    }
}
*/

import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract MockItems is ERC1155 {
    constructor() ERC1155("") {
        //_mint(msg.sender, 1);
    }

}
