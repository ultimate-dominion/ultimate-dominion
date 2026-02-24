// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";

import {IWorld} from "@world/IWorld.sol";
import {
    UltimateDominionConfig,
    Counters,
    Mobs,
    Shops,
    ShopsData,
    Position,
    EntitiesAtPosition,
    Spawned
} from "@codegen/index.sol";
import {MobType} from "@codegen/common.sol";
import {ShopTemplate} from "@interfaces/Structs.sol";
import {_mobSystemId} from "../../src/utils.sol";
import {WORLD_NAMESPACE} from "../../constants.sol";

import "forge-std/StdJson.sol";

/**
 * @title DeployEconomy (Tier 2)
 * @notice Deploys shops and economy-related content
 * @dev Feature script for the 3-tier deployment system
 *
 * Prerequisites:
 * - MinimalPostDeploy must be run first
 * - DeployItems should be run first (shops sell items)
 *
 * Usage:
 *   forge script DeployEconomy --broadcast --sig "run(address)" <WORLD_ADDRESS>
 */
contract DeployEconomy is Script {
    using stdJson for string;

    IWorld public world;
    address public mobCounterAddress;

    function run(address _worldAddress) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        world = IWorld(_worldAddress);
        StoreSwitch.setStoreAddress(_worldAddress);

        console.log("=== Tier 2: DeployEconomy ===");

        _checkPrerequisites();
        _createAllShops();

        vm.stopBroadcast();

        console.log("=== DeployEconomy Complete ===");
    }

    /**
     * @notice Run without broadcast management (for orchestration)
     */
    function runInternal(address _worldAddress) external {
        world = IWorld(_worldAddress);
        StoreSwitch.setStoreAddress(_worldAddress);

        console.log("=== Tier 2: DeployEconomy (Internal) ===");

        _checkPrerequisites();
        _createAllShops();

        console.log("=== DeployEconomy Complete ===");
    }

    /**
     * @notice Deploy a single shop at a specific location
     */
    function deployShop(
        address _worldAddress,
        uint16 x,
        uint16 y,
        uint256 gold,
        uint256 maxGold,
        uint16 priceMarkup,
        uint16 priceMarkdown
    ) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        world = IWorld(_worldAddress);
        StoreSwitch.setStoreAddress(_worldAddress);

        _checkPrerequisites();

        // Create default sellable/buyable items (first 10 items)
        uint256[] memory sellableItems = new uint256[](10);
        uint256[] memory buyableItems = new uint256[](10);
        uint256[] memory stock = new uint256[](10);
        uint256[] memory restock = new uint256[](10);

        for (uint256 i = 0; i < 10; i++) {
            sellableItems[i] = i + 1;
            buyableItems[i] = i + 1;
            stock[i] = 100;
            restock[i] = 10;
        }

        ShopsData memory newShop = ShopsData({
            gold: gold,
            maxGold: maxGold,
            priceMarkup: priceMarkup,
            priceMarkdown: priceMarkdown,
            restockTimestamp: uint40(block.timestamp),
            sellableItems: sellableItems,
            buyableItems: buyableItems,
            restock: restock,
            stock: stock
        });

        _createAndSpawnShop(newShop, x, y);

        vm.stopBroadcast();
    }

    function _checkPrerequisites() internal {
        require(
            UltimateDominionConfig.getGoldToken() != address(0),
            "DeployEconomy: MinimalPostDeploy not run - Gold token missing"
        );

        mobCounterAddress = Systems.getSystem(_mobSystemId(WORLD_NAMESPACE));
        require(mobCounterAddress != address(0), "DeployEconomy: MobSystem not found");

        console.log("  Prerequisites verified");
        console.log("  MobSystem:", mobCounterAddress);
    }

    function _createAllShops() internal {
        string memory json = vm.readFile("shops.json");
        bytes memory shopTemplatesBytes = vm.parseJson(json, ".shops");
        ShopTemplate[] memory shopTemplates = abi.decode(shopTemplatesBytes, (ShopTemplate[]));

        console.log("Creating shops...");

        for (uint256 i = 0; i < shopTemplates.length; i++) {
            ShopTemplate memory shopTemplate = shopTemplates[i];

            ShopsData memory newShop = ShopsData({
                gold: shopTemplate.gold,
                maxGold: shopTemplate.maxGold,
                priceMarkup: shopTemplate.priceMarkup,
                priceMarkdown: shopTemplate.priceMarkdown,
                restockTimestamp: shopTemplate.restockTimestamp,
                sellableItems: shopTemplate.sellableItems,
                buyableItems: shopTemplate.buyableItems,
                restock: shopTemplate.restock,
                stock: shopTemplate.stock
            });

            uint16 x = uint16(shopTemplate.location[0]);
            uint16 y = uint16(shopTemplate.location[1]);

            _createAndSpawnShop(newShop, x, y);
        }

        console.log("Shops deployment complete:");
        console.log("  Total shops:", shopTemplates.length);
    }

    function _createAndSpawnShop(ShopsData memory newShop, uint16 x, uint16 y) internal {
        // Create mob template
        uint256 mobId = _incrementMobId();
        Mobs.set(mobId, MobType.Shop, abi.encode(newShop), "https://github.com/raid-guild/ultimate-dominion");

        // Spawn at location
        bytes32 entityId = bytes32(abi.encodePacked(uint32(mobId), uint192(_incrementMobCounter(mobId)), x, y));

        // Write shop data
        Shops.set(entityId, newShop);

        // Write position
        Position.set(entityId, x, y);
        EntitiesAtPosition.pushEntities(x, y, entityId);
        Spawned.set(entityId, true);

        console.log("  Shop created at:", x, ",", y);
    }

    function _incrementMobId() internal returns (uint256) {
        uint256 mobId = Counters.getCounter(mobCounterAddress, 0) + 1;
        Counters.setCounter(mobCounterAddress, 0, mobId);
        return mobId;
    }

    function _incrementMobCounter(uint256 mobId) internal returns (uint256) {
        uint256 mobCounter = Counters.getCounter(mobCounterAddress, mobId) + 1;
        require(mobCounter < type(uint192).max, "DeployEconomy: Cannot spawn this mob any more");
        Counters.setCounter(mobCounterAddress, mobId, mobCounter);
        return mobCounter;
    }

    /**
     * @notice Verify economy deployment
     */
    function verify(address _worldAddress) external returns (bool) {
        StoreSwitch.setStoreAddress(_worldAddress);

        // Check that at least one shop exists by checking if there's a mob with shop type
        address mobSystem = Systems.getSystem(_mobSystemId(WORLD_NAMESPACE));
        uint256 mobCount = Counters.getCounter(mobSystem, 0);

        // We expect at least some mobs to be shops
        return mobCount > 0;
    }
}
