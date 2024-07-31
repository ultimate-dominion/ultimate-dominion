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

contract AuctionHouseSystem is System {
    /**
     * Create a new order for a desired NFT given an offer of gold
     * @param order An order
     */
    function createOrder(Order memory order) public returns (bytes32 _orderHash) {
        // create OffersData
        OffersData memory newOffer = OffersData({tokenType: order.offer.tokenType, token: order.offer.token, identifier: order.offer.identifier, amount: order.offer.amount});
        // create ConsiderationsData
        // create order Hash out of offer and consideration data
        // store offer in offers table
        Offers.set(_orderHash, newOffer.tokenType, newOffer.token, newOffer.identifier, newOffer.amount);
        // store consideration in considerations table
        Considerations.set(_orderHash, newConsideration.tokenType, newConsideration.token, newConsideration.identifier, newConsideration.amount, newConsideration.recipient);
        // store order in order table
        Orders.set(_orderHash, OrderStatus.Active);
        // transfer offer items to world contract
        _transfer(newOffer, _msgSender(), address(this));
        
        // set orderStatus to pending
        // dunno what he wants here, there is no pending lol
    }

    function fulfillOrder(bytes32 orderHash) public returns (bool fulfilled) {
        OffersData memory o = Offers.get(orderHash);
        // check that order is active
        require( Orders.getOrderStatus(orderHash) == OrderStatus.Active);
        // check item balances
        require(_balanceOf(o, _msgSender()) >= o.amount);
        // transfer consideration items to consideration recipient
        ConsiderationsData memory c = Considerations.get(orderHash);
        // transfer offer item to _msgSender()
        _transfer(o, _msgSender(), address(this));
        // set order status to fulfilled
        Orders.set(orderHash, OrderStatus.Fullfilled);
        // assert balances
        
    }

    // cancels an order transfers offers out of escrow
    function cancelOrder(bytes32 _orderId) public returns (bool) {}

    // increments the order counter for the calling address
    function incrementCounter(address offerer) public returns (uint256) {}

    function getCounter(address offerer) public view returns (uint256) {}

    function getOrderHash(Order memory order) public view returns (bytes32 orderHash) {}

    function getOffer(bytes32 orderHash) public view returns (Offer memory offer) {}

    function getConsideration(bytes32 orderHash) public view returns (Consideration memory consideration) {}

    function getOrderStatus(bytes32 orderHash) public view returns (OrderStatus orderStatus) {
        return Orders.getOrderStatus(orderHash);
    }
    function _transfer(OffersData memory offer, address to, address from) internal {
        if(offer.tokenType == TokenType.ERC20){
            IWorld(_world()).call(
            _erc20SystemId(GOLD_NAMESPACE),
            abi.encodeWithSignature(
                //address from, address to, uint256 amount
                "transferFrom(address,uint256)",
                from,
                to,
                offer.amount
            ));
        }
        else if(offer.tokenType == TokenType.ERC1155){
            IWorld(_world()).call(
            _erc1155SystemId(ITEMS_NAMESPACE),
            abi.encodeWithSignature(
                //address from, address to, uint256 id, uint256 amount, bytes data
                "safeTransferFrom(address,address,uint256,uint256,bytes)",
                from,
                to,
                offer.identifier,
                offer.amount,
                ""
            ));

        }
    }
    function _balanceOf(OffersData memory offer, address owner) internal returns(uint){
        if(offer.tokenType == TokenType.ERC20){
            //return ERC1155System.balanceOf(owner);

        }
        else if(offer.tokenType == TokenType.ERC1155){
            IWorld(_world()).call(
            _erc20SystemId(GOLD_NAMESPACE),
            abi.encodeWithSignature(
                //address owner, uint256 id
                "balanceOf(address,uint256)",
                owner,
                offer.identifier
            ));
        }
    }
}
