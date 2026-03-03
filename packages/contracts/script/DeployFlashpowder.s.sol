// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";

import {IWorld} from "@world/IWorld.sol";
import {
    Counters,
    Effects,
    Items,
    ItemsData,
    UltimateDominionConfig,
    StatusEffectStats,
    StatusEffectStatsData,
    StatusEffectTargeting,
    StatusEffectValidity,
    StatusEffectValidityData,
    ConsumableStats,
    ConsumableStatsData,
    StatRestrictions,
    StatRestrictionsData
} from "@codegen/index.sol";
import {EffectType, ItemType, ResistanceStat} from "@codegen/common.sol";
import {TotalSupply} from "@erc1155/tables/TotalSupply.sol";
import {Owners} from "@erc1155/tables/Owners.sol";
import {ERC1155URIStorage} from "@erc1155/tables/ERC1155URIStorage.sol";
import {_erc1155URIStorageTableId, _totalSupplyTableId, _ownersTableId} from "@erc1155/utils.sol";
import {_lootManagerSystemId} from "../src/utils.sol";
import {ITEMS_NAMESPACE, WORLD_NAMESPACE} from "../constants.sol";

/**
 * @title DeployFlashpowder
 * @notice Loads smoke_cloak effect + Flashpowder consumable via direct table writes
 *
 * Usage:
 *   source .env.testnet && PRIVATE_KEY=$PRIVATE_KEY forge script DeployFlashpowder \
 *     --broadcast --sig "run(address)" $WORLD_ADDRESS --slow
 */
contract DeployFlashpowder is Script {
    function run(address _worldAddress) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        StoreSwitch.setStoreAddress(_worldAddress);

        // ── 1. Create smoke_cloak status effect ──
        bytes32 effectId = bytes32(bytes8(keccak256(abi.encode("smoke_cloak"))));
        console.log("smoke_cloak effectId:");
        console.logBytes32(effectId);

        if (Effects.getEffectExists(effectId)) {
            console.log("smoke_cloak effect already exists, skipping");
        } else {
            StatusEffectStats.set(effectId, StatusEffectStatsData({
                agiModifier: 0,
                armorModifier: 0,
                damagePerTick: 0,
                hpModifier: 0,
                intModifier: 0,
                resistanceStat: ResistanceStat.None,
                strModifier: 0
            }));
            StatusEffectValidity.set(effectId, StatusEffectValidityData({
                cooldown: 0,
                maxStacks: 1,
                validTime: 0,
                validTurns: 2
            }));
            StatusEffectTargeting.set(effectId, true);
            Effects.set(effectId, EffectType.StatusEffect, true);
            console.log("smoke_cloak effect created");
        }

        // ── 2. Create Flashpowder consumable (direct table writes) ──
        // NOTE: grantAccess for tb:Items:{Owners,TotalSupply,URIStorage} was done via cast send beforehand
        address itemsContract = UltimateDominionConfig.getItems();
        uint256 itemId = Counters.getCounter(itemsContract, 0) + 1;
        Counters.setCounter(itemsContract, 0, itemId);
        console.log("Flashpowder item ID:", itemId);

        // ConsumableStats
        bytes32[] memory effects = new bytes32[](1);
        effects[0] = bytes32(bytes8(keccak256(abi.encode("smoke_cloak"))));
        ConsumableStats.set(itemId, ConsumableStatsData({
            minDamage: 0,
            maxDamage: 0,
            minLevel: 3,
            effects: effects
        }));

        // StatRestrictions
        StatRestrictions.set(itemId, StatRestrictionsData({
            minAgility: 0,
            minIntelligence: 0,
            minStrength: 0
        }));

        // Items table entry
        bytes memory encodedStats = abi.encode(
            ConsumableStatsData({ minDamage: 0, maxDamage: 0, minLevel: 3, effects: effects }),
            StatRestrictionsData({ minAgility: 0, minIntelligence: 0, minStrength: 0 })
        );
        Items.set(itemId, ItemsData({
            itemType: ItemType.Consumable,
            dropChance: 2,
            price: 50 ether,
            rarity: 2,
            stats: encodedStats
        }));

        // Mint supply to LootManager
        address lootManager = Systems.getSystem(_lootManagerSystemId(WORLD_NAMESPACE));
        uint256 supply = 10 ether;
        Owners.setBalance(_ownersTableId(ITEMS_NAMESPACE), lootManager, itemId, supply);
        TotalSupply.setTotalSupply(_totalSupplyTableId(ITEMS_NAMESPACE), itemId, supply);

        // Token URI
        ERC1155URIStorage.setUri(_erc1155URIStorageTableId(ITEMS_NAMESPACE), itemId, "consumable:flashpowder");

        console.log("Flashpowder created");

        vm.stopBroadcast();
        console.log("=== DeployFlashpowder Complete ===");
    }
}
