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
import {IERC20System} from "@latticexyz/world-modules/src/interfaces/IERC20System.sol";
import {IItemsSystem} from "@codegen/world/IItemsSystem.sol";
import {ILootManagerSystem} from "@codegen/world/ILootManagerSystem.sol";
import {Classes} from "@codegen/common.sol";
import {IERC1155System} from "@erc1155/IERC1155System.sol";
import {ResourceId} from "@latticexyz/world/src/WorldResourceId.sol";
import {IWorld} from "@world/IWorld.sol";
import {IRngSystem} from "../interfaces/IRngSystem.sol";
import {LibChunks} from "../libraries/LibChunks.sol";
import {Math} from "@libraries/Math.sol";
import "forge-std/console.sol";
import {IEntropyConsumer} from "@pythnetwork/IEntropyConsumer.sol";
import {IEntropy} from "@pythnetwork/IEntropy.sol";
import {AdjustedCombatStats} from "@interfaces/Structs.sol";
import {_erc721SystemId, _requireAccess} from "../utils.sol";
import {CHARACTERS_NAMESPACE, ABILITY_POINTS_PER_LEVEL, MAX_LEVEL, BONUS_POINT_LEVEL} from "../../constants.sol";

contract CharacterSystem is System {
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
        int256 strChange = desiredStats.strength - stats.strength;
        int256 agiChange = desiredStats.agility - stats.agility;
        int256 intChange = desiredStats.intelligence - stats.intelligence;
        // int256 hpChange = desiredStats.maxHp - stats.maxHp;

        require(
            (strChange + agiChange + intChange) == ABILITY_POINTS_PER_LEVEL, "CHARACTER SYSTEM: INVALID STAT CHANGE"
        );
        // add an extra point for class stat
        if (availableLevel % BONUS_POINT_LEVEL == 0) {
            Classes characterClass = getClass(characterId);
            if (characterClass == Classes.Warrior) {
                ++desiredStats.strength;
            } else if (characterClass == Classes.Rogue) {
                ++desiredStats.agility;
            } else if (characterClass == Classes.Mage) {
                ++desiredStats.intelligence;
            }
        }
        if (uint8(stats.class) == 0 && stats.level % 3 == 0) {
            stats.maxHp += 1;
        }
        stats.maxHp += 1;
        stats.strength = desiredStats.strength;
        stats.agility = desiredStats.agility;
        stats.intelligence = desiredStats.intelligence;
        stats.level += 1;

        // set base stats
        Characters.setBaseStats(characterId, abi.encode(stats));

        // apply equipment bonuses and set them to stat table
        _setStats(characterId, IWorld(_world()).UD__calculateEquipmentBonuses(characterId), stats.level);
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
