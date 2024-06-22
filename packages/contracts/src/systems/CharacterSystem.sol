// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {RandomNumbers} from "@codegen/index.sol";
import {RngRequestType} from "@codegen/common.sol";

import {UltimateDominionConfig} from "@codegen/index.sol";
import {IERC721Mintable} from "@latticexyz/world-modules/src/modules/erc721-puppet/IERC721Mintable.sol";
import {SystemSwitch} from "@latticexyz/world-modules/src/utils/SystemSwitch.sol";
import {TokenURI} from "@latticexyz/world-modules/src/modules/erc721-puppet/tables/TokenURI.sol";
import {_tokenUriTableId} from "@latticexyz/world-modules/src/modules/erc721-puppet/utils.sol";
import {IERC20System} from "@latticexyz/world-modules/src/interfaces/IERC20System.sol";
import {IItemsSystem} from "@codegen/world/IItemsSystem.sol";
import {Classes} from "@codegen/common.sol";
import {Characters, CharactersData} from "@tables/Characters.sol";
import {CharacterStats, CharacterStatsData} from "@tables/CharacterStats.sol";
import {NameExists} from "@tables/NameExists.sol";
import {Counters} from "@tables/Counters.sol";
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
    function getName(uint256 characterId) public view returns (bytes32 _name) {
        _name = Characters.getName(characterId);
    }

    function getClass(uint256 characterId) public view returns (Classes _class) {
        _class = Characters.getClass(characterId);
    }

    function _goldToken() internal view returns (IERC20System goldToken) {
        goldToken = IERC20System(UltimateDominionConfig.getGoldToken());
    }

    function _characterToken() internal view returns (IERC721Mintable characterToken) {
        characterToken = IERC721Mintable(UltimateDominionConfig.getCharacterToken());
    }

    function mintCharacter(address account, bytes32 name, string memory tokenUri)
        public
        returns (uint256 characterId)
    {
        characterId = _incrementCharacterCounter();
        // _characterToken().mint(account, characterId);
        IWorld(_world()).call(
            _erc721SystemId(CHARACTERS_NAMESPACE), abi.encodeCall(IERC721Mintable.mint, (account, characterId))
        );

        Characters.setOwner(characterId, account);

        require(!NameExists.getValue(name), "Name already exists");
        NameExists.setValue(name, true);
        Characters.setName(characterId, name);
        _setTokenURI(characterId, tokenUri);
    }

    function rollStats(bytes32 userRandomNumber, uint256 characterId, Classes class) public payable {
        require(!Characters.getLocked(characterId), "you have already accepted this character");
        require(_isOwner(characterId), "Not your Character.");
        RngRequestType requestType = RngRequestType.CharacterStats;
        Characters.setClass(characterId, class);
        // use systemSwitch to call rng system
        SystemSwitch.call(abi.encodeCall(IRngSystem.getRng, (userRandomNumber, requestType, abi.encode(characterId))));
    }

    function enterGame(uint256 characterId) public {
        require(_isOwner(characterId), "not your character");
        require(!Characters.getLocked(characterId), "you have entered the game");

        issueGold(characterId, 5 ether);
        // issue starterWeapon
        IWorld(_world()).UD__issueStarterItems(characterId);

        Characters.setLocked(characterId, true);
    }

    function _setTokenURI(uint256 tokenId, string memory tokenUri) internal {
        TokenURI.setTokenURI(_tokenUriTableId(CHARACTERS_NAMESPACE), tokenId, tokenUri);
    }

    function _incrementCharacterCounter() internal returns (uint256) {
        address characterContract = UltimateDominionConfig.getCharacterToken();
        uint256 characterCounter = Counters.getCounter(address(characterContract));
        Counters.setCounter(characterContract, (characterCounter + 1));
        return characterCounter;
    }

    function _gold() internal view returns (IERC20System gold) {
        return IERC20System(UltimateDominionConfig.getGoldToken());
    }

    function _isOwner(uint256 characterId) internal view returns (bool) {
        return _msgSender() == Characters.getOwner(characterId);
    }

    function getOwner(uint256 characterId) public view returns (address) {
        return Characters.getOwner(characterId);
    }

    function issueGold(uint256 characterId, uint256 amount) internal {
        _gold().mint(getOwner(characterId), amount);
    }

    function _charactersNamespace() internal returns (ResourceId) {
        return WorldResourceIdLib.encodeNamespace(CHARACTERS_NAMESPACE);
    }

    function getExperience(uint256 characterId) public view returns (uint256) {
        return CharacterStats.getExperience(characterId);
    }

    function getCharacterStats(uint256 characterId) public view returns (CharacterStatsData memory) {
        return CharacterStats.get(characterId);
    }
}
