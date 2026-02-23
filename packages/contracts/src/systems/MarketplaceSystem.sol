// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";
import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {
    MarketplaceSale, MarketplaceSaleData, Orders, Considerations, ConsiderationsData, Offers, OffersData, UltimateDominionConfig
} from "@codegen/index.sol";
import {TokenType, OrderStatus} from "@codegen/common.sol";
import {Counters} from "@tables/Counters.sol";
import {Order, Offer, Consideration} from "@interfaces/Structs.sol";
import {_lootManagerSystemId} from "../utils.sol";
import {WORLD_NAMESPACE, ITEMS_NAMESPACE, GOLD_NAMESPACE} from "../../constants.sol";
import {IERC1155} from "@erc1155/IERC1155.sol";

import {IERC20} from "@openzeppelin/token/ERC20/IERC20.sol";

import {ReentrancyGuard} from "@openzeppelin/utils/ReentrancyGuard.sol";
import {PauseLib} from "../libraries/PauseLib.sol";

// Direct table access for ERC1155 (Items)
import {Owners} from "@erc1155/tables/Owners.sol";
import {_ownersTableId} from "@erc1155/utils.sol";

// Direct table access for ERC20 (Gold)
import {Balances as ERC20Balances} from "@latticexyz/world-modules/src/modules/tokens/tables/Balances.sol";
import {_balancesTableId as _goldBalancesTableId} from "@latticexyz/world-modules/src/modules/erc20-puppet/utils.sol";

contract MarketplaceSystem is System, ReentrancyGuard {
    /**
     * Create a new order for a desired NFT or Gold
     * @param order An order
     */
    function createOrder(Order memory order) public nonReentrant returns (bytes32 _orderHash) {
        PauseLib.requireNotPaused();
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
        PauseLib.requireNotPaused();
        OffersData memory o = Offers.get(orderHash);
        ConsiderationsData memory c = Considerations.get(orderHash);
        // check that order is active
        require(Orders.getOrderStatus(orderHash) == OrderStatus.Active, "Order is not active");

        // check item balances
        require(_balanceOf(orderHash, false, _msgSender()) >= c.amount, "Insufficient balance");

        // Determine gold amount and calculate fee
        uint256 goldAmount;
        address goldPayer;
        address goldReceiver;
        address itemReceiver;

        if (o.tokenType == TokenType.ERC20) {
            // Offer is Gold (buy order) - offerer put Gold in escrow, wants item
            goldAmount = o.amount;
            goldPayer = _lootManager(); // Gold is in escrow
            goldReceiver = _msgSender(); // Seller gets gold (minus fee)
            itemReceiver = c.recipient; // Original offerer gets item
        } else {
            // Offer is Item (sell order) - consideration is Gold
            goldAmount = c.amount;
            goldPayer = _msgSender(); // Buyer pays gold
            goldReceiver = c.recipient; // Seller gets gold (minus fee)
            itemReceiver = _msgSender(); // Buyer gets item
        }

        // Calculate fee (basis points: 300 = 3%)
        uint256 feePercent = UltimateDominionConfig.getFeePercent();
        address feeRecipient = UltimateDominionConfig.getFeeRecipient();
        uint256 feeAmount = (goldAmount * feePercent) / 10000;
        uint256 sellerAmount = goldAmount - feeAmount;

        // Transfer gold with fee deduction
        if (o.tokenType == TokenType.ERC20) {
            // Gold was in escrow, distribute from there
            _transferGoldDirect(_lootManager(), goldReceiver, sellerAmount);
            if (feeAmount > 0 && feeRecipient != address(0)) {
                _transferGoldDirect(_lootManager(), feeRecipient, feeAmount);
            }
            // Transfer item to buyer
            _transferItemDirect(_msgSender(), itemReceiver, c.identifier, c.amount);
        } else {
            // Gold comes from buyer
            _transferGoldDirect(goldPayer, goldReceiver, sellerAmount);
            if (feeAmount > 0 && feeRecipient != address(0)) {
                _transferGoldDirect(goldPayer, feeRecipient, feeAmount);
            }
            // Transfer item from escrow to buyer
            _transferItemDirect(_lootManager(), itemReceiver, o.identifier, o.amount);
        }

        // set order status to fulfilled
        Orders.set(orderHash, _msgSender(), 0, OrderStatus.Fulfilled);

        MarketplaceSaleData memory sale = MarketplaceSaleData({
            buyer: o.tokenType == TokenType.ERC20 ? c.recipient : _msgSender(),
            itemId: o.tokenType == TokenType.ERC20 ? c.identifier : o.identifier,
            price: goldAmount, // Original price before fee
            seller: o.tokenType == TokenType.ERC20 ? _msgSender() : c.recipient,
            timestamp: block.timestamp
        });

        MarketplaceSale.set(orderHash, sale);

        return true;
    }

    /**
     * @notice Calculate the fee amount for a given gold amount
     * @param goldAmount The total gold amount
     * @return feeAmount The fee to be deducted
     * @return sellerAmount The amount the seller receives after fee
     */
    function calculateFee(uint256 goldAmount) public view returns (uint256 feeAmount, uint256 sellerAmount) {
        uint256 feePercent = UltimateDominionConfig.getFeePercent();
        feeAmount = (goldAmount * feePercent) / 10000;
        sellerAmount = goldAmount - feeAmount;
    }

    // cancels an order transfers offers out of escrow
    function cancelOrder(bytes32 _orderHash) public nonReentrant returns (bool) {
        PauseLib.requireNotPaused();
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

        if (tokenType == TokenType.ERC20) {
            // Direct table writes for Gold transfers (bypasses ERC20System access)
            _transferGoldDirect(from, to, amount);
            return;
        } else if (tokenType == TokenType.ERC1155) {
            // Direct table writes for Item transfers (bypasses ERC1155System access)
            _transferItemDirect(from, to, identifier, amount);
            return;
        } else {
            revert("Token type is not supported");
        }
    }

    /**
     * @dev Transfer gold directly via table writes (bypasses ERC20System access checks)
     */
    function _transferGoldDirect(address from, address to, uint256 amount) internal {
        ResourceId balancesTableId = _goldBalancesTableId(GOLD_NAMESPACE);

        // Decrease sender balance
        uint256 fromBalance = ERC20Balances.get(balancesTableId, from);
        require(fromBalance >= amount, "Insufficient gold balance");
        ERC20Balances.set(balancesTableId, from, fromBalance - amount);

        // Increase recipient balance
        uint256 toBalance = ERC20Balances.get(balancesTableId, to);
        ERC20Balances.set(balancesTableId, to, toBalance + amount);
    }

    /**
     * @dev Transfer items directly via table writes (bypasses ERC1155System access checks)
     */
    function _transferItemDirect(address from, address to, uint256 itemId, uint256 amount) internal {
        ResourceId ownersTableId = _ownersTableId(ITEMS_NAMESPACE);

        // Decrease sender balance
        uint256 fromBalance = Owners.getBalance(ownersTableId, from, itemId);
        require(fromBalance >= amount, "Insufficient item balance");
        Owners.setBalance(ownersTableId, from, itemId, fromBalance - amount);

        // Increase recipient balance
        uint256 toBalance = Owners.getBalance(ownersTableId, to, itemId);
        Owners.setBalance(ownersTableId, to, itemId, toBalance + amount);
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
