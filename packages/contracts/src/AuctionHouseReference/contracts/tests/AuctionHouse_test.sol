// SPDX-License-Identifier: GPL-3.0
        
pragma solidity >=0.4.22 <0.9.0;

// This import is automatically injected by Remix
import "remix_tests.sol"; 
import "remix_accounts.sol";

// This import is required to use custom transaction context
// Although it may fail compilation in 'Solidity Compiler' plugin
// But it will work fine in 'Solidity Unit Testing' plugin
import "../AuctionHouse.sol";
import "tests/MockGold.sol";
import "tests/MockItems.sol";
import "tests/MockCharacter.sol";


// File name has to end with '_test.sol', this file can contain more than one testSuite contracts
contract testSuite {
    address acc0; //owner by default
    address acc1;
    AuctionHouse house;
    MockGold gold;
    MockCharacter character;
    MockItems items;
    /// 'beforeAll' runs before all other tests
    /// More special functions are: 'beforeEach', 'beforeAll', 'afterEach' & 'afterAll'
    function beforeEach() public {
        acc0 = TestsAccounts.getAccount(0);
        acc1 = TestsAccounts.getAccount(1);
        //address acc2 = TestsAccounts.getAccount(2);
        //address acc3 = TestsAccounts.getAccount(3);
        // <instantiate contract>
        items = new MockItems();
        gold = new MockGold();
        character = new MockCharacter();
        house = new AuctionHouse(address(gold));
    }

    // setCollection Tests
    function testSetSingleCollection() public {
        address[] memory collections = new address[](1);
        bool[] memory statuses = new bool[](1);

        address collectionAddress1 = address(0x1); 
        collections[0] = collectionAddress1;
        statuses[0] = true;

        house.setCollections(collections, statuses);

        Assert.equal(house.collections(collectionAddress1), true, "Collection status should be true");
    }

    // Test case: Toggle statuses for multiple collections
    function testSetMultipleCollections() public {
        address[] memory collections = new address[](3);
        bool[] memory statuses = new bool[](3);

        address collectionAddress1 = address(0x1); // Replace with actual addresses
        address collectionAddress2 = address(0x2);
        address collectionAddress3 = address(0x3);

        collections[0] = collectionAddress1;
        collections[1] = collectionAddress2;
        collections[2] = collectionAddress3;

        statuses[0] = true;
        statuses[1] = false;
        statuses[2] = true;

        house.setCollections(collections, statuses);

        Assert.equal(house.collections(collectionAddress1), true, "Collection 1 status should be true");
        Assert.equal(house.collections(collectionAddress2), false, "Collection 2 status should be false");
        Assert.equal(house.collections(collectionAddress3), true, "Collection 3 status should be true");
    }

    // Test case: Provide arrays of different lengths
    function testMismatchedArraysLength() public {
        address[] memory collections = new address[](2);
        bool[] memory statuses = new bool[](1);

        address collectionAddress1 = address(0x1); // Replace with actual addresses
        address collectionAddress2 = address(0x2);

        collections[0] = collectionAddress1;
        collections[1] = collectionAddress2;

        statuses[0] = true;

        // Expecting a revert with "Mismatch array length"
        (bool success, ) = address(house).call(abi.encodeWithSignature("setCollections(address[],bool[])", collections, statuses));
        Assert.ok(!success, "Function call should revert");
    }
    function testIncorrectOwner() public {
        address[] memory collections = new address[](1);
        bool[] memory statuses = new bool[](1);

        address collectionAddress1 = address(0x1); // Replace with actual addresses
        collections[0] = collectionAddress1;
        statuses[0] = true;

        // Simulate owner calling the function
        house.setCollections(collections, statuses);
        Assert.equal(house.collections(collectionAddress1), true, "Collection status should be true");

        // Simulate non-owner calling the function
        house.setOwner(acc1);
        (bool success, ) = address(house).call(abi.encodeWithSignature("setCollections(address[],bool[])", collections, statuses));
        Assert.ok(!success, "Non-owner should not be able to call setCollections");
    }


    // Test case: Revert when placing order for non-allowed collection
    function testPlaceOrderNotAllowedCollection() public {
        //address collection = address(gold); // Replace with another collection address
        uint256 id = 1;
        uint128 quantity = 1;
        uint256 price = 100; // Price in wei
        
        // Ensure collection is not allowed
        address[] memory collections = new address[](1);
        bool[] memory statuses = new bool[](1);
        // Approve ERC20 transfer from buyer to contract
        character.approve(address(house), id);
        gold.approve(address(house), price);

        address collectionAddress1 = address(character); // Replace with actual addresses
        statuses[0] = false;
        collections[0] = collectionAddress1;
        house.setCollections(collections, statuses);
        // Attempt to place order
        (bool success, ) = address(house).call(abi.encodeWithSignature("placeOrder(address,uint256,uint128,uint256)", address(character), id, quantity, price));
        // Assert transaction reverts
        Assert.ok(!success, "Order placement should revert for non-allowed collection");
    }
    

    // Test case: Revert when placing order for non-allowed collection
    function testPlaceOrderAllowedCollection() public {
        //address collection = address(gold); // Replace with another collection address
        uint256 id = 1;
        uint128 quantity = 1;
        uint128 price = 100; // Price in wei
        
        // Ensure collection is not allowed
        address[] memory collections = new address[](1);
        bool[] memory statuses = new bool[](1);
        // Approve ERC20 transfer from buyer to contract
        gold.approve(address(house), price);

        statuses[0] = true;
        collections[0] = address(character);
        house.setCollections(collections, statuses);
        // Attempt to place order
        Order memory order = house.placeOrder(address(character), id, quantity, price);
        Assert.ok(order.priceInWeiEach == price/quantity, "Order should be placed for allowed collection");
    }

    // Test case: Revert when placing order with zero quantity
    function testPlaceOrderZeroQuantity() public {
        uint256 id = 1;
        uint128 quantity = 0;
        uint256 price = 100; // Price in wei
        
        // Ensure collection is not allowed
        address[] memory collections = new address[](1);
        bool[] memory statuses = new bool[](1);
        // Approve ERC20 transfer from buyer to contract
        character.approve(address(house), id);
        gold.approve(address(house), price);

        address collectionAddress1 = address(character); // Replace with actual addresses
        statuses[0] = true;
        collections[0] = collectionAddress1;
        house.setCollections(collections, statuses);
        // Attempt to place order
        (bool success, ) = address(house).call(abi.encodeWithSignature("placeOrder(address,uint256,uint128,uint256)", address(character), id, quantity, price));
        // Assert transaction reverts
        Assert.ok(!success, "Order placement should revert for zero quantity");
    }

    // Test case: Revert when placing order with price per item as zero
    function testPlaceOrderZeroPricePerItem() public {
        uint256 id = 1;
        uint128 quantity = 1;
        uint256 price = 0; // Price in wei
        
        // Ensure collection is not allowed
        address[] memory collections = new address[](1);
        bool[] memory statuses = new bool[](1);
        // Approve ERC20 transfer from buyer to contract
        character.approve(address(house), id);
        gold.approve(address(house), price);

        address collectionAddress1 = address(character); // Replace with actual addresses
        statuses[0] = true;
        collections[0] = collectionAddress1;
        house.setCollections(collections, statuses);
        // Attempt to place order
        (bool success, ) = address(house).call(abi.encodeWithSignature("placeOrder(address,uint256,uint128,uint256)", address(character), id, quantity, price));
        // Assert transaction reverts
        Assert.ok(!success, "Order placement should revert for zero quantity");
    }

    // Test case: Revert when user does not have enough money
    function testRevertNotEnoughMoney() public {
        uint256 id = 1;
        uint128 quantity = 1;
        uint256 price = 100; // Price in wei
        
        // Ensure collection is not allowed
        address[] memory collections = new address[](1);
        bool[] memory statuses = new bool[](1);
        // Approve ERC20 transfer from buyer to contract
        character.approve(address(house), id);
        //gold.approve(address(house), price);

        address collectionAddress1 = address(character); // Replace with actual addresses
        statuses[0] = true;
        collections[0] = collectionAddress1;
        house.setCollections(collections, statuses);
        // Attempt to place order
        (bool success, ) = address(house).call(abi.encodeWithSignature("placeOrder(address,uint256,uint128,uint256)", address(character), id, quantity, price));
        // Assert transaction reverts
        Assert.ok(!success, "Not enough gold or gold was not approved");
    }

    // Test case: Revert when user already has an order for this item
    function testRevertOrderAlreadyExists() public {
        uint256 id = 1;
        uint128 quantity = 1;
        uint256 price = 100; // Price in wei
        
        // Ensure collection is not allowed
        address[] memory collections = new address[](1);
        bool[] memory statuses = new bool[](1);
        // Approve ERC20 transfer from buyer to contract
        //character.approve(address(house), id);
        gold.approve(address(house), price);

        address collectionAddress1 = address(character); // Replace with actual addresses
        statuses[0] = true;
        collections[0] = collectionAddress1;
        house.setCollections(collections, statuses);
        // Attempt to place order
        address(house).call(abi.encodeWithSignature("placeOrder(address,uint256,uint128,uint256)", address(character), id, quantity, price));
        (bool success, ) = address(house).call(abi.encodeWithSignature("placeOrder(address,uint256,uint128,uint256)", address(character), id, quantity, price));
        // Assert transaction reverts
        Assert.ok(!success, "already have an order");
    }
    /*function testFulfillOrderERC721() public {
        uint256 id = 1;
        uint128 quantity = 1;
        uint128 price = 100; // Price in wei
        
        // Ensure collection is not allowed
        address[] memory collections = new address[](1);
        bool[] memory statuses = new bool[](1);

        //Approve ERC721 token
        character.approve(address(house), id);
        gold.approve(address(house), price);

        statuses[0] = true;
        collections[0] = address(character);
        house.setCollections(collections, statuses);

        // Place the order
        Order memory order = house.placeOrder(address(character), id, quantity, price);
        //Fill the order
        address buyer = order.buyer;
        uint128 priceInWeiEach = order.priceInWeiEach;
        house.fulfillOrder(address(character), id, buyer, priceInWeiEach);

        // Assert that the amount received matches the expected price
        //Assert.equal(receivedAmount, order.priceInWeiEach, "Incorrect amount received after fulfilling order");
    }*/
    
}
    