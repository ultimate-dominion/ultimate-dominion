// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;
import {System} from "@latticexyz/world/src/System.sol";


contract AuctionHouseSaleSystem is System {
    function newSale(address _collection, uint256 _tokenId, uint256 _price) external {
        
    }
}

// pragma solidity >=0.8.24;

// import {System} from "@latticexyz/world/src/System.sol";
// import {AuctionHouseOrders, AuctionHouseSales} from "../codegen/index.sol";
// import {SystemSwitch} from "@latticexyz/world-modules/src/utils/SystemSwitch.sol";
// import {IERC20System} from "@latticexyz/world-modules/src/interfaces/IERC20System.sol";
// import {UltimateDominionConfig} from "@codegen/index.sol";
// import {IERC1155System} from "@erc1155/IERC1155System.sol";
// import {AccessControlLib} from "@latticexyz/world-modules/src/utils/AccessControlLib.sol";
// import {
//     _erc1155SystemId,
//     _characterSystemId,
//     _requireOwner,
//     _requireAccess,
//     _requireAccess,
//     _lootManagerSystemId
// } from "../utils.sol";
// import {ITEMS_NAMESPACE, WORLD_NAMESPACE} from "../../constants.sol";

// import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
// //import { IERC1155 } from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
// import { ERC1155Holder } from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
// //import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
// import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
// //import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// //import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// /// ERC721 are currently unsupported
// error ERC721NotSupported();
// event Action(address indexed _collection, uint256 indexed _tokenId, address indexed _seller, string _action);
// struct Sale {
//     bytes32 id;
//     address seller;
//     uint256 price;
// }


// /**
//  * @title AuctionHouseSale
//  * @author Pupcakes
//  * @notice A player who wants to sell their NFT can create an AuctionHouseSale. They define a 'Sale' desired price point and their NFT is held in the contract. Any user can use their gold to to release the locked NFT and send the gold to the creator of the sale
//  */

// contract AuctionHouseSaleSystem is ReentrancyGuard, System {
//     //using SafeERC20 for IERC20;
//     // the NFT collection that is approved for use of this contract
//     mapping(address => bool) public collections;
//     // collection => id => seller => sale
//     mapping(address => mapping(uint256 => mapping(address => Sale))) public sales;

//     bytes4 constant interface721 = 0x80ac58cd;
//     bytes4 constant interface1155 = 0xd9b67a26;
//     constructor() {
// 		collections[UltimateDominionConfig.getItems()] = true;
// 	}
//     function _goldToken() internal view returns (IERC20System goldToken) {
//         goldToken = IERC20System(UltimateDominionConfig.getGoldToken());
//     }
//     function newSale(address _collection, uint256 _tokenId, uint256 _price) external nonReentrant returns (bytes32){
//         require(collections[_collection] == true, "This collection is not allowed.");
//         require(_price > 0, "You cannot create an sale at no price");
//         Sale memory sale = sales[_collection][_tokenId][msg.sender];
//         bytes32 id = bytes32(abi.encodePacked(_collection, _tokenId, msg.sender));
//         require(sale.id == 0, "You already have a sale for this item. Please cancel the existing sale before making a new one.");
// 		if(IERC165(_collection).supportsInterface(interface721))
//         {
//             revert ERC721NotSupported();
//             //require(IERC721(_collection).ownerOf(_tokenId) == msg.sender || IERC721(_collection).getApproved(_tokenId) == msg.sender, "You do not have access to the item.");
//         }
// 		else if(IERC165(_collection).supportsInterface(interface1155))
//         {
//             require(IERC1155System(UltimateDominionConfig.getItems()).balanceOf(msg.sender, _tokenId) >= 1, "You do not have enough of the item.");
//         }

// 		// EFFECTS
//         sales[_collection][_tokenId][msg.sender].id = id;
//         sales[_collection][_tokenId][msg.sender].seller = msg.sender;
// 		sales[_collection][_tokenId][msg.sender].price = _price;

//         // INTERACTIONS
//         // transfer NFT to contract
//         if(IERC165(_collection).supportsInterface(interface721)) {
//             //IERC721(_collection).safeTransferFrom(msg.sender, address(this), _tokenId);
//             revert ERC721NotSupported();
//         }
//         else if(IERC165(_collection).supportsInterface(interface1155)){
//             IERC1155System(UltimateDominionConfig.getItems()).transferFrom(msg.sender, address(this), _tokenId, 1);

//         }
//         emit Action(_collection, _tokenId, msg.sender, 'sale created');
//         return id;
        
//     }
// 	function cancelSale(address _collection, uint256 _tokenId) external nonReentrant {
// 		// CHECKS
//         Sale memory sale = sales[_collection][_tokenId][msg.sender];
// 		require(sale.id != 0, "You do not have an existing sale for this item.");
// 		if(IERC165(_collection).supportsInterface(interface721))
//         {
//             //require(IERC721(_collection).ownerOf(_tokenId) == msg.sender || IERC721(_collection).getApproved(_tokenId) == msg.sender, "You do not have access to the item.");
//             revert ERC721NotSupported();
//         }
// 		else if(IERC165(_collection).supportsInterface(interface1155))
//         {
//             require(IERC1155System(UltimateDominionConfig.getItems()).balanceOf(msg.sender, _tokenId) >= 1, "You do not have enough of the item.");
//         }

// 		// EFFECTS
// 		delete sales[_collection][_tokenId][msg.sender];

// 		// INTERACTIONS
//         // transfer NFT to user
//         if(IERC165(_collection).supportsInterface(interface721)) {
//             //IERC721(_collection).safeTransferFrom(address(this), msg.sender, _tokenId);
//             revert ERC721NotSupported();
//         }
//         else if(IERC165(_collection).supportsInterface(interface1155)){
//             IERC1155System(UltimateDominionConfig.getItems()).transferFrom(address(this), msg.sender, _tokenId, 1);

//         }
//         emit Action(_collection, _tokenId, msg.sender, 'sale canceled');

// 	}
//     function buySale(address _collection, uint256 _tokenId, address _seller, uint256 _expectedPrice) external  nonReentrant returns (bytes32) {
// 		// CHECKS
// 		Sale memory sale = sales[_collection][_tokenId][_seller];
//         require(sale.id == 0, "This sale does not exist.");
// 		require(sale.price != _expectedPrice, "user offer does not match"); 

        
//         bytes32 id = bytes32(abi.encodePacked(_collection, _tokenId, _seller));
// 		// EFFECTS
//         delete sales[_collection][_tokenId][msg.sender];

// 		// INTERACTIONS
// 		// transfer NFT to user
//         if(IERC165(_collection).supportsInterface(interface721)) {
//             //IERC721(_collection).safeTransferFrom(msg.sender, sale.seller, _tokenId);
//             revert ERC721NotSupported();
//         }
//         else if(IERC165(_collection).supportsInterface(interface1155)){
//             IERC1155System(UltimateDominionConfig.getItems()).transferFrom(msg.sender, sale.seller, _tokenId, 1);

//         }
//         _goldToken().transfer(sale.seller, sale.price);

//         emit Action(_collection, _tokenId, _seller, 'sale fulfilled');
//         return id;

// 	}
// 	// function viewSale(address _collection, uint256 _tokenId, address _seller) external view returns (Sale memory) {
// 	// 	return sales[_collection][_tokenId][_seller];
// 	// }

// }