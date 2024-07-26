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

/*
interface IWETH {
    function deposit() external payable;
    function withdraw(uint wad) external;

    function transfer(address to, uint256 value) external returns (bool);
}
*/
struct Order {
    address buyer;
    uint128 priceInWeiEach;
    uint128 quantity;
}

contract AuctionHouse is ReentrancyGuard, ERC1155Holder {
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
    function placeOrder(address _collection, uint256 _id, uint128 _quantity, uint256 _price) external nonReentrant returns (Order memory){
        require(_quantity > 0, "You cannot place an order for nothing.");
        require(collections[_collection] == true, "This collection is not allowed.");
        require(_quantity > 1 ? IERC165(_collection).supportsInterface(interface721) : true, "You can only purchase one of this item.");
        Order memory order = orders[_collection][_id][msg.sender];
        require(order.priceInWeiEach * order.quantity == 0, "You already have an order for this item. Please cancel the existing order before making a new one.");
        uint128 priceInWeiEach = uint128(_price) / _quantity;
		require(priceInWeiEach > 0, "Zero wei offers not accepted.");

		// EFFECTS
        orders[_collection][_id][msg.sender].buyer = msg.sender;
		orders[_collection][_id][msg.sender].priceInWeiEach = priceInWeiEach;
		orders[_collection][_id][msg.sender].quantity = _quantity;

        // INTERACTIONS
        IERC20(gold).safeTransferFrom(msg.sender, address(this), _price);
        return orders[_collection][_id][msg.sender];
        
    }
	function cancelOrder(address _collection, uint256 _id) external nonReentrant {
		// CHECKS
        Order memory order = orders[_collection][_id][msg.sender];
		uint256 amountToSendBack = order.priceInWeiEach * order.quantity;
		require(amountToSendBack != 0, "You do not have an existing order for this item.");

		// EFFECTS
		delete orders[_collection][_id][msg.sender];

		// INTERACTIONS
        IERC20(gold).safeTransfer(msg.sender, amountToSendBack);
	}
    function fulfillOrder(address _collection, uint256 _id, address _buyer, uint256 _expectedPriceInWeiEach) external  nonReentrant returns (uint256) {
		// CHECKS
		Order memory order = orders[_collection][_id][_buyer];
        require(order.quantity > 0, "This order does not exist.");
		require(order.priceInWeiEach >= _expectedPriceInWeiEach, "user offer insufficient"); // protects bots from users frontrunning them
		if(IERC165(_collection).supportsInterface(interface721))
        {
            require(IERC721(_collection).ownerOf(_id) == msg.sender || IERC721(_collection).getApproved(_id) == msg.sender, "You do not own the item.");
        }
		else if(IERC165(_collection).supportsInterface(interface1155))
        {
            require(IERC1155(_collection).balanceOf(msg.sender, _id) >= 1, "You do not have enough of the item.");
        }

		// EFFECTS
		Order memory newOrder;
		if (order.quantity > 1) {
		newOrder.priceInWeiEach = order.priceInWeiEach;
		newOrder.quantity = order.quantity - 1;
		}
		orders[_collection][_id][_buyer] = newOrder;

		// uint256 artBlocksBrokerFee = order.priceInWeiEach * artBlocksBrokerFeeBips / 10_000;
		// balances[profitReceiver] += artBlocksBrokerFee;

		// INTERACTIONS
		// transfer NFT to user
        if(IERC165(_collection).supportsInterface(interface721)) {
            IERC721(_collection).safeTransferFrom(msg.sender, order.buyer, order.id);
        }
        else if(IERC165(_collection).supportsInterface(interface1155)){
            IERC1155(_collection).safeTransferFrom(msg.sender, order.buyer, order.id, 1, new bytes(0));

        }
		// // pay the fullfiller
		// if (_sendNow) {
		// 	sendValue(payable(_profitTo), order.priceInWeiEach - artBlocksBrokerFee);
		// } else {
		// 	balances[_profitTo] += order.priceInWeiEach - artBlocksBrokerFee;
		// }
        IERC20(gold).safeTransfer(address(this), order.priceInWeiEach);

		// emit Action(_user, _artBlocksProjectId, newOrder.priceInWeiEach, newOrder.quantity, 'order fulfilled', _tokenId);

		// return order.priceInWeiEach - artBlocksBrokerFee; // proceeds to order fullfiller
        return newOrder.priceInWeiEach;
	}
	function viewOrder(address _collection, uint256 _id, address _buyer) external view returns (Order memory) {
		return orders[_collection][_id][_buyer];
	}

	function viewOrders(address[] memory _collections, uint256[] memory _ids, address[] memory _buyers) external view returns (Order[] memory) {
		Order[] memory output = new Order[](_collections.length);
		for (uint256 i = 0; i < _collections.length; i++) output[i] = orders[_collections[i]][_ids[i]][_buyers[i]];
		return output;
	}
}