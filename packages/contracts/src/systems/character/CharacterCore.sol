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
import {Classes} from "@codegen/common.sol";
import {IERC721Mintable} from "@latticexyz/world-modules/src/modules/erc721-puppet/IERC721Mintable.sol";
import {SystemSwitch} from "@latticexyz/world-modules/src/utils/SystemSwitch.sol";
import {TokenURI} from "@latticexyz/world-modules/src/modules/erc721-puppet/tables/TokenURI.sol";
import {_tokenUriTableId} from "@latticexyz/world-modules/src/modules/erc721-puppet/utils.sol";
import {IWorld} from "@world/IWorld.sol";
import {_erc721SystemId, _requireAccess} from "../../utils.sol";
import {CHARACTERS_NAMESPACE} from "../../../constants.sol";
import {UltimateDominionConfig} from "@codegen/index.sol";
import {IERC20Mintable} from "@latticexyz/world-modules/src/modules/erc20-puppet/IERC20Mintable.sol";
import "forge-std/console.sol";

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
        
        // Create character ID
        characterId = bytes32(abi.encodePacked(CHARACTERS_NAMESPACE, bytes14(uint112(tokenId))));
        
        // Mint character NFT
        IERC721Mintable characterToken = IERC721Mintable(UltimateDominionConfig.getCharacterToken());
        characterToken.mint(account, tokenId);
        
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
        
        // Character owner is stored in Characters table
        
        // Mark name as taken
        NameExists.set(name, true);
        
        console.log("CharacterCore: Minted character", uint256(characterId), "to", account);
    }

    /**
     * @dev Character entry into the game - locks character and enables gameplay
     * @param characterId The character to enter the game
     */
    function enterGame(bytes32 characterId) public onlyOwner(characterId) validCharacter(characterId) {
        CharactersData memory charData = Characters.get(characterId);
        require(!charData.locked, "CHARACTER CORE: CHARACTER ALREADY IN GAME");
        
        // Lock character for gameplay
        Characters.setLocked(characterId, true);
        
        console.log("CharacterCore: Character", uint256(characterId), "entered game");
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
        
        console.log("CharacterCore: Updated token URI for character", uint256(characterId));
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
     * @dev Get character token ID
     * @param characterId The character ID
     * @return The token ID
     */
    function getCharacterTokenId(bytes32 characterId) public view returns (uint256) {
        CharactersData memory charData = Characters.get(characterId);
        return charData.tokenId;
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
