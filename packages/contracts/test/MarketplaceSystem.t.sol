// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {SetUp} from "./SetUp.sol";
import {Classes, ItemType, TokenType, OrderStatus} from "@codegen/common.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";
import {
    StatsData,
    StarterItemsData,
    Orders,
    Considerations,
    ConsiderationsData,
    Offers,
    OffersData,
    UltimateDominionConfig
} from "@codegen/index.sol";
import "forge-std/console.sol";
import {PuppetModule} from "@latticexyz/world-modules/src/modules/puppet/PuppetModule.sol";
import {UltimateDominionConfig} from "@codegen/index.sol";
import {UltimateDominionConfigSystem} from "@systems/UltimateDominionConfigSystem.sol";
import {MarketplaceSystem} from "@systems/MarketplaceSystem.sol";
import {ERC1155Module} from "@erc1155/ERC1155Module.sol";
import {ERC1155System} from "@erc1155/ERC1155System.sol";
import {IERC1155MetadataURI} from "@erc1155/IERC1155MetadataURI.sol";
import {IERC20} from "@openzeppelin/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/token/ERC20/ERC20.sol";
import {IERC1155} from "@openzeppelin/token/ERC1155/IERC1155.sol";
import {ERC1155} from "@openzeppelin/token/ERC1155/ERC1155.sol";
import {registerERC1155} from "@erc1155/registerERC1155.sol";
import {_erc1155SystemId} from "@erc1155/utils.sol";
import {Order, Offer, Consideration} from "@interfaces/Structs.sol";
import {ResourceIdLib} from "@latticexyz/store/src/ResourceId.sol";
import {ResourceId, WorldResourceIdLib, WorldResourceIdInstance} from "@latticexyz/world/src/WorldResourceId.sol";
import {_itemsSystemId, _lootManagerSystemId} from "../src/utils.sol";
import {
    GOLD_NAMESPACE,
    CHARACTERS_NAMESPACE,
    ERC721_NAME,
    ERC721_SYMBOL,
    TOKEN_URI,
    ITEMS_NAMESPACE
} from "../constants.sol";
import {GasReporter} from "@latticexyz/gas-report/src/GasReporter.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";
import {RESOURCE_SYSTEM} from "@latticexyz/world/src/worldResourceTypes.sol";

import "forge-std/console.sol";

