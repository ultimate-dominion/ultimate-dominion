// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {
    Levels,
    NameExists,
    Counters,
    Stats,
    MobStats,
    CharacterEquipment,
    StatsData,
    CharacterOwner,
    Characters,
    CharactersData
} from "@codegen/index.sol";
import {RngRequestType} from "@codegen/common.sol";

import {UltimateDominionConfig} from "@codegen/index.sol";

import {IERC721Mintable} from "@latticexyz/world-modules/src/modules/erc721-puppet/IERC721Mintable.sol";
import {SystemSwitch} from "@latticexyz/world-modules/src/utils/SystemSwitch.sol";
import {TokenURI} from "@latticexyz/world-modules/src/modules/erc721-puppet/tables/TokenURI.sol";
import {_tokenUriTableId} from "@latticexyz/world-modules/src/modules/erc721-puppet/utils.sol";
import {IERC20System} from "@interfaces/IERC20System.sol";
import {IItemsSystem} from "@codegen/world/IItemsSystem.sol";
import {ILootManagerSystem} from "@codegen/world/ILootManagerSystem.sol";
import {Classes, PowerSource, Race, ArmorType, AdvancedClass} from "@codegen/common.sol";
import {IERC1155System} from "@erc1155/IERC1155System.sol";
import {ResourceId} from "@latticexyz/world/src/WorldResourceId.sol";
import {IWorld} from "@world/IWorld.sol";
import {IRngSystem} from "../interfaces/IRngSystem.sol";
import {LibChunks} from "../libraries/LibChunks.sol";
import {Math} from "@libraries/Math.sol";
import {StatCalculator} from "@libraries/StatCalculator.sol";
import "forge-std/console.sol";
import {IEntropyConsumer} from "@pythnetwork/IEntropyConsumer.sol";
import {IEntropy} from "@pythnetwork/IEntropy.sol";
import {AdjustedCombatStats} from "@interfaces/Structs.sol";
import {_erc721SystemId, _requireAccess} from "../utils.sol";
import {CHARACTERS_NAMESPACE, MAX_LEVEL, EARLY_GAME_CAP, MID_GAME_CAP} from "../../constants.sol";

