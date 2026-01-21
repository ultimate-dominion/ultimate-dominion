// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";

import {IWorld} from "@world/IWorld.sol";
import {UltimateDominionConfig, Counters} from "@codegen/index.sol";
import {
    Items,
    ItemsData,
    WeaponStats,
    WeaponStatsData,
    ArmorStats,
    ArmorStatsData,
    ConsumableStats,
    ConsumableStatsData,
    StatRestrictions,
    StarterItems as StarterItemsTable
} from "@codegen/index.sol";
import {Classes, ItemType} from "@codegen/common.sol";
import {
    StarterItems,
    WeaponTemplateDetails,
    ArmorTemplateDetails,
    ConsumableTemplateDetails
} from "@interfaces/Structs.sol";

import {Owners} from "@erc1155/tables/Owners.sol";
import {TotalSupply} from "@erc1155/tables/TotalSupply.sol";
import {ERC1155URIStorage} from "@erc1155/tables/ERC1155URIStorage.sol";
import {_ownersTableId, _totalSupplyTableId, _erc1155URIStorageTableId} from "@erc1155/utils.sol";
import {_lootManagerSystemId} from "../../src/utils.sol";

import {ITEMS_NAMESPACE, WORLD_NAMESPACE} from "../../constants.sol";

import "forge-std/StdJson.sol";

/**
 * @title DeployItems (Tier 2)
 * @notice Deploys all game items (armor, weapons, consumables) and starter items
 * @dev Feature script for the 3-tier deployment system
 *
 * Prerequisites:
 * - MinimalPostDeploy must be run first
 * - DeployEffects should be run first (items reference effects)
 *
 * Usage:
 *   forge script DeployItems --broadcast --sig "run(address)" <WORLD_ADDRESS>
 */
