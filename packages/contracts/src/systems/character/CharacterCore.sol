// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {
    Characters,
    CharactersData,
    NameExists,
    Counters,
    CharacterOwner
} from "@codegen/index.sol";
import {TokenURI} from "@latticexyz/world-modules/src/modules/erc721-puppet/tables/TokenURI.sol";
import {Owners as ERC721Owners} from "@latticexyz/world-modules/src/modules/erc721-puppet/tables/Owners.sol";
import {WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_TABLE} from "@latticexyz/store/src/storeResourceTypes.sol";
import {CHARACTERS_NAMESPACE, CHARACTER_TOKEN_COUNTER_KEY} from "../../../constants.sol";
import {InvalidAccount, InvalidTokenUri, NameTaken, MaxCharacters, Unauthorized} from "../../Errors.sol";
import {Balances} from "@latticexyz/world-modules/src/modules/tokens/tables/Balances.sol";
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

    function mintCharacter(address account, bytes32 name, string calldata tokenUri)
        external
        returns (bytes32 characterId)
    {
        PauseLib.requireNotPaused();
        if (account == address(0)) revert InvalidAccount();
        if (name == bytes32(0)) revert InvalidAccount();
        if (bytes(tokenUri).length == 0) revert InvalidTokenUri();
        if (NameExists.get(name)) revert NameTaken();
        if (CharacterOwner.getCharacterId(account) != bytes32(0)) revert MaxCharacters();

        uint256 tokenId = Counters.getCounter(CHARACTER_TOKEN_COUNTER_KEY, 0) + 1;
        Counters.setCounter(CHARACTER_TOKEN_COUNTER_KEY, 0, tokenId);

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

    function updateTokenUri(bytes32 characterId, string calldata tokenUri) external {
        PauseLib.requireNotPaused();
        if (Characters.getOwner(characterId) != _msgSender()) revert Unauthorized();
        if (bytes(tokenUri).length == 0) revert InvalidTokenUri();

        uint256 tokenId = Characters.getTokenId(characterId);
        TokenURI.set(_charsTokenUriTableId(), tokenId, tokenUri);
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
