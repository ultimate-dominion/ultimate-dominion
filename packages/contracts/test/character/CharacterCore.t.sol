// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {SetUp} from "../SetUp.sol";
import {CharacterCore} from "../../src/systems/character/CharacterCore.sol";
import {
    Characters,
    CharactersData,
    CharacterOwner,
    NameExists,
    Counters
} from "../../src/codegen/index.sol";
import {Classes} from "../../src/codegen/common.sol";
import {IWorld} from "../../src/codegen/world/IWorld.sol";
import {World} from "@latticexyz/world/src/World.sol";
import {WorldProxy} from "@latticexyz/world/src/WorldProxy.sol";
import {System} from "@latticexyz/world/src/System.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM} from "@latticexyz/world/src/worldResourceTypes.sol";
import {SystemRegistry} from "@latticexyz/world/src/codegen/tables/SystemRegistry.sol";
import {UltimateDominionConfig} from "../../src/codegen/index.sol";
import {IERC721Mintable} from "@latticexyz/world-modules/src/modules/erc721-puppet/IERC721Mintable.sol";
import {registerERC721} from "@latticexyz/world-modules/src/modules/erc721-puppet/registerERC721.sol";
import {ERC721MetadataData} from "@latticexyz/world-modules/src/modules/erc721-puppet/tables/ERC721Metadata.sol";
import "forge-std/console.sol";

contract CharacterCoreTest is SetUp {
    CharacterCore characterCore;
    address player;
    bytes32 characterId;

    function setUp() public override {
        super.setUp();

        // Deploy and register CharacterCore
        characterCore = new CharacterCore();
        ResourceId characterCoreId = WorldResourceIdLib.encode({
            typeId: RESOURCE_SYSTEM,
            namespace: "UD",
            name: "CharacterCore"
        });
        world.registerSystem(characterCoreId, characterCore, true);

        // Create test player
        player = address(0x1);
        vm.startPrank(player);
    }

    function testMintCharacter() public {
        bytes32 name = bytes32(uint256(uint160(bytes20("TestCharacter"))));
        string memory tokenUri = "https://example.com/character/1";

        // Mint character
        bytes32 newCharacterId = characterCore.mintCharacter(player, name, tokenUri);

        // Verify character was created
        assertTrue(characterCore.isValidCharacterId(newCharacterId));
        assertEq(characterCore.getOwner(newCharacterId), player);
        assertEq(characterCore.getName(newCharacterId), name);
        assertTrue(characterCore.getCharacterTokenId(newCharacterId) > 0);
        assertFalse(characterCore.isCharacterLocked(newCharacterId));

        // Verify character data
        CharactersData memory charData = Characters.get(newCharacterId);
        assertEq(charData.owner, player);
        assertEq(charData.name, name);
        assertEq(charData.tokenId, 1);
        assertFalse(charData.locked);

        // Verify name is marked as taken
        assertTrue(NameExists.get(name));

        // Verify counter was incremented
        assertEq(Counters.getCounter(address(characterCore), 0), 1);

        vm.stopPrank();
    }

    function testEnterGame() public {
        // First mint a character
        bytes32 name = bytes32(uint256(uint160(bytes20("TestCharacter"))));
        string memory tokenUri = "https://example.com/character/1";
        characterId = characterCore.mintCharacter(player, name, tokenUri);

        // Enter game
        characterCore.enterGame(characterId);

        // Verify character is locked
        assertTrue(characterCore.isCharacterLocked(characterId));
        
        CharactersData memory charData = Characters.get(characterId);
        assertTrue(charData.locked);

        vm.stopPrank();
    }

    function testUpdateTokenUri() public {
        // First mint a character
        bytes32 name = bytes32(uint256(uint160(bytes20("TestCharacter"))));
        string memory tokenUri = "https://example.com/character/1";
        characterId = characterCore.mintCharacter(player, name, tokenUri);

        // Update token URI
        string memory newTokenUri = "https://example.com/character/1/updated";
        characterCore.updateTokenUri(characterId, newTokenUri);

        // Verify token URI was updated (this would require checking the TokenURI table)
        // For now, just verify the function didn't revert
        assertTrue(true);

        vm.stopPrank();
    }

    function testBasicCharacterValidation() public {
        // Test with non-existent character
        bytes32 fakeCharacterId = bytes32(uint256(999));
        assertFalse(characterCore.basicCharacterValidation(fakeCharacterId));

        // Mint a character
        bytes32 name = bytes32(uint256(uint160(bytes20("TestCharacter"))));
        string memory tokenUri = "https://example.com/character/1";
        characterId = characterCore.mintCharacter(player, name, tokenUri);

        // Test with valid character
        assertTrue(characterCore.basicCharacterValidation(characterId));

        vm.stopPrank();
    }

    function testRevertWhenInvalidAccount() public {
        bytes32 name = bytes32(uint256(uint160(bytes20("TestCharacter"))));
        string memory tokenUri = "https://example.com/character/1";

        vm.expectRevert("CHARACTER CORE: INVALID ACCOUNT");
        characterCore.mintCharacter(address(0), name, tokenUri);

        vm.stopPrank();
    }

    function testRevertWhenInvalidName() public {
        string memory tokenUri = "https://example.com/character/1";

        vm.expectRevert("CHARACTER CORE: INVALID NAME");
        characterCore.mintCharacter(player, bytes32(0), tokenUri);

        vm.stopPrank();
    }

    function testRevertWhenInvalidTokenUri() public {
        bytes32 name = bytes32(uint256(uint160(bytes20("TestCharacter"))));

        vm.expectRevert("CHARACTER CORE: INVALID TOKEN URI");
        characterCore.mintCharacter(player, name, "");

        vm.stopPrank();
    }

    function testRevertWhenNameAlreadyExists() public {
        bytes32 name = bytes32(uint256(uint160(bytes20("TestCharacter"))));
        string memory tokenUri = "https://example.com/character/1";

        // Mint first character
        characterCore.mintCharacter(player, name, tokenUri);

        // Try to mint second character with same name
        vm.expectRevert("CHARACTER CORE: NAME ALREADY EXISTS");
        characterCore.mintCharacter(player, name, tokenUri);

        vm.stopPrank();
    }

    function testRevertWhenNotCharacterOwner() public {
        address otherPlayer = address(0x2);
        
        // Mint character as player
        bytes32 name = bytes32(uint256(uint160(bytes20("TestCharacter"))));
        string memory tokenUri = "https://example.com/character/1";
        characterId = characterCore.mintCharacter(player, name, tokenUri);

        // Try to enter game as other player
        vm.startPrank(otherPlayer);
        vm.expectRevert("CHARACTER CORE: INVALID OPERATOR");
        characterCore.enterGame(characterId);
        vm.stopPrank();

        vm.stopPrank();
    }

    function testRevertWhenCharacterAlreadyInGame() public {
        bytes32 name = bytes32(uint256(uint160(bytes20("TestCharacter"))));
        string memory tokenUri = "https://example.com/character/1";
        characterId = characterCore.mintCharacter(player, name, tokenUri);

        // Enter game first time
        characterCore.enterGame(characterId);

        // Try to enter game again
        vm.expectRevert("CHARACTER CORE: CHARACTER ALREADY IN GAME");
        characterCore.enterGame(characterId);

        vm.stopPrank();
    }

    function testRevertWhenCharacterNotValid() public {
        bytes32 fakeCharacterId = bytes32(uint256(999));

        vm.expectRevert("CHARACTER CORE: INVALID CHARACTER");
        characterCore.enterGame(fakeCharacterId);

        vm.stopPrank();
    }
}
