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
    StarterItems,
    StarterItemsData,
    StarterItemPool,
    StarterConsumables,
    ArmorStats,
    WeaponStats,
    StatRestrictions,
    StatRestrictionsData,
    Items,
    UltimateDominionConfig
} from "@codegen/index.sol";
import {Classes, ArmorType, ItemType} from "@codegen/common.sol";
import {IERC721Mintable} from "@latticexyz/world-modules/src/modules/erc721-puppet/IERC721Mintable.sol";
import {SystemSwitch} from "@latticexyz/world-modules/src/utils/SystemSwitch.sol";
import {TokenURI} from "@latticexyz/world-modules/src/modules/erc721-puppet/tables/TokenURI.sol";
import {_tokenUriTableId} from "@latticexyz/world-modules/src/modules/erc721-puppet/utils.sol";
import {IWorld} from "@world/IWorld.sol";
import {_erc721SystemId} from "../../utils.sol";
import {CHARACTERS_NAMESPACE, GOLD_NAMESPACE, ITEMS_NAMESPACE} from "../../../constants.sol";
// Direct table access for gold transfers
import {Balances} from "@latticexyz/world-modules/src/modules/tokens/tables/Balances.sol";
import {_balancesTableId} from "@latticexyz/world-modules/src/modules/erc20-puppet/utils.sol";
// Direct table access for item transfers
import {Owners} from "@erc1155/tables/Owners.sol";
import {_ownersTableId} from "@erc1155/utils.sol";
import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";

