// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {SetUp} from "./SetUp.sol";
import {Classes, ItemType, TokenType, MobType} from "@codegen/common.sol";

import {
    StatsData,
    StarterItemsData,
    Orders,
    Considerations,
    ConsiderationsData,
    Offers,
    OffersData,
    Shops,
    ShopsData,
    UltimateDominionConfig
} from "@codegen/index.sol";
import "forge-std/console.sol";
import {PuppetModule} from "@latticexyz/world-modules/src/modules/puppet/PuppetModule.sol";
import {UltimateDominionConfig} from "@codegen/index.sol";
import {UltimateDominionConfigSystem} from "@systems/UltimateDominionConfigSystem.sol";
import {ShopSystem} from "@systems/ShopSystem.sol";
import {ERC1155Module} from "@erc1155/ERC1155Module.sol";
import {ERC1155System} from "@erc1155/ERC1155System.sol";
import {IERC1155MetadataURI} from "@erc1155/IERC1155MetadataURI.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {registerERC1155} from "@erc1155/registerERC1155.sol";
import {_erc1155SystemId} from "@erc1155/utils.sol";
import {Order, Offer, Consideration} from "@interfaces/Structs.sol";
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

contract Test_ShopSystem is SetUp, GasReporter {
    uint256 MAX_INT = 2 ** 256 - 1;
    address shopSystemAddress;
    IERC1155 itemsToken;

    function setUp() public virtual override {
        super.setUp();
        vm.startPrank(deployer);
        shopSystemAddress = world.UD__shopSystemAddress();
        itemsToken = IERC1155(world.UD__getItemsContract());
        uint256 maxGold =  Shops.getMaxGold(shopId);
        world.UD__setAdmin(address(this), true);
        address stuffBearer = makeAddr("stuffBearer");
        bytes32 stuffBearerCharacterID = world.UD__mintCharacter(stuffBearer, bytes32("stuffBearer"), "test_Character_URI");
        world.UD__dropGold(stuffBearerCharacterID,maxGold);
        vm.startPrank(stuffBearer);
        goldToken.transfer(shopSystemAddress, maxGold);
        vm.startPrank(deployer);

    }

    function test_itemMarkup() public {
        uint256 item = 1;
        uint256 price = world.UD__itemBase(item);
        uint256 markup = world.UD__itemMarkup(shopId, item);
        assertEq(price, 1 ether, "expecting item 1 to have a price of 1 ether");
        assertEq(markup, price + 0.002 ether);

    }
    function test_itemMarkdown() public {
        uint256 item = 1;
        uint256 price = world.UD__itemBase(item);
        uint256 markdown = world.UD__itemMarkdown(shopId, item);
        assertEq(price, 1 ether, "expecting item 1 to have a price of 1");
        assertEq(markdown, 0.005 ether);
    }

    function test_Buy() public {
        startGasReport("purchase an item from the shop");
        uint256 balance = 9 ether;
        uint256 amount = 1;
        uint256 itemIndex = 1;
        uint256[] memory buyable = Shops.getBuyableItems(shopId);        
        // create userA
        address userA = makeAddr("userA");
        bytes32 userACharacterID = world.UD__mintCharacter(userA, bytes32("Alan"), "test_Character_URI");

        // give userA gold
        world.UD__dropGold(userACharacterID, balance);
        vm.startPrank(userA);
        // have userA set an allowance for their items
        itemsToken.setApprovalForAll(shopSystemAddress, true);
        // have userA set max allowance for their gold
        goldToken.approve(shopSystemAddress, MAX_INT);
        // have userA buy from the shop
        // uint256 amount, bytes32 shopId, uint256 itemIndex, bytes32 characterId
        world.UD__buy(amount, shopId, itemIndex, userACharacterID);
        // userA should now have + amount items
        assertEq(itemsToken.balanceOf(userA, buyable[itemIndex]), amount, "User does not have appropriate items");
        // userA should now have balance - amount * markup(amount) gold
        assertEq(goldToken.balanceOf(userA), balance - (amount * world.UD__itemMarkup(shopId, buyable[itemIndex])), "User does not have appropriate gold");
        // shop stock should now be restock - amount items
        assertEq(Shops.getStock(shopId)[itemIndex], Shops.getRestock(shopId)[itemIndex] - amount, "Contract does not have appropriate stock");
        // shop gold should now be + amount * markup(amount) gold
        assertEq(Shops.getGold(shopId), Shops.getMaxGold(shopId) + (amount * world.UD__itemMarkup(shopId, buyable[itemIndex])), "Contract does not have appropriate gold");
        endGasReport();
    }

    function test_Sell() public {
        startGasReport("sell an item to the shop");
        uint256 balance = 9 ether;
        uint256 amount = 1;
        uint256 itemIndex = 1;
        address shops = world.UD__shopSystemAddress();
        // create userA
        address userA = makeAddr("userA");
        bytes32 userACharacterID = world.UD__mintCharacter(userA, bytes32("Alan"), "test_Character_URI");

        // give userA an item
        world.UD__dropItem(userACharacterID, itemIndex, amount);
        vm.startPrank(userA);
        // have userA set an allowance for their items
        itemsToken.setApprovalForAll(shopSystemAddress, true);
        // have userA set max allowance for their gold
        goldToken.approve(shops, MAX_INT);
        console.log(world.UD__getLootManagerSystem());
        // have userA sell to the shop
        // uint256 amount, bytes32 shopId, uint256 itemIndex, bytes32 characterId
        world.UD__sell(amount, shopId, itemIndex, userACharacterID);
        // userA should now have - amount items
        assertEq(itemsToken.balanceOf(userA, Shops.getBuyableItems(shopId)[itemIndex]), amount - amount, "User does not have appropriate items");
        // userA should now have balance + amount * markdown(amount) gold
        assertEq(goldToken.balanceOf(userA), (amount * world.UD__itemMarkdown(shopId, itemIndex)), "User does not have appropriate gold");
        // shop stock should now be restock + amount items
        assertEq(Shops.getStock(shopId)[itemIndex], Shops.getRestock(shopId)[itemIndex] + amount, "Contract does not have appropriate stock");
        // shop gold should now be - price * markup(amount) gold
        assertEq(Shops.getGold(shopId), Shops.getMaxGold(shopId) - (amount * world.UD__itemMarkdown(shopId, itemIndex)), "Contract does not have appropriate gold");
        endGasReport();
    }

    function test_Restock() public{
        // create userA
        uint256 item = 1;
        address userA = makeAddr("userA");
        bytes32 userACharacterID = world.UD__mintCharacter(userA, bytes32("Alan"), "test_Character_URI");
        uint256[] memory stock = Shops.getStock(shopId);
        stock[item] = 0;

        Shops.setStock(shopId, stock);
        assertEq(Shops.getStock(shopId)[item], 0);
        world.UD__restock(shopId);
        // the stock should equal 
        assertEq(Shops.getStock(shopId)[item], Shops.getRestock(shopId)[item]);
    }
        function test_RestockTooSoon() public{
        // create userA
        uint256 item = 1;
        address userA = makeAddr("userA");
        bytes32 userACharacterID = world.UD__mintCharacter(userA, bytes32("Alan"), "test_Character_URI");
        uint256[] memory stock = Shops.getStock(shopId);
        stock[item] = 0;

        Shops.setStock(shopId, stock);
        assertEq(Shops.getStock(shopId)[item], 0);
        // console.log(Shops.getTimestamp(shopId));
        world.UD__restock(shopId);
        // console.log(Shops.getTimestamp(shopId));
        // console.log(block.timestamp);
        //vm.expectRevert(bytes("You must wait 12 hours to restock"));
        assertEq(Shops.getStock(shopId)[item], 0);

        world.UD__restock(shopId);
        // the stock should equal 
    }
}
