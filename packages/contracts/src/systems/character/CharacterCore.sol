// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {
    Characters,
    CharactersData,
    CharacterEquipment,
    NameExists,
    Counters,
    CharacterOwner,
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
import {TokenURI} from "@latticexyz/world-modules/src/modules/erc721-puppet/tables/TokenURI.sol";
import {Owners as ERC721Owners} from "@latticexyz/world-modules/src/modules/erc721-puppet/tables/Owners.sol";
import {WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_TABLE} from "@latticexyz/store/src/storeResourceTypes.sol";
import {CHARACTERS_NAMESPACE, GOLD_NAMESPACE, ITEMS_NAMESPACE} from "../../../constants.sol";
import {
    Unauthorized,
    InvalidAccount,
    InvalidTokenUri,
    NameTaken,
    CharacterLocked,
    InvalidStarterItem,
    InvalidItemType,
    InsufficientStat,
    InvalidArmorType
} from "../../Errors.sol";
import {Balances} from "@latticexyz/world-modules/src/modules/tokens/tables/Balances.sol";
import {Owners} from "@erc1155/tables/Owners.sol";
import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {PauseLib} from "../../libraries/PauseLib.sol";

contract CharacterCore is System {
    function _charsOwnersTableId() internal pure returns (ResourceId) {
        return WorldResourceIdLib.encode(RESOURCE_TABLE, CHARACTERS_NAMESPACE, "Owners");
    }

    function _charsBalancesTableId() internal pure returns (ResourceId) {
        return WorldResourceIdLib.encode(RESOURCE_TABLE, CHARACTERS_NAMESPACE, "Balances");
    }

    function _charsTokenUriTableId() internal pure returns (ResourceId) {
        return WorldResourceIdLib.encode(RESOURCE_TABLE, CHARACTERS_NAMESPACE, "TokenURI");
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

    function mintCharacter(address account, bytes32 name, string calldata tokenUri)
        external
        returns (bytes32 characterId)
    {
        PauseLib.requireNotPaused();
        if (account == address(0)) revert InvalidAccount();
        if (name == bytes32(0)) revert InvalidAccount();
        if (bytes(tokenUri).length == 0) revert InvalidTokenUri();
        if (NameExists.get(name)) revert NameTaken();

        uint256 tokenId = Counters.getCounter(address(this), 0) + 1;
        Counters.setCounter(address(this), 0, tokenId);

        // Direct table writes bypass v2.2.23 ERC721System._requireOwner check
        ERC721Owners.set(_charsOwnersTableId(), tokenId, account);
        Balances.set(_charsBalancesTableId(), account,
            Balances.get(_charsBalancesTableId(), account) + 1);

        characterId = bytes32(uint256(uint160(account)) << 96 | tokenId);

        TokenURI.set(_charsTokenUriTableId(), tokenId, tokenUri);

        Characters.set(characterId, CharactersData({
            tokenId: tokenId,
            owner: account,
            name: name,
            locked: false,
            originalStats: "",
            baseStats: ""
        }));

        CharacterOwner.set(account, tokenId, characterId);
        NameExists.set(name, true);
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

        // Mint gold
        ResourceId goldTableId = _goldBalancesTableId();
        Balances.set(goldTableId, playerAddress, Balances.get(goldTableId, playerAddress) + 100 ether);

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

    function isValidOwner(bytes32 characterId, address owner) external view returns (bool) {
        return Characters.getOwner(characterId) == owner;
    }

    function getOwner(bytes32 characterId) external view returns (address) {
        return Characters.getOwner(characterId);
    }

    function getCharacterIdFromOwnerAddress(address ownerAddress) external view returns (bytes32) {
        return CharacterOwner.getCharacterId(ownerAddress);
    }

    function getOwnerAddress(bytes32 characterId) external pure returns (address) {
        return address(uint160(uint256(characterId) >> 96));
    }

    function isValidCharacterId(bytes32 characterId) external view returns (bool) {
        address ownerAddress = address(uint160(uint256(characterId) >> 96));
        uint256 tokenId = uint256(uint96(uint256(characterId)));
        return ERC721Owners.get(_charsOwnersTableId(), tokenId) == ownerAddress;
    }
}
