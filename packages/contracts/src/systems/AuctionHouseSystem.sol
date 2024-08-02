// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";

import {
    Orders, Considerations, ConsiderationsData, Offers, OffersData, UltimateDominionConfig
} from "@codegen/index.sol";
import {IWorld} from "@world/IWorld.sol";
import {TokenType, OrderStatus} from "@codegen/common.sol";
import {Counters} from "@tables/Counters.sol";
import {Order, Offer, Consideration} from "@interfaces/Structs.sol";
import {ERC1155System} from "@erc1155/ERC1155System.sol";
import {_requireOwner, _requireAccess, _lootManagerSystemId} from "../utils.sol";
import {_erc1155SystemId, _erc20SystemId } from "../utils.sol";
import {ITEMS_NAMESPACE, WORLD_NAMESPACE, GOLD_NAMESPACE} from "../../constants.sol";
import {IERC1155} from "@erc1155/IERC1155.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract AuctionHouseSystem is System {
    uint256 MAX_INT = 2**256 - 1;

    /**
     * Create a new order for a desired NFT or Gold
     * @param order An order
     */
    function createOrder(Order memory order) public returns (bytes32 _orderHash) {
        // create OffersData
        OffersData memory newOffer = OffersData({tokenType: order.offer.tokenType, token: order.offer.token, identifier: order.offer.identifier, amount: order.offer.amount});
        // create ConsiderationsData
        ConsiderationsData memory newConsideration = ConsiderationsData({tokenType: order.consideration.tokenType, token: order.consideration.token, identifier: order.consideration.identifier, amount: order.consideration.amount, recipient: order.consideration.recipient});
        // create order Hash out of offer and consideration data and the Counter for the offerer
        uint256 offerCounter = Counters.getCounter(order.offerer, 0) + 1;
        Counters.setCounter(order.consideration.recipient, 0, (offerCounter));
        _orderHash = getOrderHash(order);
        // store offer in offers table
        Offers.set(_orderHash, newOffer);
        // store consideration in considerations table
        Considerations.set(_orderHash, newConsideration);
        // transfer offer items to world contract
        _transfer(_orderHash, true, address(this), order.offerer);
        // store order in order table
        Orders.set(_orderHash, order.offerer, 0, OrderStatus.Active);
        
        // set orderStatus to pending
    }

    function fulfillOrder(bytes32 orderHash) public returns (bool fulfilled) {
        OffersData memory o = Offers.get(orderHash);
        ConsiderationsData memory c = Considerations.get(orderHash);
        // check that order is active
        require(Orders.getOrderStatus(orderHash) == OrderStatus.Active);
        // check item balances
        require(_balanceOf(o, _msgSender()) >= o.amount);
        // transfer consideration items to consideration recipient
        _transfer(orderHash, false, c.recipient, _msgSender());
        // transfer offer item to _msgSender()
        _transfer(orderHash, true, _msgSender(), address(this));
        // set order status to fulfilled
        Orders.set(orderHash, _msgSender(), 0, OrderStatus.Fullfilled);
        // assert balances
        
    }

    // cancels an order transfers offers out of escrow
    function cancelOrder(bytes32 _orderHash) public returns (bool) {
        // check that _msgSender is the person who created the order
        ConsiderationsData memory c = getConsideration(_orderHash);
        require(_msgSender() == c.recipient);
        // change the status to canceled
        Orders.setOrderStatus(_orderHash, OrderStatus.Canceled);
        // send the order item back to the user
        _transfer(_orderHash, true, c.recipient, address(this));
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

    function getOffer(bytes32 orderHash) public view returns (OffersData memory offer) {
        return Offers.get(orderHash);
    }

    function getConsideration(bytes32 orderHash) public view returns (ConsiderationsData memory consideration) {
        return Considerations.get(orderHash);
    }

    function getOrderStatus(bytes32 orderHash) public view returns (OrderStatus orderStatus) {
        return Orders.getOrderStatus(orderHash);
    }
    function auctionHouseAddress() external view returns (address){
        return address(this);
    }
    function _transfer(bytes32 orderHash, bool isOffer, address to, address from) internal {
        ConsiderationsData memory c = Considerations.get(orderHash);
        OffersData memory o = Offers.get(orderHash);
        uint256 amount = isOffer ? o.amount : c.amount;
        TokenType tokenType = isOffer ? o.tokenType : c.tokenType;
        bool isSelf = from == address(this);
        if(tokenType == TokenType.ERC20){
            if(isSelf && IERC20(o.token).allowance(address(this), address(this)) != MAX_INT) {
                 IERC20(o.token).approve(address(this), MAX_INT); 
            }
            IERC20(o.token).transferFrom(from, to, amount);
            // IWorld(_world()).call(
            // o.token,
            // abi.encodeWithSignature(
            //     //address from, address to, uint256 amount
            //     "transferFrom(address,uint256)",
            //     from,
            //     to,
            //     amount
            // ));
        }
        else if(tokenType == TokenType.ERC1155){
            if(isSelf && IERC1155(o.token).isApprovedForAll(address(this), address(this)) != true) {
                 IERC1155(o.token).setApprovalForAll(address(this), true); 
            }
            IERC1155(o.token).safeTransferFrom(from, to, o.identifier, amount, "");
            // IWorld(_world()).call(
            // _erc1155SystemId(ITEMS_NAMESPACE),
            // abi.encodeWithSignature(
            //     //address from, address to, uint256 id, uint256 amount, bytes data
            //     "safeTransferFrom(address,address,uint256,uint256,bytes)",
            //     from,
            //     to,
            //     o.identifier,
            //     amount,
            //     ""
            // ));

        }
    }
    function _balanceOf(OffersData memory offer, address owner) internal view returns(uint){
        if(offer.tokenType == TokenType.ERC20){
            //return ERC1155System.balanceOf(owner);
            return IERC20(offer.token).balanceOf(owner);

        }
        else if(offer.tokenType == TokenType.ERC1155){
            return IERC1155(offer.token).balanceOf(owner, offer.identifier);

            // IWorld(_world()).call(
            // _erc20SystemId(GOLD_NAMESPACE),
            // abi.encodeWithSignature(
            //     //address owner, uint256 id
            //     "balanceOf(address,uint256)",
            //     owner,
            //     offer.identifier
            // ));
        }
    }
}