contract CharacterSystem is System {
    // Events for implicit class system
    event RaceSelected(bytes32 indexed characterId, Race race);
    event PowerSourceSelected(bytes32 indexed characterId, PowerSource powerSource);
    event ArmorTypeSelected(bytes32 indexed characterId, ArmorType armorType);
    event AdvancedClassSelected(bytes32 indexed characterId, AdvancedClass advancedClass);

    modifier onlyOwner(bytes32 characterId) {
        require(isValidOwner(characterId, _msgSender()), "CHARACTER SYSTEM: INVALID OPERATOR");
        _;
    }

    function getName(bytes32 characterId) public view returns (bytes32 _name) {
        _name = Characters.getName(characterId);
    }

    function getClass(bytes32 characterId) public view returns (Classes _class) {
        _class = Stats.getClass(characterId);
    }

    function _goldToken() internal view returns (IERC20System goldToken) {
        goldToken = IERC20System(UltimateDominionConfig.getGoldToken());
    }

    function _characterToken() internal view returns (IERC721Mintable characterToken) {
        characterToken = IERC721Mintable(UltimateDominionConfig.getCharacterToken());
    }

    function getPlayerEntityId(uint256 characterTokenId) public view returns (bytes32 characterId) {
        address ownerAddress = _characterToken().ownerOf(characterTokenId);
        characterId = bytes32(uint256(uint160(ownerAddress)) << 96 | characterTokenId);
    }

    function getCharacterTokenId(bytes32 characterId) public pure returns (uint256) {
        return (uint256(uint96(uint256(characterId))));
    }

    function getCharacterIdFromOwnerAddress(address ownerAddress) public view returns (bytes32 _characterId) {
        return CharacterOwner.getCharacterId(ownerAddress);
    }

    /**
     *  @dev extracts the character nft owner address from the character Id
     */
    function getOwnerAddress(bytes32 characterId) public pure returns (address) {
        return address(uint160(uint256(characterId) >> 96));
    }

    function isValidCharacterId(bytes32 characterId) public view returns (bool) {
        address ownerAddress = getOwnerAddress(characterId);
        uint256 tokenId = getCharacterTokenId(characterId);
        address ownerOf;
        try _characterToken().ownerOf(tokenId) returns (address) {
            ownerOf = _characterToken().ownerOf(tokenId);
        } catch {}
        return ownerOf == ownerAddress;
    }

    function isValidOwner(bytes32 characterId, address owner) public view returns (bool) {
        return isValidCharacterId(characterId) && _characterToken().ownerOf(getCharacterTokenId(characterId)) == owner;
    }

    /**
     * @param account the address of the account that will own the character
     * @param name the keccack256 hash of the characters name to check for duplicates
     * @param tokenUri the token uri to be set for the character token
     * @return characterId the bytes32 character id combination of the owner address and the tokenId
     */
    function mintCharacter(address account, bytes32 name, string memory tokenUri)
        public
        returns (bytes32 characterId)
    {
        require(CharacterOwner.getCharacterTokenId(_msgSender()) == 0, "CHARACTERS: Already has a character");
        uint256 characterTokenId = _incrementCharacterCounter();
        require(characterTokenId < type(uint96).max, "CHARACATERS: Max characters reached");
        IWorld(_world()).call(
            _erc721SystemId(CHARACTERS_NAMESPACE), abi.encodeCall(IERC721Mintable.mint, (account, characterTokenId))
        );
        characterId = getPlayerEntityId(characterTokenId);
        Characters.setOwner(characterId, account);
        Characters.setTokenId(characterId, characterTokenId);
        CharacterOwner.setCharacterTokenId(_msgSender(), characterTokenId);
        CharacterOwner.setCharacterId(_msgSender(), characterId);
        require(!NameExists.getValue(name), "Name already exists");
        NameExists.setValue(name, true);
        Characters.setName(characterId, name);
        _setTokenURI(characterTokenId, tokenUri);
    }

    function rollStats(bytes32 userRandomNumber, bytes32 characterId, Classes class)
        public
        payable
        onlyOwner(characterId)
    {
        require(!Characters.getLocked(characterId), "CHARACTERS: character already in game world");
        RngRequestType requestType = RngRequestType.CharacterStats;
        Stats.setClass(characterId, class);
        // use systemSwitch to call rng system
        SystemSwitch.call(abi.encodeCall(IRngSystem.getRng, (userRandomNumber, requestType, abi.encode(characterId))));
    }

    /**
     * @notice Roll balanced base stats for implicit class system
     * @dev This should be called AFTER chooseRace, choosePowerSource, and chooseStartingArmor
     *      Stats total 19 points distributed across STR/AGI/INT (each 3-10 range)
     *      Race and armor bonuses are already applied and will be preserved
     * @param userRandomNumber User-provided random seed
     * @param characterId The character to generate stats for
     */
    function rollBaseStats(bytes32 userRandomNumber, bytes32 characterId)
        public
        payable
        onlyOwner(characterId)
    {
        require(!Characters.getLocked(characterId), "CHARACTERS: character already in game world");
        require(Stats.getRace(characterId) != Race.None, "CHARACTERS: must choose race first");
        require(Stats.getPowerSource(characterId) != PowerSource.None, "CHARACTERS: must choose power source first");
        // Note: startingArmor is now set via enterGame when player selects their starter armor

        RngRequestType requestType = RngRequestType.CharacterStats;
        // Encode characterId with a flag indicating this is for balanced stats
        bytes memory data = abi.encode(characterId, true); // true = use balanced stats
        SystemSwitch.call(abi.encodeCall(IRngSystem.getRng, (userRandomNumber, requestType, data)));
    }

    /**
     * @notice Choose race for a character (part of implicit class system)
     * @param characterId The character to set race for
     * @param race The chosen race (Human, Elf, Dwarf)
     * @dev Applies race-specific stat modifiers:
     *      - Dwarf: STR +2, AGI -1, HP +1
     *      - Elf: AGI +2, INT +1, STR -1, HP -1
     *      - Human: STR +1, AGI +1, INT +1
     */
    function chooseRace(bytes32 characterId, Race race) public onlyOwner(characterId) {
        require(!Characters.getLocked(characterId), "CHARACTERS: character already in game world");
        require(race != Race.None, "CHARACTERS: invalid race");
        require(Stats.getRace(characterId) == Race.None, "CHARACTERS: race already selected");

        StatsData memory stats = Stats.get(characterId);
        stats.race = race;

        // Apply race-based stat modifiers
        if (race == Race.Dwarf) {
            stats.strength += 2;
            stats.agility -= 1;
            stats.maxHp += 1;
        } else if (race == Race.Elf) {
            stats.agility += 2;
            stats.intelligence += 1;
            stats.strength -= 1;
            stats.maxHp -= 1;
        } else if (race == Race.Human) {
            stats.strength += 1;
            stats.agility += 1;
            stats.intelligence += 1;
        }

        Stats.set(characterId, stats);
        emit RaceSelected(characterId, race);
    }

    /**
     * @notice Choose power source for a character (part of implicit class system)
     * @param characterId The character to set power source for
     * @param powerSource The chosen power source (Divine, Weave, Physical)
     * @dev Power source determines which advanced classes are available at level 10
     */
    function choosePowerSource(bytes32 characterId, PowerSource powerSource) public onlyOwner(characterId) {
        require(!Characters.getLocked(characterId), "CHARACTERS: character already in game world");
        require(powerSource != PowerSource.None, "CHARACTERS: invalid power source");
        require(Stats.getPowerSource(characterId) == PowerSource.None, "CHARACTERS: power source already selected");

        Stats.setPowerSource(characterId, powerSource);
        emit PowerSourceSelected(characterId, powerSource);
    }

    /**
     * @notice Choose starting armor type for a character (part of implicit class system)
     * @param characterId The character to set armor type for
     * @param armorType The chosen armor type (Cloth, Leather, Plate)
     * @dev Applies armor-type specific stat modifiers:
     *      - Cloth: INT +2, AGI +1, STR -1
     *      - Leather: AGI +2, STR +1
     *      - Plate: STR +2, HP +1, AGI -1
     */
    function chooseStartingArmor(bytes32 characterId, ArmorType armorType) public onlyOwner(characterId) {
        require(!Characters.getLocked(characterId), "CHARACTERS: character already in game world");
        require(armorType != ArmorType.None, "CHARACTERS: invalid armor type");
        require(Stats.getStartingArmor(characterId) == ArmorType.None, "CHARACTERS: armor already selected");

        StatsData memory stats = Stats.get(characterId);
        stats.startingArmor = armorType;

        // Apply armor-based stat modifiers
        if (armorType == ArmorType.Cloth) {
            stats.intelligence += 2;
            stats.agility += 1;
            stats.strength -= 1;
        } else if (armorType == ArmorType.Leather) {
            stats.agility += 2;
            stats.strength += 1;
        } else if (armorType == ArmorType.Plate) {
            stats.strength += 2;
            stats.maxHp += 1;
            stats.agility -= 1;
        }

        Stats.set(characterId, stats);
        emit ArmorTypeSelected(characterId, armorType);
    }

    /**
     * @notice Get the power source for a character
     */
    function getPowerSource(bytes32 characterId) public view returns (PowerSource) {
        return Stats.getPowerSource(characterId);
    }

    /**
     * @notice Get the race for a character
     */
    function getRace(bytes32 characterId) public view returns (Race) {
        return Stats.getRace(characterId);
    }

    /**
     * @notice Get the starting armor type for a character
     */
    function getStartingArmor(bytes32 characterId) public view returns (ArmorType) {
        return Stats.getStartingArmor(characterId);
    }

    /**
     * @notice Get the advanced class for a character (only set at level 10+)
     */
    function getAdvancedClass(bytes32 characterId) public view returns (AdvancedClass) {
        return Stats.getAdvancedClass(characterId);
    }

    /**
     * @notice Select advanced class at level 10 (class crystallization)
     * @dev The advanced class must be valid for the character's dominant stat and power source:
     *      - STR + Divine = Paladin
     *      - STR + Weave = Sorcerer
     *      - STR + Physical = Warrior
     *      - AGI + Divine = Druid
     *      - AGI + Weave = Warlock
     *      - AGI + Physical = Ranger
     *      - INT + Divine = Cleric
     *      - INT + Weave = Wizard
     *      - INT + Physical = Rogue
     * @param characterId The character selecting their advanced class
     * @param advancedClass The chosen advanced class
     */
    function selectAdvancedClass(bytes32 characterId, AdvancedClass advancedClass) public onlyOwner(characterId) {
        StatsData memory stats = Stats.get(characterId);

        // Check requirements
        require(stats.level >= 10, "CHARACTER SYSTEM: Must be level 10 to select advanced class");
        require(!stats.hasSelectedAdvancedClass, "CHARACTER SYSTEM: Advanced class already selected");
        require(advancedClass != AdvancedClass.None, "CHARACTER SYSTEM: Invalid advanced class");

        // Validate class selection based on dominant stat and power source
        require(_isValidAdvancedClass(stats, advancedClass), "CHARACTER SYSTEM: Invalid class for character build");

        // Apply class-specific bonuses
        stats = _applyAdvancedClassBonuses(stats, advancedClass);

        // Mark as having selected advanced class
        stats.advancedClass = advancedClass;
        stats.hasSelectedAdvancedClass = true;

        Stats.set(characterId, stats);

        // Update base stats to include the new bonuses
        Characters.setBaseStats(characterId, abi.encode(stats));

        // Issue class-specific items
        IWorld(_world()).UD__issueAdvancedClassItems(characterId, advancedClass);

        emit AdvancedClassSelected(characterId, advancedClass);
    }

    /**
     * @notice Validate that the advanced class is valid for the character's build
     * @param stats Character's current stats
     * @param advancedClass The class being validated
     * @return isValid Whether the class is valid for this character
     */
    function _isValidAdvancedClass(StatsData memory stats, AdvancedClass advancedClass) internal pure returns (bool) {
        // Determine dominant stat
        bool strDominant = stats.strength >= stats.agility && stats.strength >= stats.intelligence;
        bool agiDominant = !strDominant && stats.agility > stats.strength && stats.agility >= stats.intelligence;
        bool intDominant = !strDominant && !agiDominant;

        // Validate based on dominant stat + power source combination
        if (strDominant) {
            if (stats.powerSource == PowerSource.Divine && advancedClass == AdvancedClass.Paladin) return true;
            if (stats.powerSource == PowerSource.Weave && advancedClass == AdvancedClass.Sorcerer) return true;
            if (stats.powerSource == PowerSource.Physical && advancedClass == AdvancedClass.Warrior) return true;
        } else if (agiDominant) {
            if (stats.powerSource == PowerSource.Divine && advancedClass == AdvancedClass.Druid) return true;
            if (stats.powerSource == PowerSource.Weave && advancedClass == AdvancedClass.Warlock) return true;
            if (stats.powerSource == PowerSource.Physical && advancedClass == AdvancedClass.Ranger) return true;
        } else if (intDominant) {
            if (stats.powerSource == PowerSource.Divine && advancedClass == AdvancedClass.Cleric) return true;
            if (stats.powerSource == PowerSource.Weave && advancedClass == AdvancedClass.Wizard) return true;
            if (stats.powerSource == PowerSource.Physical && advancedClass == AdvancedClass.Rogue) return true;
        }

        return false;
    }

    /**
     * @notice Apply stat bonuses when selecting an advanced class
     * @param stats Current character stats
     * @param advancedClass The selected advanced class
     * @return Updated stats with class bonuses applied
     */
    function _applyAdvancedClassBonuses(StatsData memory stats, AdvancedClass advancedClass)
        internal
        pure
        returns (StatsData memory)
    {
        // Each class gets unique bonuses that reinforce their playstyle
        if (advancedClass == AdvancedClass.Paladin) {
            // Divine tank - STR and HP focus
            stats.strength += 2;
            stats.maxHp += 5;
        } else if (advancedClass == AdvancedClass.Sorcerer) {
            // Battle mage - balanced STR/INT
            stats.strength += 1;
            stats.intelligence += 1;
            stats.maxHp += 3;
        } else if (advancedClass == AdvancedClass.Warrior) {
            // Pure tank - STR and high HP
            stats.strength += 2;
            stats.maxHp += 7;
        } else if (advancedClass == AdvancedClass.Druid) {
            // Hybrid - AGI with some STR for shapeshifting
            stats.agility += 1;
            stats.strength += 1;
            stats.maxHp += 3;
        } else if (advancedClass == AdvancedClass.Warlock) {
            // Dark caster - AGI/INT hybrid
            stats.agility += 1;
            stats.intelligence += 1;
            stats.maxHp += 2;
        } else if (advancedClass == AdvancedClass.Ranger) {
            // Ranged specialist - pure AGI
            stats.agility += 2;
            stats.maxHp += 3;
        } else if (advancedClass == AdvancedClass.Cleric) {
            // Divine caster - INT with HP for survivability
            stats.intelligence += 1;
            stats.strength += 1;
            stats.maxHp += 5;
        } else if (advancedClass == AdvancedClass.Wizard) {
            // Pure caster - INT focus, low HP
            stats.intelligence += 2;
            stats.maxHp += 2;
        } else if (advancedClass == AdvancedClass.Rogue) {
            // Tactical assassin - INT/STR for planning and execution
            stats.intelligence += 1;
            stats.strength += 1;
            stats.maxHp += 4;
        }

        return stats;
    }

    /**
     * @notice Get the valid advanced class for a character based on their build
     * @dev Useful for UI to show which class the player can select
     * @param characterId The character to check
     * @return validClass The advanced class this character can select
     */
    function getValidAdvancedClass(bytes32 characterId) public view returns (AdvancedClass) {
        StatsData memory stats = Stats.get(characterId);

        // Determine dominant stat
        bool strDominant = stats.strength >= stats.agility && stats.strength >= stats.intelligence;
        bool agiDominant = !strDominant && stats.agility > stats.strength && stats.agility >= stats.intelligence;

        if (strDominant) {
            if (stats.powerSource == PowerSource.Divine) return AdvancedClass.Paladin;
            if (stats.powerSource == PowerSource.Weave) return AdvancedClass.Sorcerer;
            if (stats.powerSource == PowerSource.Physical) return AdvancedClass.Warrior;
        } else if (agiDominant) {
            if (stats.powerSource == PowerSource.Divine) return AdvancedClass.Druid;
            if (stats.powerSource == PowerSource.Weave) return AdvancedClass.Warlock;
            if (stats.powerSource == PowerSource.Physical) return AdvancedClass.Ranger;
        } else {
            // INT dominant
            if (stats.powerSource == PowerSource.Divine) return AdvancedClass.Cleric;
            if (stats.powerSource == PowerSource.Weave) return AdvancedClass.Wizard;
            if (stats.powerSource == PowerSource.Physical) return AdvancedClass.Rogue;
        }

        return AdvancedClass.None;
    }

    function enterGame(bytes32 characterId) public onlyOwner(characterId) {
        require(!Characters.getLocked(characterId), "you have entered the game");
        StatsData memory tempStats = Stats.get(characterId);
        tempStats.level = 1;
        tempStats.currentHp = int256(tempStats.maxHp);
        Stats.set(characterId, tempStats);
        IWorld(_world()).UD__dropGoldToPlayer(characterId, 5 ether);
        // issue starter gear
        IWorld(_world()).UD__issueStarterItems(characterId);
        CharactersData memory charData = Characters.get(characterId);
        charData.locked = true;
        bytes memory encodedStats = abi.encode(tempStats);
        charData.baseStats = encodedStats;
        charData.originalStats = encodedStats;
        Characters.set(characterId, charData);
    }

    function getCurrentAvailableLevel(uint256 experience) public view returns (uint256 currentAvailableLevel) {
        if (experience >= Levels.get(MAX_LEVEL - 1)) {
            currentAvailableLevel = MAX_LEVEL;
        } else {
            for (uint256 i; i < MAX_LEVEL;) {
                if (Levels.get(i) <= experience && Levels.get(i + 1) > experience) {
                    currentAvailableLevel = i + 1;
                    break;
                }
                {
                    i++;
                }
            }
        }
    }

    function levelCharacter(bytes32 characterId, StatsData memory desiredStats) public onlyOwner(characterId) {
        require(!IWorld(_world()).UD__isInEncounter(characterId), "cannot level in combat");
        StatsData memory stats = abi.decode(Characters.getBaseStats(characterId), (StatsData));
        stats.currentHp = Stats.getCurrentHp(characterId);
        uint256 availableLevel = getCurrentAvailableLevel(stats.experience);
        if (stats.level == MAX_LEVEL) {
            return;
        }

        uint256 newLevel = stats.level + 1;
        int256 strChange = desiredStats.strength - stats.strength;
        int256 agiChange = desiredStats.agility - stats.agility;
        int256 intChange = desiredStats.intelligence - stats.intelligence;

        // Use diminishing returns system for stat points
        int256 allowedStatPoints = StatCalculator.calculateStatPointsForLevel(newLevel);
        require(
            (strChange + agiChange + intChange) == allowedStatPoints, "CHARACTER SYSTEM: INVALID STAT CHANGE"
        );

        // Calculate HP gain using diminishing returns
        int256 hpGain = StatCalculator.calculateHpForLevel(newLevel);
        stats.maxHp += hpGain;

        stats.strength = desiredStats.strength;
        stats.agility = desiredStats.agility;
        stats.intelligence = desiredStats.intelligence;
        stats.level = newLevel;

        // set base stats
        Characters.setBaseStats(characterId, abi.encode(stats));

        // apply equipment bonuses and set them to stat table
        _setStats(characterId, IWorld(_world()).UD__calculateEquipmentBonuses(characterId), stats.level);
        // re-apply world bonuses
        IWorld(_world()).UD__applyWorldEffects(characterId);
    }

    function setStats(bytes32 entityId, AdjustedCombatStats memory stats) public {
        _requireAccess(address(this), _msgSender());
        StatsData memory statsData = Stats.get(entityId);

        if (IWorld(_world()).UD__isValidCharacterId(entityId)) {
            statsData.strength = stats.strength;
            statsData.agility = stats.agility;
            statsData.intelligence = stats.intelligence;
            statsData.maxHp = stats.maxHp;
            CharacterEquipment.setArmor(entityId, stats.armor);
        } else if (IWorld(_world()).UD__isValidMob(entityId)) {
            statsData.strength = stats.strength;
            statsData.agility = stats.agility;
            statsData.intelligence = stats.intelligence;
            statsData.maxHp = stats.maxHp;
            MobStats.setArmor(entityId, stats.armor);
        } else {
            revert("unrecognized id");
        }
        Stats.set(entityId, statsData);
    }

    function _setStats(bytes32 entityId, AdjustedCombatStats memory stats, uint256 level) internal {
        StatsData memory statsData = Stats.get(entityId);
        statsData.strength = stats.strength;
        statsData.agility = stats.agility;
        statsData.intelligence = stats.intelligence;
        statsData.maxHp = stats.maxHp;
        statsData.currentHp = stats.maxHp;
        statsData.level = level;
        CharacterEquipment.setArmor(entityId, stats.armor);

        Stats.set(entityId, statsData);
    }

    function updateTokenUri(bytes32 characterId, string memory tokenUri) public onlyOwner(characterId) {
        _setTokenURI(getCharacterTokenId(characterId), tokenUri);
    }

    function _setTokenURI(uint256 tokenId, string memory tokenUri) internal {
        TokenURI.setTokenURI(_tokenUriTableId(CHARACTERS_NAMESPACE), tokenId, tokenUri);
    }

    function _incrementCharacterCounter() internal returns (uint256) {
        address characterContract = UltimateDominionConfig.getCharacterToken();
        uint256 characterCounter = Counters.getCounter(address(characterContract), 0) + 1;
        Counters.setCounter(characterContract, 0, (characterCounter));
        return characterCounter;
    }

    function _gold() internal view returns (IERC20System gold) {
        return IERC20System(UltimateDominionConfig.getGoldToken());
    }

    function getOwner(bytes32 characterId) public view returns (address) {
        return Characters.getOwner(characterId);
    }

    function getExperience(bytes32 characterId) public view returns (uint256) {
        return Stats.getExperience(characterId);
    }

    function getStats(bytes32 characterId) public view returns (StatsData memory) {
        return Stats.get(characterId);
    }

    function getBaseStats(bytes32 characterId) public view returns (StatsData memory) {
        return abi.decode(Characters.getBaseStats(characterId), (StatsData));
    }
}