contract Test_MarketplaceSystem is SetUp, GasReporter {
    uint256 MAX_INT = 2 ** 256 - 1;
    address lootManager;
    address marketplace;

    function setUp() public virtual override {
        super.setUp();
        vm.prank(deployer);
        world.UD__setAdmin(address(this), true);
        lootManager = Systems.getSystem(_lootManagerSystemId("UD"));
        marketplace = world.UD__marketplaceAddress();
        // world.grantAccess(_itemsSystemId("UD"), address(this));
    }

    function test_CreateOrderForERC1155() public {
        startGasReport("creates an order for an item");
        IERC20 gold = IERC20(world.UD__getGoldToken());
        IERC1155 items = IERC1155(world.UD__getItemsContract());
        uint256 amount = 9 ether;
        // create userA
        address userA = makeAddr("userA");
        bytes32 userACharacterID = world.UD__mintCharacter(userA, bytes32("Alan"), "test_Character_URI");
        // give userA gold
        world.UD__dropGoldToPlayer(userACharacterID, amount);
        // have userA set max allowance for their gold
        vm.startPrank(userA);
        gold.approve(world.UD__marketplaceAddress(), MAX_INT);
        // have userA create an order

        Offer memory oA =
            Offer({tokenType: TokenType.ERC20, token: world.UD__getGoldToken(), identifier: 0, amount: amount});
        Consideration memory cA = Consideration({
            tokenType: TokenType.ERC1155,
            token: world.UD__getItemsContract(),
            identifier: 1,
            amount: 1,
            recipient: userA
        });

        bytes32 userAOrder = world.UD__createOrder(Order({offer: oA, consideration: cA, signature: "", offerer: userA}));
        endGasReport();
        assertEq(items.balanceOf(userA, 1), 0, "user a incorrect items balance");
        assertEq(gold.balanceOf(userA), 0, "user A incorrect gold balance");
        assertEq(items.balanceOf(lootManager, 1), 10000000000000000000, "incorrect loot manager item balance");
        assertEq(gold.balanceOf(lootManager), amount, "incorrect loot manager gold balance");
    }

    function test_CreateOrderForERC20() public {
        startGasReport("creates an order for gold");
        IERC20 gold = IERC20(world.UD__getGoldToken());
        IERC1155 items = IERC1155(world.UD__getItemsContract());
        uint256 amount = 1;
        // create userA
        address userA = makeAddr("userA");
        bytes32 userACharacterID = world.UD__mintCharacter(userA, bytes32("Alan"), "test_Character_URI");
        // give userA an item
        world.UD__adminDropItem(userACharacterID, 1, 1);
        assertEq(items.balanceOf(userA, 1), 1);
        assertEq(items.balanceOf(lootManager, 1), 10000000000000000000 - 1);
        // have userA set max allowance for their item
        vm.startPrank(userA);
        gold.approve(world.UD__marketplaceAddress(), MAX_INT);
        items.setApprovalForAll(world.UD__marketplaceAddress(), true);
        // have userA create an order
        Offer memory oA =
            Offer({tokenType: TokenType.ERC1155, token: world.UD__getItemsContract(), identifier: 1, amount: amount});
        Consideration memory cA = Consideration({
            tokenType: TokenType.ERC20,
            token: world.UD__getGoldToken(),
            identifier: 0,
            amount: 1 ether,
            recipient: userA
        });
        bytes32 userAOrder = world.UD__createOrder(Order({offer: oA, consideration: cA, signature: "", offerer: userA}));
        endGasReport();
        assertEq(items.balanceOf(userA, 1), 0);
        assertEq(gold.balanceOf(userA), 0);
        assertEq(items.balanceOf(lootManager, 1), 10000000000000000000);
        assertEq(gold.balanceOf(lootManager), 0);
    }

    function test_cancelOrderForERC1155Twice() public {
        startGasReport("cancels an order for an item twice");
        IERC20 gold = IERC20(world.UD__getGoldToken());
        IERC1155 items = IERC1155(world.UD__getItemsContract());
        uint256 amount = 9 ether;
        // create userA
        address userA = makeAddr("userA");
        bytes32 userACharacterID = world.UD__mintCharacter(userA, bytes32("Alan"), "test_Character_URI");
        // give userA gold
        world.UD__dropGoldToPlayer(userACharacterID, amount);
        // have userA set max allowance for their gold
        vm.startPrank(userA);
        gold.approve(marketplace, MAX_INT);
        // have userA create an order
        Offer memory oA =
            Offer({tokenType: TokenType.ERC20, token: world.UD__getGoldToken(), identifier: 0, amount: amount});
        Consideration memory cA = Consideration({
            tokenType: TokenType.ERC1155,
            token: world.UD__getItemsContract(),
            identifier: 1,
            amount: 1,
            recipient: userA
        });

        bytes32 userAOrder = world.UD__createOrder(Order({offer: oA, consideration: cA, signature: "", offerer: userA}));
        // have userA cancel their order
        world.UD__cancelOrder(userAOrder);
        endGasReport();

        assertEq(items.balanceOf(userA, 1), 0, "user a incorrect items balance");
        assertEq(gold.balanceOf(userA), amount, "user A incorrect gold balance");
        assertEq(items.balanceOf(lootManager, 1), 10 ether, "incorrect loot manager item balance");
        assertEq(gold.balanceOf(lootManager), 0, "incorrect loot manager gold balance");
    }

    function test_cancelOrderForERC20Twice() public {
        startGasReport("attempts to cancel an order for gold twice");
        IERC20 gold = IERC20(world.UD__getGoldToken());
        IERC1155 items = IERC1155(world.UD__getItemsContract());
        uint256 amount = 1;
        // create userA
        address userA = makeAddr("userA");
        bytes32 userACharacterID = world.UD__mintCharacter(userA, bytes32("Alan"), "test_Character_URI");
        // give userA an item
        world.UD__adminDropItem(userACharacterID, 1, 1);
        // have userA set max allowance for their item
        vm.startPrank(userA);
        items.setApprovalForAll(marketplace, true);
        // have userA create an order
        Offer memory oA =
            Offer({tokenType: TokenType.ERC1155, token: world.UD__getItemsContract(), identifier: 1, amount: amount});
        Consideration memory cA = Consideration({
            tokenType: TokenType.ERC20,
            token: world.UD__getGoldToken(),
            identifier: 0,
            amount: 1 ether,
            recipient: userA
        });
        bytes32 userAOrder = world.UD__createOrder(Order({offer: oA, consideration: cA, signature: "", offerer: userA}));
        world.UD__cancelOrder(userAOrder);
        vm.expectRevert(bytes("Order is not active"));
        world.UD__cancelOrder(userAOrder);

        endGasReport();
        assertEq(items.balanceOf(userA, 1), 1, "user a incorrect items balance");
        assertEq(gold.balanceOf(userA), 0, "user A incorrect gold balance");
        assertEq(items.balanceOf(lootManager, 1), 10 ether - 1, "incorrect loot manager item balance");
        assertEq(gold.balanceOf(lootManager), 0, "incorrect loot manager gold balance");
    }

    function test_cancelOrderForERC1155() public {
        startGasReport("attempts to cancel an order for an item");
        IERC20 gold = IERC20(world.UD__getGoldToken());
        IERC1155 items = IERC1155(world.UD__getItemsContract());
        uint256 amount = 9 ether;
        // create userA
        address userA = makeAddr("userA");
        bytes32 userACharacterID = world.UD__mintCharacter(userA, bytes32("Alan"), "test_Character_URI");
        // give userA gold
        world.UD__dropGoldToPlayer(userACharacterID, amount);
        // have userA set max allowance for their gold
        vm.startPrank(userA);
        gold.approve(marketplace, MAX_INT);
        // have userA create an order

        Offer memory oA =
            Offer({tokenType: TokenType.ERC20, token: world.UD__getGoldToken(), identifier: 0, amount: amount});
        Consideration memory cA = Consideration({
            tokenType: TokenType.ERC1155,
            token: world.UD__getItemsContract(),
            identifier: 1,
            amount: 1,
            recipient: userA
        });

        bytes32 userAOrder = world.UD__createOrder(Order({offer: oA, consideration: cA, signature: "", offerer: userA}));
        // have userA cancel their order
        world.UD__cancelOrder(userAOrder);
        vm.expectRevert(bytes("Order is not active"));
        world.UD__cancelOrder(userAOrder);

        endGasReport();

        assertEq(items.balanceOf(userA, 1), 0, "user a incorrect items balance");
        assertEq(gold.balanceOf(userA), amount, "user A incorrect gold balance");
        assertEq(items.balanceOf(lootManager, 1), 10 ether, "incorrect loot manager item balance");
        assertEq(gold.balanceOf(lootManager), 0, "incorrect loot manager gold balance");
    }

    function test_cancelOrderForERC20() public {
        startGasReport("cancels an order for gold");
        IERC20 gold = IERC20(world.UD__getGoldToken());
        IERC1155 items = IERC1155(world.UD__getItemsContract());
        uint256 amount = 1;
        // create userA
        address userA = makeAddr("userA");
        bytes32 userACharacterID = world.UD__mintCharacter(userA, bytes32("Alan"), "test_Character_URI");
        // give userA an item
        world.UD__adminDropItem(userACharacterID, 1, 1);
        assertEq(items.balanceOf(userA, 1), 1);
        // have userA set max allowance for their item
        vm.startPrank(userA);

        items.setApprovalForAll(marketplace, true);
        // have userA create an order
        Offer memory oA =
            Offer({tokenType: TokenType.ERC1155, token: world.UD__getItemsContract(), identifier: 1, amount: amount});
        Consideration memory cA = Consideration({
            tokenType: TokenType.ERC20,
            token: world.UD__getGoldToken(),
            identifier: 0,
            amount: 1 ether,
            recipient: userA
        });

        bytes32 userAOrder = world.UD__createOrder(Order({offer: oA, consideration: cA, signature: "", offerer: userA}));
        console.log(lootManager);
        world.UD__cancelOrder(userAOrder);
        endGasReport();
        assertEq(items.balanceOf(userA, 1), 1, "user a incorrect items balance");
        assertEq(gold.balanceOf(userA), 0, "user A incorrect gold balance");
        assertEq(items.balanceOf(lootManager, 1), 10 ether - 1, "incorrect loot manager item balance");
        assertEq(gold.balanceOf(lootManager), 0, "incorrect loot manager gold balance");
    }

    function test_fulfillOrderForERC20Twice() public {
        startGasReport("attempts to fill the same order twice");
        IERC20 gold = IERC20(world.UD__getGoldToken());
        IERC1155 items = IERC1155(world.UD__getItemsContract());
        uint256 amount = 9 ether;
        // create userA
        address userA = makeAddr("userA");
        bytes32 userACharacterID = world.UD__mintCharacter(userA, bytes32("Alan"), "test_Character_URI");
        // give userA an item
        world.UD__adminDropItem(userACharacterID, 1, 1);
        // have userA set max allowance for their gold
        vm.startPrank(userA);
        items.setApprovalForAll(marketplace, true);
        // have userA create an order

        Offer memory oA =
            Offer({tokenType: TokenType.ERC1155, token: world.UD__getItemsContract(), identifier: 1, amount: 1});
        Consideration memory cA = Consideration({
            tokenType: TokenType.ERC20,
            token: world.UD__getGoldToken(),
            identifier: 0,
            amount: amount,
            recipient: userA
        });

        bytes32 userAOrder = world.UD__createOrder(Order({offer: oA, consideration: cA, signature: "", offerer: userA}));
        vm.stopPrank();
        // create user B
        address userB = makeAddr("userB");
        bytes32 userBCharacterID = world.UD__mintCharacter(userB, bytes32("UserB"), "test_Character_URI");
        world.UD__dropGoldToPlayer(userBCharacterID, amount);
        vm.startPrank(userB);
        // give userB an item
        gold.approve(marketplace, MAX_INT);
        // have userB create fulfill the order for userA's gold
        world.UD__fulfillOrder(userAOrder);
        vm.expectRevert(bytes("Order is not active"));
        world.UD__fulfillOrder(userAOrder);
        endGasReport();
    }

    function test_fulfillOrderForERC1155Twice() public {
        startGasReport("attempts to fulfill an order for an item twice");
        IERC20 gold = IERC20(world.UD__getGoldToken());
        IERC1155 items = IERC1155(world.UD__getItemsContract());
        uint256 amount = 9 ether;
        // create userA
        address userA = makeAddr("userA");
        bytes32 userACharacterID = world.UD__mintCharacter(userA, bytes32("Alan"), "test_Character_URI");
        // give userA gold
        world.UD__dropGoldToPlayer(userACharacterID, amount);
        // have userA set max allowance for their gold
        vm.startPrank(userA);
        gold.approve(marketplace, MAX_INT);
        // have userA create an order
        Offer memory oA =
            Offer({tokenType: TokenType.ERC20, token: world.UD__getGoldToken(), identifier: 0, amount: amount});
        Consideration memory cA = Consideration({
            tokenType: TokenType.ERC1155,
            token: world.UD__getItemsContract(),
            identifier: 1,
            amount: 1,
            recipient: userA
        });

        bytes32 userAOrder = world.UD__createOrder(Order({offer: oA, consideration: cA, signature: "", offerer: userA}));
        vm.stopPrank();
        // create user B
        address userB = makeAddr("userB");
        bytes32 userBCharacterID = world.UD__mintCharacter(userB, bytes32("UserB"), "test_Character_URI");
        world.UD__adminDropItem(userBCharacterID, 1, 1);
        vm.startPrank(userB);
        // give userB an item
        items.setApprovalForAll(marketplace, true);
        // have userB create fulfill the order for userA's gold
        world.UD__fulfillOrder(userAOrder);
        vm.expectRevert(bytes("Order is not active"));
        world.UD__fulfillOrder(userAOrder);
        endGasReport();

        assertEq(items.balanceOf(userA, 1), 1);
        assertEq(gold.balanceOf(userA), 0);
        assertEq(items.balanceOf(userB, 1), 0);
        assertEq(gold.balanceOf(userB), amount);
        assertEq(items.balanceOf(lootManager, 1), 10 ether - 1);
        assertEq(gold.balanceOf(lootManager), 0);
    }

    function test_fulfillOrderForERC1155() public {
        startGasReport("fulfills an order for an item");
        IERC20 gold = IERC20(world.UD__getGoldToken());
        IERC1155 items = IERC1155(world.UD__getItemsContract());
        uint256 amount = 9 ether;
        // create userA
        address userA = makeAddr("userA");
        bytes32 userACharacterID = world.UD__mintCharacter(userA, bytes32("Alan"), "test_Character_URI");
        // give userA gold
        world.UD__dropGoldToPlayer(userACharacterID, amount);
        // have userA set max allowance for their gold
        vm.startPrank(userA);
        gold.approve(marketplace, MAX_INT);
        // have userA create an order

        Offer memory oA =
            Offer({tokenType: TokenType.ERC20, token: world.UD__getGoldToken(), identifier: 0, amount: amount});
        Consideration memory cA = Consideration({
            tokenType: TokenType.ERC1155,
            token: world.UD__getItemsContract(),
            identifier: 1,
            amount: 1,
            recipient: userA
        });

        bytes32 userAOrder = world.UD__createOrder(Order({offer: oA, consideration: cA, signature: "", offerer: userA}));
        vm.stopPrank();
        // create user B
        address userB = makeAddr("userB");
        bytes32 userBCharacterID = world.UD__mintCharacter(userB, bytes32("UserB"), "test_Character_URI");
        world.UD__adminDropItem(userBCharacterID, 1, 1);
        vm.startPrank(userB);
        // give userB an item
        items.setApprovalForAll(marketplace, true);
        // have userB create fulfill the order for userA's gold
        world.UD__fulfillOrder(userAOrder);
        endGasReport();

        assertEq(items.balanceOf(userA, 1), 1);
        assertEq(gold.balanceOf(userA), 0);
        assertEq(items.balanceOf(userB, 1), 0);
        assertEq(gold.balanceOf(userB), amount);
        assertEq(items.balanceOf(lootManager, 1), 10 ether - 1);
        assertEq(gold.balanceOf(lootManager), 0);
    }

    function test_fulfillOrderForERC20() public {
        startGasReport("cancels an order for gold");
        IERC20 gold = IERC20(world.UD__getGoldToken());
        IERC1155 items = IERC1155(world.UD__getItemsContract());
        uint256 amount = 9 ether;
        // create userA
        address userA = makeAddr("userA");
        bytes32 userACharacterID = world.UD__mintCharacter(userA, bytes32("Alan"), "test_Character_URI");
        // give userA an item
        world.UD__adminDropItem(userACharacterID, 1, 1);
        // have userA set max allowance for their gold
        vm.startPrank(userA);
        items.setApprovalForAll(marketplace, true);
        // have userA create an order

        Offer memory oA =
            Offer({tokenType: TokenType.ERC1155, token: world.UD__getItemsContract(), identifier: 1, amount: 1});
        Consideration memory cA = Consideration({
            tokenType: TokenType.ERC20,
            token: world.UD__getGoldToken(),
            identifier: 0,
            amount: amount,
            recipient: userA
        });

        bytes32 userAOrder = world.UD__createOrder(Order({offer: oA, consideration: cA, signature: "", offerer: userA}));
        vm.stopPrank();
        // create user B
        address userB = makeAddr("userB");
        bytes32 userBCharacterID = world.UD__mintCharacter(userB, bytes32("UserB"), "test_Character_URI");
        world.UD__dropGoldToPlayer(userBCharacterID, amount);
        vm.startPrank(userB);
        // give userB an item
        gold.approve(marketplace, MAX_INT);
        // have userB create fulfill the order for userA's gold
        world.UD__fulfillOrder(userAOrder);
        endGasReport();

        assertEq(items.balanceOf(userA, 1), 0);
        assertEq(gold.balanceOf(userA), amount);
        assertEq(items.balanceOf(userB, 1), 1);
        assertEq(gold.balanceOf(userB), 0);
        assertEq(items.balanceOf(lootManager, 1), 10 ether - 1);
        assertEq(gold.balanceOf(lootManager), 0);
    }
}
