// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";
import {
    Orders, Considerations, ConsiderationsData, Offers, OffersData, UltimateDominionConfig
} from "@codegen/index.sol";
import {IWorld} from "@world/IWorld.sol";
import {TokenType, OrderStatus} from "@codegen/common.sol";
import {Counters} from "@tables/Counters.sol";
import {Order, Offer, Consideration} from "@interfaces/Structs.sol";
import {ERC1155System} from "@erc1155/ERC1155System.sol";
import {_requireOwner, _requireAccess, _lootManagerSystemId} from "../utils.sol";
import {_erc1155SystemId, _erc20SystemId} from "../utils.sol";
import {ITEMS_NAMESPACE, WORLD_NAMESPACE, GOLD_NAMESPACE} from "../../constants.sol";
import {IERC1155} from "@erc1155/IERC1155.sol";

import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {WorldContextConsumer} from "@latticexyz/world/src/WorldContext.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract MarketplaceSystem is System, ReentrancyGuard {
    /**
     * Create a new order for a desired NFT or Gold
     * @param order An order
     */
    function createOrder(Order memory order) public nonReentrant returns (bytes32 _orderHash) {
        require(order.offerer == _msgSender(), "You cannot offer someone else's items");
        require(order.consideration.recipient == _msgSender(), "You cannot purchase an item for someone else");

        // create OffersData
        OffersData memory newOffer = OffersData({
            tokenType: order.offer.tokenType,
            token: order.offer.token,
            identifier: order.offer.identifier,
            amount: order.offer.amount
        });
        // create ConsiderationsData
        ConsiderationsData memory newConsideration = ConsiderationsData({
            tokenType: order.consideration.tokenType,
            token: order.consideration.token,
            identifier: order.consideration.identifier,
            amount: order.consideration.amount,
            recipient: order.consideration.recipient
        });

        require(
            order.offer.tokenType == TokenType.ERC20 || order.offer.tokenType == TokenType.ERC1155, "Token not accepted"
        );
        require(
            order.consideration.tokenType == TokenType.ERC20 || order.consideration.tokenType == TokenType.ERC1155,
            "Token not accepted"
        );
        require(order.offer.tokenType != order.consideration.tokenType, "Cannot cross trade");

        // create order Hash out of offer and consideration data and the Counter for the offerer
        uint256 offerCounter = Counters.getCounter(order.offerer, 0) + 1;
        Counters.setCounter(order.consideration.recipient, 0, (offerCounter));
        _orderHash = getOrderHash(order);

        // store offer in offers table
        Offers.set(_orderHash, newOffer);

        // store consideration in considerations table
        Considerations.set(_orderHash, newConsideration);

        // transfer offer items to loot manager contract
        _transfer(_orderHash, true, _lootManager(), order.offerer);

        // store order in order table
        Orders.set(_orderHash, order.offerer, 0, OrderStatus.Active);
    }

    function fulfillOrder(bytes32 orderHash) public nonReentrant returns (bool fulfilled) {
        OffersData memory o = Offers.get(orderHash);
        ConsiderationsData memory c = Considerations.get(orderHash);

        // check that order is active
        require(Orders.getOrderStatus(orderHash) == OrderStatus.Active, "Order is not active");

        // check item balances
        require(_balanceOf(orderHash, false, _msgSender()) >= c.amount, "Insufficient balance");

        // transfer consideration items to consideration recipient
        _transfer(orderHash, false, c.recipient, _msgSender());

        // transfer offer item to _msgSender()
        _transfer(orderHash, true, _msgSender(), _lootManager());

        // set order status to fulfilled
        Orders.set(orderHash, _msgSender(), 0, OrderStatus.Fulfilled);

        // assert balances
        return true;
    }

    // cancels an order transfers offers out of escrow
    function cancelOrder(bytes32 _orderHash) public nonReentrant returns (bool) {
        // check that _msgSender is the person who created the order
        require(getOrderStatus(_orderHash) == OrderStatus.Active, "Order is not active");
        ConsiderationsData memory c = getConsideration(_orderHash);
        require(_msgSender() == c.recipient);

        // change the status to canceled
        Orders.setOrderStatus(_orderHash, OrderStatus.Canceled);

        // send the order item back to the user
        _transfer(_orderHash, true, c.recipient, _lootManager());
    }

    // increments the order counter for the calling address
    function incrementCounter(address offerer) public returns (uint256) {
        require(_msgSender() == offerer);
        uint256 offerCounter = Counters.getCounter(offerer, 0) + 1;
        Counters.setCounter(offerer, 0, (offerCounter));
        return offerCounter;
    }

    function getCounter(address offerer) public view returns (uint256) {
        uint256 offerCounter = Counters.getCounter(offerer, 0);
        return offerCounter;
    }

    function getOrderHash(Order memory order) public view returns (bytes32 orderHash) {
        orderHash = keccak256(abi.encode(getCounter(order.offerer), order.offer, order.consideration));
    }

    function getOffer(bytes32 orderHash) external view returns (OffersData memory offer) {
        return Offers.get(orderHash);
    }

    function getConsideration(bytes32 orderHash) public view returns (ConsiderationsData memory consideration) {
        return Considerations.get(orderHash);
    }

    function getOrderStatus(bytes32 orderHash) public view returns (OrderStatus orderStatus) {
        return Orders.getOrderStatus(orderHash);
    }

    function marketplaceAddress() external view returns (address) {
        return address(this);
    }

    function _transfer(bytes32 orderHash, bool isOffer, address to, address from) internal {
        ConsiderationsData memory c = Considerations.get(orderHash);
        OffersData memory o = Offers.get(orderHash);
        uint256 amount = isOffer ? o.amount : c.amount;
        TokenType tokenType = isOffer ? o.tokenType : c.tokenType;
        uint256 identifier = isOffer ? o.identifier : c.identifier;
        bool isSelf = from == address(this);
        address token = isOffer ? o.token : c.token;
        if (tokenType == TokenType.ERC20) {
            if (isSelf) IERC20(token).transfer(to, amount);
            else IERC20(token).transferFrom(from, to, amount);
            return;
        } else if (tokenType == TokenType.ERC1155) {
            IERC1155(token).safeTransferFrom(from, to, identifier, amount, "");
            return;
        } else {
            revert("Token type is not supported");
        }
    }

    function _balanceOf(bytes32 orderHash, bool isOffer, address owner) internal view returns (uint256) {
        ConsiderationsData memory c = Considerations.get(orderHash);
        OffersData memory o = Offers.get(orderHash);
        TokenType tokenType = isOffer ? o.tokenType : c.tokenType;
        address token = isOffer ? o.token : c.token;
        uint256 identifier = isOffer ? o.identifier : c.identifier;
        if (tokenType == TokenType.ERC20) {
            return IERC20(token).balanceOf(owner);
        } else if (tokenType == TokenType.ERC1155) {
            return IERC1155(token).balanceOf(owner, identifier);
        }
    }

    function _lootManager() internal view returns (address) {
        return Systems.getSystem(_lootManagerSystemId(WORLD_NAMESPACE));
    }
}
