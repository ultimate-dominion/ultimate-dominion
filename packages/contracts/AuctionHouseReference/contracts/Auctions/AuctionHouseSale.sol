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


struct Sale {
    bytes32 id;
    address seller;
    uint256 price;
}

/**
 * @title AuctionHouseSale
 * @author Pupcakes
 * @notice A player who wants to sell their NFT can create an AuctionHouseSale. They define a 'Sale' desired price point and their NFT is held in the contract. Any user can use their gold to to release the locked NFT and send the gold to the creator of the sale
 */
contract AuctionHouseSale is ReentrancyGuard, ERC1155Holder {
    using SafeERC20 for IERC20;
    // the NFT collection that is approved for use of this contract
    mapping(address => bool) public collections;
    // collection => id => seller => sale
    mapping(address => mapping(uint256 => mapping(address => Sale))) public sales;

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
	event Action(address indexed _collection, uint256 indexed _tokenId, address indexed _seller, string _action);

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
    function newSale(address _collection, uint256 _tokenId, uint256 _price) external nonReentrant returns (bytes32){
        require(collections[_collection] == true, "This collection is not allowed.");
        require(_price > 0, "You cannot create an sale at no price");
        Sale memory sale = sales[_collection][_tokenId][msg.sender];
        bytes32 id = bytes32(abi.encodePacked(_collection, _tokenId, msg.sender));
        require(sale.id == 0, "You already have a sale for this item. Please cancel the existing sale before making a new one.");
		if(IERC165(_collection).supportsInterface(interface721))
        {
            require(IERC721(_collection).ownerOf(_tokenId) == msg.sender || IERC721(_collection).getApproved(_tokenId) == msg.sender, "You do not have access to the item.");
        }
		else if(IERC165(_collection).supportsInterface(interface1155))
        {
            require(IERC1155(_collection).balanceOf(msg.sender, _tokenId) >= 1, "You do not have enough of the item.");
        }

		// EFFECTS
        sales[_collection][_tokenId][msg.sender].id = id;
        sales[_collection][_tokenId][msg.sender].seller = msg.sender;
		sales[_collection][_tokenId][msg.sender].price = _price;

        // INTERACTIONS
        // transfer NFT to contract
        if(IERC165(_collection).supportsInterface(interface721)) {
            IERC721(_collection).safeTransferFrom(msg.sender, address(this), _tokenId);
        }
        else if(IERC165(_collection).supportsInterface(interface1155)){
            IERC1155(_collection).safeTransferFrom(msg.sender, address(this), _tokenId, 1, new bytes(0));

        }
        //IERC20(gold).safeTransferFrom(msg.sender, address(this), _price);
        emit Action(_collection, _tokenId, msg.sender, 'sale created');
        return id;
        
    }
	function cancelSale(address _collection, uint256 _tokenId) external nonReentrant {
		// CHECKS
        Sale memory sale = sales[_collection][_tokenId][msg.sender];
		require(sale.id != 0, "You do not have an existing sale for this item.");
		if(IERC165(_collection).supportsInterface(interface721))
        {
            require(IERC721(_collection).ownerOf(_tokenId) == msg.sender || IERC721(_collection).getApproved(_tokenId) == msg.sender, "You do not have access to the item.");
        }
		else if(IERC165(_collection).supportsInterface(interface1155))
        {
            require(IERC1155(_collection).balanceOf(msg.sender, _tokenId) >= 1, "You do not have enough of the item.");
        }

		// EFFECTS
		delete sales[_collection][_tokenId][msg.sender];

		// INTERACTIONS
        // transfer NFT to user
        if(IERC165(_collection).supportsInterface(interface721)) {
            IERC721(_collection).safeTransferFrom(address(this), msg.sender, _tokenId);
        }
        else if(IERC165(_collection).supportsInterface(interface1155)){
            IERC1155(_collection).safeTransferFrom(address(this), msg.sender, _tokenId, 1, new bytes(0));

        }
        emit Action(_collection, _tokenId, msg.sender, 'sale canceled');

	}
    function buySale(address _collection, uint256 _tokenId, address _seller, uint256 _expectedPrice) external  nonReentrant returns (bytes32) {
		// CHECKS
		Sale memory sale = sales[_collection][_tokenId][_seller];
        require(sale.id == 0, "This sale does not exist.");
		require(sale.price != _expectedPrice, "user offer does not match"); 

        
        bytes32 id = bytes32(abi.encodePacked(_collection, _tokenId, _seller));
		// EFFECTS
        delete sales[_collection][_tokenId][msg.sender];

		// INTERACTIONS
		// transfer NFT to user
        if(IERC165(_collection).supportsInterface(interface721)) {
            IERC721(_collection).safeTransferFrom(msg.sender, sale.seller, _tokenId);
        }
        else if(IERC165(_collection).supportsInterface(interface1155)){
            IERC1155(_collection).safeTransferFrom(msg.sender, sale.seller, _tokenId, 1, new bytes(0));

        }
        IERC20(gold).safeTransfer(sale.seller, sale.price);

        emit Action(_collection, _tokenId, _seller, 'sale fulfilled');
        return id;

	}
	function viewSale(address _collection, uint256 _tokenId, address _seller) external view returns (Sale memory) {
		return sales[_collection][_tokenId][_seller];
	}
}