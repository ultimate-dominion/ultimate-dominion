// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {SetUp} from "./SetUp.sol";
import {Classes, ItemType, TokenType, OrderStatus} from "@codegen/common.sol";

import {
    StatsData,
    StarterItemsData,
    Orders,
    Considerations,
    ConsiderationsData,
    Offers,
    OffersData,
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

    function setUp() public virtual override {
        super.setUp();
        vm.prank(deployer);
        world.UD__setAdmin(address(this), true);

        uint256[] memory sellableItems = new uint256[](3);
        uint256[] memory buyableItems = new uint256[](6);
        uint256[] memory stock = new uint256[](buyableItems.length);
        for(uint i = 0; i < 10; ++i){
            if(i < 3) sellableItems[i] = i;
            if(i < 6) buyableItems[i] = i;
            if(i < buyableItems.length) stock[i] = 5;
        }

        ShopsData memory newShop = ShopsData({
            gold: 100,
            maxGold: 100,
            priceMarkup: 0,
            priceMarkdown: 0,
            timestamp: block.timestamp,
            sellableItems: sellableItems,
            buyableItems: sellableItems,
            restock: stock,
            stock: stock
        });
        // world.grantAccess(_itemsSystemId("UD"), address(this));
    }

    function test_BuyERC1155() public {
        startGasReport("purchase an item from the shop");
        IERC20 gold = IERC20(world.UD__getGoldToken());
        IERC1155 items = IERC1155(world.UD__getItemsContract());
        uint256 amount = 9 ether;
        address shops = world.UD__shopSystemAddress();
        // create userA
        address userA = makeAddr("userA");
        bytes32 userACharacterID = world.UD__mintCharacter(userA, bytes32("Alan"), "test_Character_URI");
        // give userA gold
        world.UD__dropGold(userACharacterID, amount);
        // have userA set max allowance for their gold
        vm.startPrank(userA);
        gold.approve(shops, MAX_INT);
        // have userA buy from the shop

        // Offer memory oA =
        //     Offer({tokenType: TokenType.ERC20, token: world.UD__getGoldToken(), identifier: 0, amount: amount});
        // Consideration memory cA = Consideration({
        //     tokenType: TokenType.ERC1155,
        //     token: world.UD__getItemsContract(),
        //     identifier: 1,
        //     amount: 1,
        //     recipient: userA
        // });

        // bytes32 userAOrder = world.UD__createOrder(Order({offer: oA, consideration: cA, signature: "", offerer: userA}));
        endGasReport();
        // assertEq(items.balanceOf(userA, 1), 0);
        // assertEq(gold.balanceOf(userA), 0);
        // assertEq(items.balanceOf(auctionHouse, 1), 0);
        // assertEq(gold.balanceOf(auctionHouse), amount);
    }

    
}
