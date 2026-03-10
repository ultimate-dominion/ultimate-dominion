// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {
    Characters,
    CharactersData,
    CharacterEquipment,
    Stats,
    StatsData,
    StarterItemPool,
    StarterConsumables,
    ArmorStats,
    StatRestrictions,
    StatRestrictionsData,
    Items
} from "@codegen/index.sol";
import {ArmorType, ItemType} from "@codegen/common.sol";
import {Owners as ERC721Owners} from "@latticexyz/world-modules/src/modules/erc721-puppet/tables/Owners.sol";
import {WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_TABLE} from "@latticexyz/store/src/storeResourceTypes.sol";
import {CHARACTERS_NAMESPACE, GOLD_NAMESPACE, ITEMS_NAMESPACE} from "../../../constants.sol";
import {
    Unauthorized,
    InvalidAccount,
    CharacterLocked,
    InvalidStarterItem,
    InvalidItemType,
    InsufficientStat,
    InvalidArmorType
} from "../../Errors.sol";
import {Balances} from "@latticexyz/world-modules/src/modules/tokens/tables/Balances.sol";
import {TotalSupply} from "@latticexyz/world-modules/src/modules/erc20-puppet/tables/TotalSupply.sol";
import {_totalSupplyTableId as _goldTotalSupplyTableId} from "@latticexyz/world-modules/src/modules/erc20-puppet/utils.sol";
import {Owners} from "@erc1155/tables/Owners.sol";
import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {PauseLib} from "../../libraries/PauseLib.sol";

/**
 * @title CharacterEnterSystem
 * @notice Handles the enterGame flow for new characters
 * @dev Split from CharacterCore to reduce contract size
 */
contract CharacterEnterSystem is System {
    function _charsOwnersTableId() internal pure returns (ResourceId) {
        return WorldResourceIdLib.encode(RESOURCE_TABLE, CHARACTERS_NAMESPACE, "Owners");
    }

    function _goldBalancesTableId() internal pure returns (ResourceId) {
        return WorldResourceIdLib.encode(RESOURCE_TABLE, GOLD_NAMESPACE, "Balances");
    }

    function _itemsOwnersTableId() internal pure returns (ResourceId) {
        return WorldResourceIdLib.encode(RESOURCE_TABLE, ITEMS_NAMESPACE, "Owners");
    }

    function _mintItem(ResourceId tableId, address player, uint256 itemId, uint256 amount) internal {
        uint256 bal = Owners.getBalance(tableId, player, itemId);
        Owners.setBalance(tableId, player, itemId, bal + amount);
    }

    function enterGame(
        bytes32 characterId,
        uint256 starterWeaponId,
        uint256 starterArmorId
    ) external {
        PauseLib.requireNotPaused();
        // Inline owner + validity checks (avoids modifier overhead)
        if (Characters.getOwner(characterId) != _msgSender()) revert Unauthorized();
        {
            address encoded = address(uint160(uint256(characterId) >> 96));
            uint256 tid = uint256(uint96(uint256(characterId)));
            if (ERC721Owners.get(_charsOwnersTableId(), tid) != encoded) revert InvalidAccount();
        }

        CharactersData memory charData = Characters.get(characterId);
        if (charData.locked) revert CharacterLocked();

        StatsData memory tempStats = Stats.get(characterId);

        if (!StarterItemPool.getIsStarter(starterWeaponId)) revert InvalidStarterItem();
        if (!StarterItemPool.getIsStarter(starterArmorId)) revert InvalidStarterItem();
        if (Items.getItemType(starterWeaponId) != ItemType.Weapon) revert InvalidItemType();
        if (Items.getItemType(starterArmorId) != ItemType.Armor) revert InvalidItemType();

        // Validate stat requirements for both items
        StatRestrictionsData memory wr = StatRestrictions.get(starterWeaponId);
        if (tempStats.strength < wr.minStrength) revert InsufficientStat();
        if (tempStats.agility < wr.minAgility) revert InsufficientStat();
        if (tempStats.intelligence < wr.minIntelligence) revert InsufficientStat();

        StatRestrictionsData memory ar = StatRestrictions.get(starterArmorId);
        if (tempStats.strength < ar.minStrength) revert InsufficientStat();
        if (tempStats.agility < ar.minAgility) revert InsufficientStat();
        if (tempStats.intelligence < ar.minIntelligence) revert InsufficientStat();

        ArmorType armorType = ArmorStats.getArmorType(starterArmorId);
        if (armorType == ArmorType.None) revert InvalidArmorType();
        tempStats.startingArmor = armorType;

        if (armorType == ArmorType.Cloth) {
            tempStats.intelligence += 2;
            tempStats.agility += 1;
            tempStats.strength -= 1;
        } else if (armorType == ArmorType.Leather) {
            tempStats.agility += 2;
            tempStats.strength += 1;
        } else if (armorType == ArmorType.Plate) {
            tempStats.strength += 2;
            tempStats.maxHp += 1;
            tempStats.agility -= 1;
        }

        tempStats.level = 1;
        tempStats.currentHp = int256(tempStats.maxHp);
        Stats.set(characterId, tempStats);

        address playerAddress = charData.owner;

        // Mint gold (balance + totalSupply)
        ResourceId goldTableId = _goldBalancesTableId();
        Balances.set(goldTableId, playerAddress, Balances.get(goldTableId, playerAddress) + 5 ether);
        ResourceId supplyTableId = _goldTotalSupplyTableId(GOLD_NAMESPACE);
        TotalSupply.set(supplyTableId, TotalSupply.get(supplyTableId) + 5 ether);

        // Mint starter items
        ResourceId itemsTableId = _itemsOwnersTableId();
        _mintItem(itemsTableId, playerAddress, starterWeaponId, 1);
        _mintItem(itemsTableId, playerAddress, starterArmorId, 1);

        // Mint starter consumables
        uint256[] memory cIds = StarterConsumables.getItemIds();
        uint256[] memory cAmts = StarterConsumables.getAmounts();
        for (uint256 i; i < cIds.length;) {
            _mintItem(itemsTableId, playerAddress, cIds[i], cAmts[i]);
            unchecked { ++i; }
        }

        CharacterEquipment.pushEquippedWeapons(characterId, starterWeaponId);
        CharacterEquipment.pushEquippedArmor(characterId, starterArmorId);

        charData.locked = true;
        bytes memory encodedStats = abi.encode(tempStats);
        charData.baseStats = encodedStats;
        charData.originalStats = encodedStats;
        Characters.set(characterId, charData);
    }
}
