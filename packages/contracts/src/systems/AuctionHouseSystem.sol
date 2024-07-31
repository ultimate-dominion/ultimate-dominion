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
import {_requireOwner, _requireAccess} from "../utils.sol";

contract AuctionHouseSystem is System {
    function createOrder(Order memory order) public returns (bytes32 _orderHash) {
        // create OffersData
        // create ConsiderationsData
        // create order Hash out of offer and consideration data and the Counter for the offerer
        // store offer in offers table
        // store consideration in considerations table
        // store order in order table
        // transfer offer items to world contract
        // set orderStatus to pending
    }

    function fulfillOrder(bytes32 orderHash) public returns (bool fulfilled) {
        // check that order is active
        // check item balances
        // transfer consideration items to consideration recipient
        // transfer offer item to _msgSender()
        // set order status to fulfilled
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

    function getOrderStatus(bytes32 orderHash) public view returns (OrderStatus orderStatus) {}
}
