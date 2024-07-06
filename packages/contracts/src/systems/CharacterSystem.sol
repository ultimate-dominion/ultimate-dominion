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
        _class = Characters.getClass(characterId);
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
        require(!NameExists.getValue(name), "Name already exists");
        NameExists.setValue(name, true);
        Characters.setName(characterId, name);
        _setTokenURI(characterTokenId, tokenUri);
    }

    function rollStats(bytes32 userRandomNumber, bytes32 characterId, Classes class) public payable {
        require(!Characters.getLocked(characterId), "CHARACTERS: character already in game world");
        require(_isOwner(characterId), "Not your Character.");
        RngRequestType requestType = RngRequestType.CharacterStats;
        Characters.setClass(characterId, class);
        // use systemSwitch to call rng system
        SystemSwitch.call(abi.encodeCall(IRngSystem.getRng, (userRandomNumber, requestType, abi.encode(characterId))));
    }

    function enterGame(bytes32 characterId) public {
        require(_isOwner(characterId), "not your character");
        require(!Characters.getLocked(characterId), "you have entered the game");

        issueGold(characterId, 5 ether);
        // issue starterWeapon
        IWorld(_world()).UD__issueStarterItems(characterId);

        Characters.setLocked(characterId, true);
    }

    function getCurrentLevel(uint256 experience) public view returns (uint256 currentLevel) {
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
        return _msgSender() == Characters.getOwner(characterId);
    }

    function getOwner(bytes32 characterId) public view returns (address) {
        return Characters.getOwner(characterId);
    }

    function issueGold(bytes32 characterId, uint256 amount) internal {
        _gold().mint(getOwner(characterId), amount);
    }

    function getExperience(bytes32 characterId) public view returns (uint256) {
        return Stats.getExperience(characterId);
    }

    function getStats(bytes32 characterId) public view returns (StatsData memory) {
        return Stats.get(characterId);
    }
}
