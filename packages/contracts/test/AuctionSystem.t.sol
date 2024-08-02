// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {SetUp} from "./SetUp.sol";
import {Classes, ItemType, TokenType, OrderStatus} from "@codegen/common.sol";
import {StatsData, StarterItemsData, Orders, Considerations, ConsiderationsData, Offers, OffersData, UltimateDominionConfig} from "@codegen/index.sol";
import "forge-std/console2.sol";
import {PuppetModule} from "@latticexyz/world-modules/src/modules/puppet/PuppetModule.sol";
import {UltimateDominionConfig} from "@codegen/index.sol";
import {UltimateDominionConfigSystem} from "@systems/UltimateDominionConfigSystem.sol";
import {AuctionHouseSystem} from "@systems/AuctionHouseSystem.sol";
import {ERC1155Module} from "@erc1155/ERC1155Module.sol";
import {ERC1155System} from "@erc1155/ERC1155System.sol";
import {IERC1155MetadataURI} from "@erc1155/IERC1155MetadataURI.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {registerERC1155} from "@erc1155/registerERC1155.sol";
import {_erc1155SystemId} from "@erc1155/utils.sol";
import {WeaponStats, Order, Offer, Consideration} from "@interfaces/Structs.sol";
import {ResourceIdLib} from "@latticexyz/store/src/ResourceId.sol";
import {ResourceId, WorldResourceIdLib, WorldResourceIdInstance} from "@latticexyz/world/src/WorldResourceId.sol";
import {_itemsSystemId} from "../src/utils.sol";
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

contract Test_AuctionSystem is SetUp, GasReporter {
    uint256 MAX_INT = 2**256 - 1;


    function setUp() public virtual override {
        super.setUp();
        vm.prank(deployer);
        world.UD__setAdmin(address(this), true);
        // world.grantAccess(_itemsSystemId("UD"), address(this));

    }

    function test_CreateOrder() public {
        startGasReport("creates an order");
        IERC20 gold = IERC20(world.UD__getGoldToken());
        IERC1155 items = IERC1155(world.UD__getItemsContract());
        uint256 amount = 9 ether;
        address auctionHouse = world.UD__auctionHouseAddress();
        // create userA
        address userA = makeAddr("userA");
        bytes32 userACharacterID = world.UD__mintCharacter(userA, bytes32("Alan"), "test_Character_URI");
        // give userA gold
        world.UD__dropGold(userACharacterID, amount);
        // have userA set max allowance for their gold
        vm.startPrank(userA);
        gold.approve(auctionHouse, MAX_INT);
        // have userA create an order
        Offer memory oA = Offer({tokenType:  TokenType.ERC20, token: world.UD__getGoldToken(), identifier: 0, amount: amount});
        Consideration memory cA = Consideration({tokenType: TokenType.ERC1155, token: world.UD__getItemsContract(), identifier: 1, amount: 1, recipient: userA});
        bytes32 userAOrder = world.UD__createOrder(Order({offer: oA, consideration: cA, signature: "", offerer: userA}));
        assert(gold.balanceOf(userA) == 0);
        assert(gold.balanceOf(auctionHouse) == amount);
        // // create user B
        // address userB = makeAddr("userB");
        // // give userB an item
        // vm.prank(userB);
        // // have userB create an order for userA's gold
        // Offer memory oB = Offer({tokenType:  TokenType.ERC1155, token: world.UD__getGoldToken(), identifier: 0, amount: 1});
        // Consideration memory cB = Consideration({tokenType: TokenType.ERC20, token: world.UD__getItemsContract(), identifier: 1, amount: 1 ether, recipient: userB});
        // bytes32 userBOrder = world.UD__createOrder(Order({offer: oB, consideration: cB, signature: "", offerer: userB}));
        // // have userB cancel their order
        // world.UD__cancelOrder(userBOrder);
        // // have userB create fulfill the order for userA's gold
        // world.UD__fulfillOrder(userAOrder);
        endGasReport();
    }

    function test_cancelOrder() public {
        startGasReport("cancels an order");
        IERC20 gold = IERC20(world.UD__getGoldToken());
        IERC1155 items = IERC1155(world.UD__getItemsContract());
        uint256 amount = 9 ether;
        address auctionHouse = world.UD__auctionHouseAddress();
        // create userA
        address userA = makeAddr("userA");
        bytes32 userACharacterID = world.UD__mintCharacter(userA, bytes32("Alan"), "test_Character_URI");
        // give userA gold
        world.UD__dropGold(userACharacterID, amount);
        // have userA set max allowance for their gold
        vm.startPrank(userA);
        gold.approve(auctionHouse, MAX_INT);
        // have userA create an order
        Offer memory oA = Offer({tokenType:  TokenType.ERC20, token: world.UD__getGoldToken(), identifier: 0, amount: amount});
        Consideration memory cA = Consideration({tokenType: TokenType.ERC1155, token: world.UD__getItemsContract(), identifier: 1, amount: 1, recipient: userA});
        bytes32 userAOrder = world.UD__createOrder(Order({offer: oA, consideration: cA, signature: "", offerer: userA}));
        // have userA cancel their order
        console.log(auctionHouse);
        world.UD__cancelOrder(userAOrder);

        endGasReport();
    }

    function test_fulfillOrder() public {
        startGasReport("cancels an order");

        endGasReport();
    }
}
