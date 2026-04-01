// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {SetUp} from "./SetUp.sol";
import {Classes, ItemType, TokenType, MobType, EncounterType} from "@codegen/common.sol";
import {
    InvalidShopEncounter,
    Unauthorized,
    OutOfStock,
    ShopInsufficientGold,
    InsufficientItemBalance,
    ArrayMismatch
} from "../src/Errors.sol";

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
import {IERC20} from "@openzeppelin/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/token/ERC20/ERC20.sol";
import {IERC1155} from "@openzeppelin/token/ERC1155/IERC1155.sol";
import {ERC1155} from "@openzeppelin/token/ERC1155/ERC1155.sol";
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

    function createShopEncounter(bytes32 characterId, bytes32 shopId) public returns (bytes32) {
        bytes32[] memory group1 = new bytes32[](1);
        bytes32[] memory group2 = new bytes32[](1);
        group1[0] = characterId;
        group2[0] = shopId;
        return world.UD__createEncounter(EncounterType.World, group1, group2);
    }

    function setUp() public virtual override {
        super.setUp();
        vm.startPrank(deployer);
        shopSystemAddress = world.UD__shopSystemAddress();
        itemsToken = IERC1155(world.UD__getItemsContract());
        uint256 maxGold = Shops.getMaxGold(shopId);
        world.UD__setAdmin(address(this), true);
        address stuffBearer = makeAddr("stuffBearer");
        bytes32 stuffBearerCharacterID =
            world.UD__mintCharacter(stuffBearer, bytes32("stuffBearer"), "test_Character_URI");
        world.UD__dropGoldToPlayer(stuffBearerCharacterID, maxGold);
        vm.startPrank(stuffBearer);
        goldToken.transfer(shopSystemAddress, maxGold);
        vm.startPrank(deployer);
    }

    function test_itemMarkup() public {
        uint256 item = 1;
        uint256 price = world.UD__itemBase(item);
        uint256 markup = world.UD__itemMarkup(shopId, item);
        assertEq(price, 50 ether, "expecting item 1 to have a price of 1 ether");
        assertEq(markup, 60 ether);
    }

    function test_itemMarkdown() public {
        uint256 item = 1;
        uint256 price = world.UD__itemBase(item);
        uint256 markdown = world.UD__itemMarkdown(shopId, item);
        assertEq(price, 50 ether, "expecting item 1 to have a price of 1 ether");
        assertEq(markdown, price / 2);
    }

    function test_Buy() public {
        world.UD__dropGoldToPlayer(bobCharacterId, 100 ether);
        startGasReport("purchase an item from the shop");
        uint256 balance = goldToken.balanceOf(bob);
        uint256 amount = 1;
        uint256 itemIndex = 1;
        uint256[] memory buyable = Shops.getBuyableItems(shopId);
        // create userA
        vm.startPrank(bob);
        // spawn
        world.UD__spawn(bobCharacterId);

        // have userA set an allowance for their items
        itemsToken.setApprovalForAll(shopSystemAddress, true);
        // have userA set max allowance for their gold
        goldToken.approve(shopSystemAddress, MAX_INT);

        createShopEncounter(bobCharacterId, shopId);
        // have userA buy from the shop
        // uint256 amount, bytes32 shopId, uint256 itemIndex, bytes32 characterId
        world.UD__buy(amount, shopId, itemIndex, bobCharacterId);
        // userA should now have + amount items
        assertEq(itemsToken.balanceOf(bob, buyable[itemIndex]), amount, "User does not have appropriate items");
        // userA should now have balance - amount * markup(amount) gold
        assertEq(
            goldToken.balanceOf(bob),
            balance - (amount * world.UD__itemMarkup(shopId, buyable[itemIndex])),
            "User does not have appropriate gold"
        );
        // shop stock should now be restock - amount items
        assertEq(
            Shops.getStock(shopId)[itemIndex],
            Shops.getRestock(shopId)[itemIndex] - amount,
            "Contract does not have appropriate stock"
        );
        // shop gold should now be + amount * markup(amount) gold
        assertEq(
            Shops.getGold(shopId),
            Shops.getMaxGold(shopId) + (amount * world.UD__itemMarkup(shopId, buyable[itemIndex])),
            "Contract does not have appropriate gold"
        );
        endGasReport();
    }

    function test_BuyWrongPerson() public {
        startGasReport("purchase an item from the shop for another person");
        uint256 balance = 100 ether;
        uint256 amount = 1;
        uint256 itemIndex = 1;
        uint256[] memory buyable = Shops.getBuyableItems(shopId);
        // create userA
        address userA = makeAddr("userA");
        bytes32 userACharacterID = world.UD__mintCharacter(userA, bytes32("Alan"), "test_Character_URI");

        // create userB
        address userB = makeAddr("userB");
        bytes32 userBCharacterID = world.UD__mintCharacter(userB, bytes32("NotAlan"), "test_Character_URI");

        // give userA gold
        world.UD__dropGoldToPlayer(userACharacterID, balance);
        world.UD__dropGoldToPlayer(userBCharacterID, balance);
        vm.startPrank(userA);
        world.UD__rollStats(bytes32("Alan"), userACharacterID, Classes.Warrior);
        world.UD__enterGame(userACharacterID, newWeaponId, newArmorId);
        // spawn and move to 0,0
        world.UD__spawn(userACharacterID);
        createShopEncounter(userACharacterID, shopId);
        // have userA set an allowance for their items
        itemsToken.setApprovalForAll(shopSystemAddress, true);
        // have userA set max allowance for their gold
        goldToken.approve(shopSystemAddress, MAX_INT);

        // give userB gold
        vm.startPrank(userB);
        world.UD__rollStats(bytes32("Alan"), userBCharacterID, Classes.Warrior);
        world.UD__enterGame(userBCharacterID, newWeaponId, newArmorId);
        // spawn and move to 0,0
        world.UD__spawn(userBCharacterID);

        // have userB set an allowance for their items
        itemsToken.setApprovalForAll(shopSystemAddress, true);
        // have userB set max allowance for their gold
        goldToken.approve(shopSystemAddress, MAX_INT);

        // have userA buy from the shop for user B
        // uint256 amount, bytes32 shopId, uint256 itemIndex, bytes32 characterId
        vm.expectRevert(Unauthorized.selector);
        world.UD__buy(amount, shopId, itemIndex, userACharacterID);

        endGasReport();
    }

    function test_BuyNotEnough() public {
        startGasReport("purchase an item from the shop without enough stock");
        uint256 balance = 9 ether;
        uint256 amount = 1;
        uint256 itemIndex = 1;
        uint256[] memory buyable = Shops.getBuyableItems(shopId);
        // create userA
        address userA = makeAddr("userA");
        bytes32 userACharacterID = world.UD__mintCharacter(userA, bytes32("Alan"), "test_Character_URI");

        // give userA gold
        world.UD__dropGoldToPlayer(userACharacterID, balance);
        uint256[] memory stock = Shops.getStock(shopId);
        stock[itemIndex] = 0;
        Shops.setStock(shopId, stock);
        vm.startPrank(userA);
        world.UD__rollStats(bytes32("Alan"), userACharacterID, Classes.Warrior);
        world.UD__enterGame(userACharacterID, newWeaponId, newArmorId);
        // spawn and move to 0,0
        world.UD__spawn(userACharacterID);
        createShopEncounter(userACharacterID, shopId);
        // have userA set an allowance for their items
        itemsToken.setApprovalForAll(shopSystemAddress, true);
        // have userA set max allowance for their gold
        goldToken.approve(shopSystemAddress, MAX_INT);
        // set the stock to 0
        // have userA buy from the shop
        // uint256 amount, bytes32 shopId, uint256 itemIndex, bytes32 characterId
        vm.expectRevert(OutOfStock.selector);
        world.UD__buy(amount, shopId, itemIndex, userACharacterID);
        endGasReport();
    }

    function test_BuyWrongPosition() public {
        startGasReport("purchase an item from the shop from the wrong position");
        uint256 balance = 9 ether;
        uint256 amount = 1;
        uint256 itemIndex = 1;
        uint256[] memory buyable = Shops.getBuyableItems(shopId);
        // create userA
        address userA = makeAddr("userA");
        bytes32 userACharacterID = world.UD__mintCharacter(userA, bytes32("Alan"), "test_Character_URI");

        // give userA gold
        world.UD__dropGoldToPlayer(userACharacterID, balance);
        vm.startPrank(userA);
        world.UD__rollStats(bytes32("Alan"), userACharacterID, Classes.Warrior);
        world.UD__enterGame(userACharacterID, newWeaponId, newArmorId);
        world.UD__spawn(userACharacterID);
        world.UD__move(userACharacterID, 0, 1);
        vm.expectRevert(bytes("Invalid World Location"));
        createShopEncounter(userACharacterID, shopId);
        // // have userA set an allowance for their items
        // itemsToken.setApprovalForAll(shopSystemAddress, true);
        // // have userA set max allowance for their gold
        // goldToken.approve(shopSystemAddress, MAX_INT);
        // // have userA buy from the shop
        // // uint256 amount, bytes32 shopId, uint256 itemIndex, bytes32 characterId
        // vm.expectRevert(bytes("Cannot buy from a shop at a distance"));
        // world.UD__buy(amount, shopId, itemIndex, userACharacterID);
        endGasReport();
    }

    function test_Sell() public {
        startGasReport("sell an item to the shop");
        uint256 balance = 9 ether;
        uint256 amount = 1;
        uint256 itemIndex = 5;
        address shops = world.UD__shopSystemAddress();
        // create userA
        address userA = makeAddr("userA");
        bytes32 userACharacterID = world.UD__mintCharacter(userA, bytes32("Alan"), "test_Character_URI");

        // give userA an item
        world.UD__dropItem(userACharacterID, itemIndex, amount);
        world.UD__dropGoldToPlayer(userACharacterID, balance);
        vm.startPrank(userA);
        world.UD__rollStats(bytes32("Alan"), userACharacterID, Classes.Warrior);
        world.UD__enterGame(userACharacterID, newWeaponId, newArmorId);
        // spawn and move to 0,0
        world.UD__spawn(userACharacterID);
        createShopEncounter(userACharacterID, shopId);
        // have userA set an allowance for their items
        itemsToken.setApprovalForAll(shopSystemAddress, true);
        // have userA set max allowance for their gold
        goldToken.approve(shops, MAX_INT);
        // have userA sell to the shop
        // uint256 amount, bytes32 shopId, uint256 itemIndex, bytes32 characterId
        world.UD__sell(amount, shopId, itemIndex, userACharacterID);
        // userA should now have - amount items
        assertEq(
            itemsToken.balanceOf(userA, Shops.getBuyableItems(shopId)[itemIndex]),
            amount - amount,
            "User does not have appropriate items"
        );
        // userA should now have balance + amount * markdown(amount) gold
        assertEq(
            goldToken.balanceOf(userA),
            balance + (amount * world.UD__itemMarkdown(shopId, itemIndex)) + 5 ether,
            "User does not have appropriate gold"
        );
        // shop stock should now be restock + amount items
        assertEq(
            Shops.getStock(shopId)[itemIndex],
            Shops.getRestock(shopId)[itemIndex] + amount,
            "Contract does not have appropriate stock"
        );
        // shop gold should now be - price * markup(amount) gold
        assertEq(
            Shops.getGold(shopId),
            Shops.getMaxGold(shopId) - (amount * world.UD__itemMarkdown(shopId, itemIndex)),
            "Contract does not have appropriate gold"
        );
        endGasReport();
    }

    function test_SellWrongPerson() public {
        startGasReport("sell an item from the shop for another person");
        uint256 balance = 9 ether;
        uint256 amount = 1;
        uint256 itemIndex = 1;
        uint256[] memory sellable = Shops.getSellableItems(shopId);
        // create userA
        address userA = makeAddr("userA");
        bytes32 userACharacterID = world.UD__mintCharacter(userA, bytes32("Alan"), "test_Character_URI");

        // create userB
        address userB = makeAddr("userB");
        bytes32 userBCharacterID = world.UD__mintCharacter(userB, bytes32("NotAlan"), "test_Character_URI");

        // give userA gold and items
        world.UD__dropGoldToPlayer(userACharacterID, balance);
        world.UD__dropItem(userACharacterID, itemIndex, amount);
        // give userB gold and items
        world.UD__dropGoldToPlayer(userBCharacterID, balance);
        world.UD__dropItem(userBCharacterID, itemIndex, amount);
        vm.startPrank(userA);
        world.UD__rollStats(bytes32("Alan"), userACharacterID, Classes.Warrior);
        world.UD__enterGame(userACharacterID, newWeaponId, newArmorId);
        // spawn and move to 0,0
        world.UD__spawn(userACharacterID);
        createShopEncounter(userACharacterID, shopId);

        // have userA set an allowance for their items
        itemsToken.setApprovalForAll(shopSystemAddress, true);
        // have userA set max allowance for their gold
        goldToken.approve(shopSystemAddress, MAX_INT);

        vm.startPrank(userB);
        world.UD__rollStats(bytes32("Alan"), userBCharacterID, Classes.Warrior);
        world.UD__enterGame(userBCharacterID, newWeaponId, newArmorId);
        // spawn and move to 0,0
        world.UD__spawn(userBCharacterID);

        // have userB set an allowance for their items
        itemsToken.setApprovalForAll(shopSystemAddress, true);
        // have userB set max allowance for their gold
        goldToken.approve(shopSystemAddress, MAX_INT);

        // have userA buy from the shop for user B
        // uint256 amount, bytes32 shopId, uint256 itemIndex, bytes32 characterId
        vm.expectRevert(Unauthorized.selector);
        world.UD__sell(amount, shopId, itemIndex, userACharacterID);

        endGasReport();
    }

    function test_SellNotEnough() public {
        startGasReport("sell an item to a shop without enough gold");
        uint256 balance = 9 ether;
        uint256 amount = 1;
        uint256 itemIndex = 1;
        uint256[] memory sellable = Shops.getSellableItems(shopId);
        // create userA
        address userA = makeAddr("userA");
        bytes32 userACharacterID = world.UD__mintCharacter(userA, bytes32("Alan"), "test_Character_URI");

        // give userA gold
        world.UD__dropGoldToPlayer(userACharacterID, balance);
        Shops.setGold(shopId, 0);
        vm.startPrank(userA);
        world.UD__rollStats(bytes32("Alan"), userACharacterID, Classes.Warrior);
        world.UD__enterGame(userACharacterID, newWeaponId, newArmorId);
        // spawn and move to 0,0
        world.UD__spawn(userACharacterID);
        createShopEncounter(userACharacterID, shopId);
        // have userA set an allowance for their items
        itemsToken.setApprovalForAll(shopSystemAddress, true);
        // have userA set max allowance for their gold
        goldToken.approve(shopSystemAddress, MAX_INT);
        // set the stock to 0
        // have userA buy from the shop
        // uint256 amount, bytes32 shopId, uint256 itemIndex, bytes32 characterId
        vm.expectRevert(ShopInsufficientGold.selector);
        world.UD__sell(amount, shopId, itemIndex, userACharacterID);
        endGasReport();
    }

    function test_SellWrongPosition() public {
        startGasReport("sell an item to the shop from a distance");
        uint256 balance = 9 ether;
        uint256 amount = 1;
        uint256 itemIndex = 1;
        address shops = world.UD__shopSystemAddress();
        // create userA
        address userA = makeAddr("userA");
        bytes32 userACharacterID = world.UD__mintCharacter(userA, bytes32("Alan"), "test_Character_URI");

        // give userA an item
        world.UD__dropItem(userACharacterID, itemIndex, amount);
        world.UD__dropGoldToPlayer(userACharacterID, balance);
        vm.startPrank(userA);
        world.UD__rollStats(bytes32("Alan"), userACharacterID, Classes.Warrior);
        world.UD__enterGame(userACharacterID, newWeaponId, newArmorId);
        // move away from 0,0
        world.UD__spawn(userACharacterID);
        world.UD__move(userACharacterID, 0, 1);

        vm.expectRevert(bytes("Invalid World Location"));
        createShopEncounter(userACharacterID, shopId);
        // // have userA set an allowance for their items
        // itemsToken.setApprovalForAll(shopSystemAddress, true);
        // // have userA set max allowance for their gold
        // goldToken.approve(shops, MAX_INT);
        // // have userA sell to the shop

        // // uint256 amount, bytes32 shopId, uint256 itemIndex, bytes32 characterId
        // world.UD__sell(amount, shopId, itemIndex, userACharacterID);
        endGasReport();
    }

    function test_Restock() public {
        // create userA
        uint256 item = 1;
        address userA = makeAddr("userA");
        bytes32 userACharacterID = world.UD__mintCharacter(userA, bytes32("Alan"), "test_Character_URI");
        uint256[] memory stock = Shops.getStock(shopId);
        stock[item] = 0;

        Shops.setStock(shopId, stock);
        assertEq(Shops.getStock(shopId)[item], 0);
        console.log(Shops.getRestockTimestamp(shopId));
        bool result = world.UD__restock(shopId);

        assertEq(result, true);
        // the stock should equal
        assertEq(Shops.getStock(shopId)[item], Shops.getRestock(shopId)[item]);
    }

    function test_RestockTooSoon() public {
        // create userA
        uint256 item = 1;
        address userA = makeAddr("userA");
        bytes32 userACharacterID = world.UD__mintCharacter(userA, bytes32("Alan"), "test_Character_URI");
        uint256[] memory stock = Shops.getStock(shopId);
        stock[item] = 0;

        Shops.setStock(shopId, stock);
        assertEq(Shops.getStock(shopId)[item], 0);
        console.log(Shops.getRestockTimestamp(shopId));
        world.UD__restock(shopId);
        console.log(Shops.getRestockTimestamp(shopId));
        console.log(block.timestamp);
        stock[item] = 0;
        Shops.setStock(shopId, stock);
        world.UD__restock(shopId);
        assertEq(Shops.getStock(shopId)[item], 0);
        // the stock should equal
    }

    function test_sellRevert_InvalidEncounter() public {
        startGasReport("sell an item to the shop");
        uint256 balance = 9 ether;
        uint256 amount = 1;
        uint256 itemIndex = 5;
        address shops = world.UD__shopSystemAddress();
        // create userA
        address userA = makeAddr("userA");
        bytes32 userACharacterID = world.UD__mintCharacter(userA, bytes32("Alan"), "test_Character_URI");

        // give userA an item
        world.UD__dropItem(userACharacterID, itemIndex, amount);
        world.UD__dropGoldToPlayer(userACharacterID, balance);
        vm.startPrank(userA);
        world.UD__rollStats(bytes32("Alan"), userACharacterID, Classes.Warrior);
        world.UD__enterGame(userACharacterID, newWeaponId, newArmorId);
        // spawn and move to 0,0
        world.UD__spawn(userACharacterID);

        // have userA set an allowance for their items
        itemsToken.setApprovalForAll(shopSystemAddress, true);
        // have userA set max allowance for their gold
        goldToken.approve(shops, MAX_INT);
        // have userA sell to the shop
        // uint256 amount, bytes32 shopId, uint256 itemIndex, bytes32 characterId
        vm.expectRevert(InvalidShopEncounter.selector);
        world.UD__sell(amount, shopId, itemIndex, userACharacterID);

        endGasReport();
    }

    function test_multipleCharactersCreatingShopEncounters() public {
        startGasReport("sell an item from the shop for another person");
        uint256 balance = 9 ether;
        uint256 amount = 1;
        uint256 itemIndex = 1;
        uint256[] memory sellable = Shops.getSellableItems(shopId);
        // create userA
        address userA = makeAddr("userA");
        bytes32 userACharacterID = world.UD__mintCharacter(userA, bytes32("Alan"), "test_Character_URI");

        // create userB
        address userB = makeAddr("userB");
        bytes32 userBCharacterID = world.UD__mintCharacter(userB, bytes32("NotAlan"), "test_Character_URI");

        // give userA gold and items
        world.UD__dropGoldToPlayer(userACharacterID, balance);
        world.UD__dropItem(userACharacterID, itemIndex, amount);
        // give userB gold and items
        world.UD__dropGoldToPlayer(userBCharacterID, balance);
        world.UD__dropItem(userBCharacterID, itemIndex, amount);
        vm.startPrank(userA);
        world.UD__rollStats(bytes32("Alan"), userACharacterID, Classes.Warrior);
        world.UD__enterGame(userACharacterID, newWeaponId, newArmorId);
        // spawn and move to 0,0
        world.UD__spawn(userACharacterID);
        bytes32 encounterA = createShopEncounter(userACharacterID, shopId);

        // have userA set an allowance for their items
        itemsToken.setApprovalForAll(shopSystemAddress, true);
        // have userA set max allowance for their gold
        goldToken.approve(shopSystemAddress, MAX_INT);

        vm.startPrank(userB);
        world.UD__rollStats(bytes32("Alan"), userBCharacterID, Classes.Warrior);
        world.UD__enterGame(userBCharacterID, newWeaponId, newArmorId);
        // spawn and move to 0,0
        world.UD__spawn(userBCharacterID);

        // have userB set an allowance for their items
        itemsToken.setApprovalForAll(shopSystemAddress, true);
        // have userB set max allowance for their gold
        goldToken.approve(shopSystemAddress, MAX_INT);
        bytes32 encounterB = createShopEncounter(userBCharacterID, shopId);
        // have userA buy from the shop for user B
        // uint256 amount, bytes32 shopId, uint256 itemIndex, bytes32 characterId

        world.UD__sell(amount, shopId, itemIndex, userBCharacterID);
        // check that you can't exit someone else's shop
        vm.expectRevert();
        world.UD__endShopEncounter(encounterA);

        world.UD__endShopEncounter(encounterB);
        vm.stopPrank();

        vm.prank(userA);
        world.UD__endShopEncounter(encounterA);
        endGasReport();
    }

    // ==================== sellBatch tests ====================

    function _setupSellBatchUser() internal returns (address userA, bytes32 charId) {
        userA = makeAddr("batchSeller");
        charId = world.UD__mintCharacter(userA, bytes32("batchSeller"), "test_uri");
        world.UD__dropGoldToPlayer(charId, 10 ether);
        vm.startPrank(userA);
        world.UD__rollStats(bytes32("batchSeller"), charId, Classes.Warrior);
        world.UD__enterGame(charId, newWeaponId, newArmorId);
        world.UD__spawn(charId);
        itemsToken.setApprovalForAll(shopSystemAddress, true);
        goldToken.approve(shopSystemAddress, MAX_INT);
    }

    function test_sellBatch_happyPath() public {
        uint256 itemA = 5;
        uint256 itemB = 6;
        uint256 amountA = 3;
        uint256 amountB = 2;

        (address userA, bytes32 charId) = _setupSellBatchUser();

        // Drop items as deployer, then switch back to user
        vm.startPrank(deployer);
        world.UD__dropItem(charId, itemA, amountA);
        world.UD__dropItem(charId, itemB, amountB);
        vm.startPrank(userA);

        createShopEncounter(charId, shopId);

        uint256 goldBefore = goldToken.balanceOf(userA);
        uint256 balanceABefore = itemsToken.balanceOf(userA, itemA);
        uint256 balanceBBefore = itemsToken.balanceOf(userA, itemB);

        uint256 expectedGold = (amountA * world.UD__itemMarkdown(shopId, itemA))
            + (amountB * world.UD__itemMarkdown(shopId, itemB));

        uint256[] memory itemIds = new uint256[](2);
        uint256[] memory amounts = new uint256[](2);
        itemIds[0] = itemA;
        itemIds[1] = itemB;
        amounts[0] = amountA;
        amounts[1] = amountB;

        world.UD__sellBatch(itemIds, amounts, shopId, charId);

        assertEq(itemsToken.balanceOf(userA, itemA), balanceABefore - amountA, "itemA balance wrong");
        assertEq(itemsToken.balanceOf(userA, itemB), balanceBBefore - amountB, "itemB balance wrong");
        assertEq(goldToken.balanceOf(userA), goldBefore + expectedGold, "gold received wrong");
    }

    function test_sellBatch_revert_arrayMismatch() public {
        (address userA, bytes32 charId) = _setupSellBatchUser();
        createShopEncounter(charId, shopId);

        uint256[] memory itemIds = new uint256[](2);
        uint256[] memory amounts = new uint256[](1);
        itemIds[0] = 5;
        itemIds[1] = 6;
        amounts[0] = 1;

        vm.expectRevert(ArrayMismatch.selector);
        world.UD__sellBatch(itemIds, amounts, shopId, charId);
    }

    function test_sellBatch_revert_insufficientBalance() public {
        (address userA, bytes32 charId) = _setupSellBatchUser();

        // Drop only 1 of itemA, try to sell 5
        vm.startPrank(deployer);
        world.UD__dropItem(charId, 5, 1);
        vm.startPrank(userA);

        createShopEncounter(charId, shopId);

        uint256[] memory itemIds = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);
        itemIds[0] = 5;
        amounts[0] = 5;

        vm.expectRevert(InsufficientItemBalance.selector);
        world.UD__sellBatch(itemIds, amounts, shopId, charId);
    }

    function test_sellBatch_revert_noEncounter() public {
        (address userA, bytes32 charId) = _setupSellBatchUser();
        // No shop encounter created

        uint256[] memory itemIds = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);
        itemIds[0] = 5;
        amounts[0] = 1;

        vm.expectRevert(InvalidShopEncounter.selector);
        world.UD__sellBatch(itemIds, amounts, shopId, charId);
    }

    function test_sellBatch_skipsZeroAmounts() public {
        uint256 itemA = 5;

        (address userA, bytes32 charId) = _setupSellBatchUser();
        vm.startPrank(deployer);
        world.UD__dropItem(charId, itemA, 2);
        vm.startPrank(userA);

        createShopEncounter(charId, shopId);

        uint256 goldBefore = goldToken.balanceOf(userA);
        uint256 expectedGold = 2 * world.UD__itemMarkdown(shopId, itemA);

        // Second entry has amount=0, should be skipped
        uint256[] memory itemIds = new uint256[](2);
        uint256[] memory amounts = new uint256[](2);
        itemIds[0] = itemA;
        itemIds[1] = 6;
        amounts[0] = 2;
        amounts[1] = 0;

        world.UD__sellBatch(itemIds, amounts, shopId, charId);

        assertEq(goldToken.balanceOf(userA), goldBefore + expectedGold, "should only get gold for non-zero items");
        assertEq(itemsToken.balanceOf(userA, itemA), 0, "itemA should be sold");
    }

    function test_sellBatch_emptyArray() public {
        (address userA, bytes32 charId) = _setupSellBatchUser();
        createShopEncounter(charId, shopId);

        uint256 goldBefore = goldToken.balanceOf(userA);

        uint256[] memory itemIds = new uint256[](0);
        uint256[] memory amounts = new uint256[](0);

        // Should succeed as a no-op, no gold minted
        world.UD__sellBatch(itemIds, amounts, shopId, charId);
        assertEq(goldToken.balanceOf(userA), goldBefore, "no gold should be minted for empty batch");
    }

    function test_sellBatch_revert_unauthorized() public {
        address userA = makeAddr("batchOwner");
        address userB = makeAddr("batchThief");
        bytes32 charA = world.UD__mintCharacter(userA, bytes32("batchOwner"), "test_uri");
        world.UD__mintCharacter(userB, bytes32("batchThief"), "test_uri_b");
        world.UD__dropGoldToPlayer(charA, 10 ether);
        world.UD__dropItem(charA, 5, 1);

        vm.startPrank(userA);
        world.UD__rollStats(bytes32("batchOwner"), charA, Classes.Warrior);
        world.UD__enterGame(charA, newWeaponId, newArmorId);
        world.UD__spawn(charA);
        itemsToken.setApprovalForAll(shopSystemAddress, true);
        createShopEncounter(charA, shopId);
        vm.stopPrank();

        // userB tries to sell userA's items
        vm.startPrank(userB);
        uint256[] memory itemIds = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);
        itemIds[0] = 5;
        amounts[0] = 1;

        vm.expectRevert(Unauthorized.selector);
        world.UD__sellBatch(itemIds, amounts, shopId, charA);
    }

    function test_sellBatch_revert_batchTooLarge() public {
        (address userA, bytes32 charId) = _setupSellBatchUser();
        createShopEncounter(charId, shopId);

        // 51 items should exceed the 50-item cap
        uint256[] memory itemIds = new uint256[](51);
        uint256[] memory amounts = new uint256[](51);
        for (uint256 i; i < 51; i++) {
            itemIds[i] = 5;
            amounts[i] = 0;
        }

        vm.expectRevert(ArrayMismatch.selector);
        world.UD__sellBatch(itemIds, amounts, shopId, charId);
    }
}