contract CharacterCore is System {
    modifier onlyOwner(bytes32 characterId) {
        require(isValidOwner(characterId, _msgSender()), "CHARACTER CORE: INVALID OPERATOR");
        _;
    }

    modifier validCharacter(bytes32 characterId) {
        require(isValidCharacterId(characterId), "CHARACTER CORE: INVALID CHARACTER");
        _;
    }

    function _characterToken() internal view returns (IERC721Mintable characterToken) {
        characterToken = IERC721Mintable(UltimateDominionConfig.getCharacterToken());
    }

    /**
     * @dev Basic character creation - mints character NFT and sets up basic data
     * @param account The account to mint the character to
     * @param name The character's name
     * @param tokenUri The token URI for metadata
     * @return characterId The ID of the created character
     */
    function mintCharacter(address account, bytes32 name, string memory tokenUri)
        public
        returns (bytes32 characterId)
    {
        require(account != address(0), "CHARACTER CORE: INVALID ACCOUNT");
        require(name != bytes32(0), "CHARACTER CORE: INVALID NAME");
        require(bytes(tokenUri).length > 0, "CHARACTER CORE: INVALID TOKEN URI");
        
        // Check if name already exists
        require(!NameExists.get(name), "CHARACTER CORE: NAME ALREADY EXISTS");
        
        // Get next token ID
        uint256 tokenId = Counters.getCounter(address(this), 0) + 1;
        Counters.setCounter(address(this), 0, tokenId);
        
        // Mint character NFT first (needed for characterId encoding)
        IERC721Mintable characterToken = IERC721Mintable(UltimateDominionConfig.getCharacterToken());
        characterToken.mint(account, tokenId);
        
        // Create character ID using the same format as old CharacterSystem: ownerAddress << 96 | tokenId
        characterId = bytes32(uint256(uint160(account)) << 96 | tokenId);
        
        // Set token URI
        TokenURI.set(_tokenUriTableId(CHARACTERS_NAMESPACE), tokenId, tokenUri);
        
        // Set up character data
        Characters.set(characterId, CharactersData({
            tokenId: tokenId,
            owner: account,
            name: name,
            locked: false,
            originalStats: "",
            baseStats: ""
        }));

        // Set up CharacterOwner mapping for lookups
        CharacterOwner.set(account, tokenId, characterId);

        // Mark name as taken
        NameExists.set(name, true);
        
    }

    /**
     * @dev Character entry into the game - locks character and enables gameplay
     * @param characterId The character to enter the game
     * @param starterWeaponId The weapon item ID chosen by the player
     * @param starterArmorId The armor item ID chosen by the player (determines startingArmor type)
     */
    function enterGame(
        bytes32 characterId,
        uint256 starterWeaponId,
        uint256 starterArmorId
    ) public onlyOwner(characterId) validCharacter(characterId) {
        CharactersData memory charData = Characters.get(characterId);
        require(!charData.locked, "CHARACTER CORE: CHARACTER ALREADY IN GAME");

        // Get stats for validation
        StatsData memory tempStats = Stats.get(characterId);

        // Validate starter items are in the pool
        require(StarterItemPool.getIsStarter(starterWeaponId), "CHARACTER CORE: INVALID STARTER WEAPON");
        require(StarterItemPool.getIsStarter(starterArmorId), "CHARACTER CORE: INVALID STARTER ARMOR");

        // Validate item types
        require(Items.getItemType(starterWeaponId) == ItemType.Weapon, "CHARACTER CORE: NOT A WEAPON");
        require(Items.getItemType(starterArmorId) == ItemType.Armor, "CHARACTER CORE: NOT AN ARMOR");

        // Validate stat requirements for weapon
        StatRestrictionsData memory weaponRestrictions = StatRestrictions.get(starterWeaponId);
        require(tempStats.strength >= weaponRestrictions.minStrength, "CHARACTER CORE: INSUFFICIENT STR FOR WEAPON");
        require(tempStats.agility >= weaponRestrictions.minAgility, "CHARACTER CORE: INSUFFICIENT AGI FOR WEAPON");
        require(tempStats.intelligence >= weaponRestrictions.minIntelligence, "CHARACTER CORE: INSUFFICIENT INT FOR WEAPON");

        // Validate stat requirements for armor
        StatRestrictionsData memory armorRestrictions = StatRestrictions.get(starterArmorId);
        require(tempStats.strength >= armorRestrictions.minStrength, "CHARACTER CORE: INSUFFICIENT STR FOR ARMOR");
        require(tempStats.agility >= armorRestrictions.minAgility, "CHARACTER CORE: INSUFFICIENT AGI FOR ARMOR");
        require(tempStats.intelligence >= armorRestrictions.minIntelligence, "CHARACTER CORE: INSUFFICIENT INT FOR ARMOR");

        // Set startingArmor based on the chosen armor's type
        ArmorType armorType = ArmorStats.getArmorType(starterArmorId);
        require(armorType != ArmorType.None, "CHARACTER CORE: ARMOR HAS NO TYPE");
        tempStats.startingArmor = armorType;

        // Apply armor-based stat modifiers (same as chooseStartingArmor)
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

        // Update stats for game entry
        tempStats.level = 1;
        tempStats.currentHp = int256(tempStats.maxHp);
        Stats.set(characterId, tempStats);

        address playerAddress = charData.owner;

        // Mint gold directly to player via table write (bypasses ERC20System access checks)
        ResourceId goldBalanceTableId = _balancesTableId(GOLD_NAMESPACE);
        uint256 playerGoldBalance = Balances.get(goldBalanceTableId, playerAddress);
        uint256 goldAmount = 100 ether; // Increased for marketplace testing
        Balances.set(goldBalanceTableId, playerAddress, playerGoldBalance + goldAmount);

        // Mint chosen starter items directly to player
        ResourceId itemsOwnersTableId = _ownersTableId(ITEMS_NAMESPACE);

        // Mint weapon
        uint256 playerWeaponBalance = Owners.getBalance(itemsOwnersTableId, playerAddress, starterWeaponId);
        Owners.setBalance(itemsOwnersTableId, playerAddress, starterWeaponId, playerWeaponBalance + 1);

        // Mint armor
        uint256 playerArmorBalance = Owners.getBalance(itemsOwnersTableId, playerAddress, starterArmorId);
        Owners.setBalance(itemsOwnersTableId, playerAddress, starterArmorId, playerArmorBalance + 1);

        // Mint starter consumables (e.g., health potions)
        uint256[] memory consumableIds = StarterConsumables.getItemIds();
        uint256[] memory consumableAmounts = StarterConsumables.getAmounts();
        for (uint256 i = 0; i < consumableIds.length; i++) {
            uint256 playerConsumableBalance = Owners.getBalance(itemsOwnersTableId, playerAddress, consumableIds[i]);
            Owners.setBalance(itemsOwnersTableId, playerAddress, consumableIds[i], playerConsumableBalance + consumableAmounts[i]);
        }

        // Equip the starter items so they can be used in combat
        CharacterEquipment.pushEquippedWeapons(characterId, starterWeaponId);
        CharacterEquipment.pushEquippedArmor(characterId, starterArmorId);

        // Lock character and store base stats
        charData.locked = true;
        bytes memory encodedStats = abi.encode(tempStats);
        charData.baseStats = encodedStats;
        charData.originalStats = encodedStats;
        Characters.set(characterId, charData);
    }

    /**
     * @dev Update character token URI for metadata
     * @param characterId The character to update
     * @param tokenUri The new token URI
     */
    function updateTokenUri(bytes32 characterId, string memory tokenUri) 
        public 
        onlyOwner(characterId) 
        validCharacter(characterId) 
    {
        require(bytes(tokenUri).length > 0, "CHARACTER CORE: INVALID TOKEN URI");
        
        CharactersData memory charData = Characters.get(characterId);
        TokenURI.set(_tokenUriTableId(CHARACTERS_NAMESPACE), charData.tokenId, tokenUri);
    }

    /**
     * @dev Basic character validation - checks if character exists and is valid
     * @param characterId The character to validate
     * @return isValid True if character is valid
     */
    function basicCharacterValidation(bytes32 characterId) public view returns (bool isValid) {
        return isValidCharacterId(characterId);
    }


    /**
     * @dev Check if address is valid owner of character
     * @param characterId The character ID
     * @param owner The address to check
     * @return True if address owns character
     */
    function isValidOwner(bytes32 characterId, address owner) public view returns (bool) {
        return Characters.getOwner(characterId) == owner;
    }

    /**
     * @dev Get character owner
     * @param characterId The character ID
     * @return The owner address
     */
    function getOwner(bytes32 characterId) public view returns (address) {
        return Characters.getOwner(characterId);
    }

    /**
     * @dev Get character name
     * @param characterId The character ID
     * @return The character name
     */
    function getName(bytes32 characterId) public view returns (bytes32) {
        CharactersData memory charData = Characters.get(characterId);
        return charData.name;
    }

    /**
     * @dev Get character token ID from characterId encoding
     * @param characterId The character ID (format: ownerAddress << 96 | tokenId)
     * @return The token ID
     */
    function getCharacterTokenId(bytes32 characterId) public pure returns (uint256) {
        return uint256(uint96(uint256(characterId)));
    }

    /**
     * @dev Check if character is locked (in game)
     * @param characterId The character ID
     * @return True if character is locked
     */
    function isCharacterLocked(bytes32 characterId) public view returns (bool) {
        CharactersData memory charData = Characters.get(characterId);
        return charData.locked;
    }

    /**
     * @dev Get character ID from owner address
     * @param ownerAddress The owner's address
     * @return characterId The character ID
     */
    function getCharacterIdFromOwnerAddress(address ownerAddress) public view returns (bytes32 characterId) {
        return CharacterOwner.getCharacterId(ownerAddress);
    }

    /**
     * @dev Extract the character NFT owner address from the character ID
     * @param characterId The character ID
     * @return The owner address
     */
    function getOwnerAddress(bytes32 characterId) public pure returns (address) {
        return address(uint160(uint256(characterId) >> 96));
    }

    /**
     * @dev Validate if a character ID is valid
     * @param characterId The character ID to validate
     * @return True if the character ID is valid
     */
    function isValidCharacterId(bytes32 characterId) public view returns (bool) {
        address ownerAddress = getOwnerAddress(characterId);
        uint256 tokenId = getCharacterTokenId(characterId);
        address ownerOf;
        try _characterToken().ownerOf(tokenId) returns (address) {
            ownerOf = _characterToken().ownerOf(tokenId);
        } catch {
            return false;
        }
        return ownerOf == ownerAddress;
    }
}
