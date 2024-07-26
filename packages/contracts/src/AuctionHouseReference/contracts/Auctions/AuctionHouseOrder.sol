// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
pragma experimental ABIEncoderV2;

import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { IERC1155 } from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import { ERC1155Holder } from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


struct Order {
    bytes32 id;
    address buyer;
    uint256 price;
}

/**
 * @title AuctionHouseOrder
 * @author Pupcakes
 * @notice A player who wants a particular NFT can create an AuctionHouseOrder. They define an 'Order' for a particular NFT, along with the money they want to offer. Any user with this NFT can fill the order to release the locked money and send the NFT to the creator of the order
 */
contract AuctionHouseOrder is ReentrancyGuard {
    using SafeERC20 for IERC20;
    // the NFT collection that is approved for use of this contract
    mapping(address => bool) public collections;
    // collection => id => buyer => order
    mapping(address => mapping(uint256 => mapping(address => Order))) public orders;

    // the owner 
    address public owner;
    address public gold;
    bytes4 constant interface721 = 0x80ac58cd;
    bytes4 constant interface1155 = 0xd9b67a26;


	modifier onlyOwner() {
		require(msg.sender == owner, 'not Owner');
		_;
	}
    constructor(address _gold) {
		owner = msg.sender;
        gold = _gold;
	}
	event Action(address indexed _collection, uint256 indexed _tokenId, address indexed _buyer, string _action);

    function setOwner(address _owner) external onlyOwner{
        owner = _owner;
    }
    // Change which collections can be traded here. 
    function setCollections(address[] memory _collections, bool[] memory _status) external onlyOwner {
        require(_collections.length == _status.length, "Mismatch array length");
        uint256 collectionsLength = _collections.length;
        for (uint256 i = 0; i < collectionsLength;) {
            collections[_collections[i]] = _status[i];
            unchecked {
                ++i;
            }
        }
    }
    // 
    function placeOrder(address _collection, uint256 _tokenId, uint256 _price) external nonReentrant returns (bytes32){
        require(collections[_collection] == true, "This collection is not allowed.");
        require(_price > 0, "You cannot create an order at no cost");
        Order memory order = orders[_collection][_tokenId][msg.sender];
        bytes32 id = bytes32(abi.encodePacked(_collection, _tokenId, msg.sender));
        require(order.id == 0, "You already have an order for this item. Please cancel the existing order before making a new one.");

		// EFFECTS
        orders[_collection][_tokenId][msg.sender].id = id;
        orders[_collection][_tokenId][msg.sender].buyer = msg.sender;
		orders[_collection][_tokenId][msg.sender].price = _price;

        // INTERACTIONS
        IERC20(gold).safeTransferFrom(msg.sender, address(this), _price);
        return id;
        
    }
	function cancelOrder(address _collection, uint256 _tokenId) external nonReentrant {
		// CHECKS
        Order memory order = orders[_collection][_tokenId][msg.sender];
		require(order.id != 0, "You do not have an existing order for this item.");

		// EFFECTS
		delete orders[_collection][_tokenId][msg.sender];

		// INTERACTIONS
        IERC20(gold).safeTransfer(msg.sender, order.price);
        emit Action(_collection, _tokenId, msg.sender, 'order canceled');

	}
    function fulfillOrder(address _collection, uint256 _tokenId, address _buyer, uint256 _expectedPrice) external  nonReentrant returns (bytes32) {
		// CHECKS
		Order memory order = orders[_collection][_tokenId][_buyer];
        require(order.id == 0, "This order does not exist.");
		require(order.price != _expectedPrice, "user offer insufficient"); 
		if(IERC165(_collection).supportsInterface(interface721))
        {
            require(IERC721(_collection).ownerOf(_tokenId) == msg.sender || IERC721(_collection).getApproved(_tokenId) == msg.sender, "You do not have access to the item.");
        }
		else if(IERC165(_collection).supportsInterface(interface1155))
        {
            require(IERC1155(_collection).balanceOf(msg.sender, _tokenId) >= 1, "You do not have enough of the item.");
        }
        
        bytes32 id = bytes32(abi.encodePacked(_collection, _tokenId, _buyer));
		// EFFECTS
        delete orders[_collection][_tokenId][msg.sender];

		// INTERACTIONS
		// transfer NFT to user
        if(IERC165(_collection).supportsInterface(interface721)) {
            IERC721(_collection).safeTransferFrom(msg.sender, order.buyer, _tokenId);
        }
        else if(IERC165(_collection).supportsInterface(interface1155)){
            IERC1155(_collection).safeTransferFrom(msg.sender, order.buyer, _tokenId, 1, new bytes(0));

        }
        IERC20(gold).safeTransfer(address(this), order.price);

        emit Action(_collection, _tokenId, _buyer, 'order fulfilled');
        return id;

	}
	function viewOrder(address _collection, uint256 _tokenId, address _buyer) external view returns (Order memory) {
		return orders[_collection][_tokenId][_buyer];
	}
}