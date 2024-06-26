// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {
    RandomNumbers,
    Levels,
    NameExists,
    Counters,
    Stats,
    StatsData,
    Characters,
    CharactersData,
    Actions
} from "@codegen/index.sol";
import {RngRequestType, ActionType} from "@codegen/common.sol";

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
import {ResourceId, WorldResourceIdLib, WorldResourceIdInstance} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM} from "@latticexyz/world/src/worldResourceTypes.sol";
import {IWorld} from "@world/IWorld.sol";
import {IRngSystem} from "../interfaces/IRngSystem.sol";
import {LibChunks} from "../libraries/LibChunks.sol";
import "forge-std/console2.sol";
import {IEntropyConsumer} from "@pythnetwork/IEntropyConsumer.sol";
import {IEntropy} from "@pythnetwork/IEntropy.sol";
import {_erc721SystemId, _erc1155SystemId, _itemsSystemId} from "../utils.sol";
import {GOLD_NAMESPACE, CHARACTERS_NAMESPACE, WORLD_NAMESPACE, ITEMS_NAMESPACE} from "../../constants.sol";

contract CharacterSystem is System {
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

    function getPlayerEntityId(uint256 characterId) public view returns (bytes32) {
        address ownerAddress = _characterToken().ownerOf(characterId);
        return bytes32(uint256(uint160(ownerAddress)) << 88 | characterId);
    }

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
        require(!NameExists.getValue(name), "Name already exists");
        NameExists.setValue(name, true);
        Characters.setName(characterId, name);
        _setTokenURI(characterTokenId, tokenUri);
    }

    function rollStats(bytes32 userRandomNumber, bytes32 characterId, Classes class) public payable {
        require(!Characters.getLocked(characterId), "CHARACTERS: character already in game world");
        require(_isOwner(characterId), "Not your Character.");
        RngRequestType requestType = RngRequestType.CharacterStats;
        Stats.setClass(characterId, class);
        // use systemSwitch to call rng system
        SystemSwitch.call(abi.encodeCall(IRngSystem.getRng, (userRandomNumber, requestType, abi.encode(characterId))));
    }

    function enterGame(bytes32 characterId) public {
        require(_isOwner(characterId), "not your character");
        require(!Characters.getLocked(characterId), "you have entered the game");
        StatsData memory tempStats = Stats.get(characterId);
        tempStats.level = 1;
        tempStats.currentHp = int256(tempStats.baseHitPoints);
        Stats.set(characterId, tempStats);
        IWorld(_world()).UD__dropGold(characterId, 5 ether);
        // issue starter gear
        IWorld(_world()).UD__issueStarterItems(characterId);
        Characters.setLocked(characterId, true);
    }

    function getCurrentAvailableLevel(uint256 experience) public view returns (uint256 currentLevel) {
        if (experience >= Levels.get(19)) {
            currentLevel = 20;
        } else {
            for (uint256 i; i < 20;) {
                if (Levels.get(i) <= experience && Levels.get(i + 1) > experience) {
                    currentLevel = i + 1;
                    break;
                }
                {
                    i++;
                }
            }
        }
    }

    function updateTokenUri(bytes32 characterId, string memory tokenUri) public {
        require(_isOwner(characterId), "CHARACTERS: NOT AUTHORIZED");
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

    function _isOwner(bytes32 characterId) internal view returns (bool) {
        return _msgSender() == _characterToken().ownerOf(getCharacterTokenId(characterId));
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
}