contract DeployItems is Script {
    using stdJson for string;

    IWorld public world;
    address public lootManagerAddress;
    address public itemsCounterAddress;

    function run(address _worldAddress) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        world = IWorld(_worldAddress);
        StoreSwitch.setStoreAddress(_worldAddress);

        console.log("=== Tier 2: DeployItems ===");

        _checkPrerequisites();
        _createAllItems();

        vm.stopBroadcast();

        console.log("=== DeployItems Complete ===");
    }

    /**
     * @notice Run without broadcast management (for orchestration)
     */
    function runInternal(address _worldAddress) external {
        world = IWorld(_worldAddress);
        StoreSwitch.setStoreAddress(_worldAddress);

        console.log("=== Tier 2: DeployItems (Internal) ===");

        _checkPrerequisites();
        _createAllItems();

        console.log("=== DeployItems Complete ===");
    }

    function _checkPrerequisites() internal {
        require(
            UltimateDominionConfig.getItems() != address(0),
            "DeployItems: MinimalPostDeploy not run - Items token missing"
        );

        lootManagerAddress = Systems.getSystem(_lootManagerSystemId(WORLD_NAMESPACE));
        require(lootManagerAddress != address(0), "DeployItems: LootManager not found");

        itemsCounterAddress = UltimateDominionConfig.getItems();

        console.log("  Prerequisites verified");
        console.log("  LootManager:", lootManagerAddress);
        console.log("  Items contract:", itemsCounterAddress);
    }

    function _createAllItems() internal {
        string memory json = vm.readFile("items.json");
        bytes memory data = vm.parseJson(json);

        StarterItems memory itemsData = abi.decode(data, (StarterItems));

        uint256[] memory warriorItemIds = new uint256[](2);
        uint256[] memory rogueItemIds = new uint256[](2);
        uint256[] memory mageItemIds = new uint256[](1);

        // Create armor
        console.log("Creating armor...");
        for (uint256 i = 0; i < itemsData.armor.length; i++) {
            uint256 itemId = _createArmor(itemsData.armor[i]);

            if (i == 0) {
                warriorItemIds[0] = itemId;
            }
        }

        // Create weapons
        console.log("Creating weapons...");
        for (uint256 i = 0; i < itemsData.weapons.length; i++) {
            uint256 itemId = _createWeapon(itemsData.weapons[i]);

            if (i == 0) {
                warriorItemIds[1] = itemId;
                rogueItemIds[0] = itemId;
                mageItemIds[0] = itemId;
            }
            if (i == 5) {
                rogueItemIds[1] = itemId;
            }
        }

        // Create consumables
        console.log("Creating consumables...");
        for (uint256 i = 0; i < itemsData.consumables.length; i++) {
            _createConsumable(itemsData.consumables[i]);
        }

        // Set starter items
        _setStarterItems(warriorItemIds, rogueItemIds, mageItemIds);

        console.log("Items deployment complete:");
        console.log("  Armor:", itemsData.armor.length);
        console.log("  Weapons:", itemsData.weapons.length);
        console.log("  Consumables:", itemsData.consumables.length);
    }

    function _createArmor(ArmorTemplateDetails memory armorTemplate) internal returns (uint256 itemId) {
        itemId = _incrementItemsCounter();

        ArmorStatsData memory newArmor = ArmorStatsData({
            agiModifier: armorTemplate.stats.agiModifier,
            armorModifier: armorTemplate.stats.armorModifier,
            hpModifier: armorTemplate.stats.hpModifier,
            intModifier: armorTemplate.stats.intModifier,
            minLevel: armorTemplate.stats.minLevel,
            strModifier: armorTemplate.stats.strModifier,
            armorType: armorTemplate.stats.armorType
        });

        ArmorStats.set(itemId, newArmor);
        StatRestrictions.set(itemId, armorTemplate.statRestrictions);

        ItemsData memory newItem = ItemsData({
            itemType: ItemType.Armor,
            dropChance: armorTemplate.dropChance,
            price: armorTemplate.price,
            stats: abi.encode(newArmor, armorTemplate.statRestrictions)
        });
        Items.set(itemId, newItem);

        _mintItem(itemId, armorTemplate.initialSupply);
        _setTokenUri(itemId, armorTemplate.metadataUri);

        console.log("  Armor created:", armorTemplate.name, "id:", itemId);
    }

    function _createWeapon(WeaponTemplateDetails memory weaponTemplate) internal returns (uint256 itemId) {
        itemId = _incrementItemsCounter();

        WeaponStatsData memory newWeapon = WeaponStatsData({
            agiModifier: weaponTemplate.stats.agiModifier,
            effects: weaponTemplate.stats.effects,
            hpModifier: weaponTemplate.stats.hpModifier,
            intModifier: weaponTemplate.stats.intModifier,
            maxDamage: weaponTemplate.stats.maxDamage,
            minDamage: weaponTemplate.stats.minDamage,
            minLevel: weaponTemplate.stats.minLevel,
            strModifier: weaponTemplate.stats.strModifier
        });

        WeaponStats.set(itemId, newWeapon);
        StatRestrictions.set(itemId, weaponTemplate.statRestrictions);

        ItemsData memory newItem = ItemsData({
            itemType: ItemType.Weapon,
            dropChance: weaponTemplate.dropChance,
            price: weaponTemplate.price,
            stats: abi.encode(newWeapon, weaponTemplate.statRestrictions)
        });
        Items.set(itemId, newItem);

        _mintItem(itemId, weaponTemplate.initialSupply);
        _setTokenUri(itemId, weaponTemplate.metadataUri);

        console.log("  Weapon created:", weaponTemplate.name, "id:", itemId);
    }

    function _createConsumable(ConsumableTemplateDetails memory consumableTemplate) internal returns (uint256 itemId) {
        itemId = _incrementItemsCounter();

        ConsumableStatsData memory newConsumable = ConsumableStatsData({
            effects: consumableTemplate.stats.effects,
            maxDamage: consumableTemplate.stats.maxDamage,
            minDamage: consumableTemplate.stats.minDamage,
            minLevel: consumableTemplate.stats.minLevel
        });

        ConsumableStats.set(itemId, newConsumable);
        StatRestrictions.set(itemId, consumableTemplate.statRestrictions);

        ItemsData memory newItem = ItemsData({
            itemType: ItemType.Consumable,
            dropChance: consumableTemplate.dropChance,
            price: consumableTemplate.price,
            stats: abi.encode(newConsumable, consumableTemplate.statRestrictions)
        });
        Items.set(itemId, newItem);

        _mintItem(itemId, consumableTemplate.initialSupply);
        _setTokenUri(itemId, consumableTemplate.metadataUri);

        console.log("  Consumable created:", consumableTemplate.name, "id:", itemId);
    }

    function _setStarterItems(
        uint256[] memory warriorItemIds,
        uint256[] memory rogueItemIds,
        uint256[] memory mageItemIds
    ) internal {
        console.log("Setting starter items...");

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 1;
        amounts[1] = 1;

        StarterItemsTable.set(Classes.Warrior, warriorItemIds, amounts);
        console.log("  Warrior starter items set");

        StarterItemsTable.set(Classes.Rogue, rogueItemIds, amounts);
        console.log("  Rogue starter items set");

        uint256[] memory mageAmounts = new uint256[](1);
        mageAmounts[0] = 1;
        StarterItemsTable.set(Classes.Mage, mageItemIds, mageAmounts);
        console.log("  Mage starter items set");
    }

    // ============ Helper functions ============

    function _incrementItemsCounter() internal returns (uint256) {
        uint256 itemId = Counters.getCounter(itemsCounterAddress, 0) + 1;
        Counters.setCounter(itemsCounterAddress, 0, itemId);
        return itemId;
    }

    function _mintItem(uint256 itemId, uint256 supply) internal {
        ResourceId ownersTableId = _ownersTableId(ITEMS_NAMESPACE);
        ResourceId totalSupplyTableId = _totalSupplyTableId(ITEMS_NAMESPACE);

        Owners.setBalance(ownersTableId, lootManagerAddress, itemId, supply);
        TotalSupply.set(totalSupplyTableId, itemId, supply, supply);
    }

    function _setTokenUri(uint256 itemId, string memory uri) internal {
        ResourceId uriStorageTableId = _erc1155URIStorageTableId(ITEMS_NAMESPACE);
        ERC1155URIStorage.setUri(uriStorageTableId, itemId, uri);
    }

    /**
     * @notice Verify items deployment
     */
    function verify(address _worldAddress) external returns (bool) {
        StoreSwitch.setStoreAddress(_worldAddress);

        // Check that items exist
        address itemsContract = UltimateDominionConfig.getItems();
        uint256 itemCount = Counters.getCounter(itemsContract, 0);
        return itemCount > 0;
    }
}
