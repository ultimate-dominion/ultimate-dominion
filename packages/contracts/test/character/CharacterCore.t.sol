// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {SetUp} from "../SetUp.sol";
import {CharacterCore} from "../../src/systems/character/CharacterCore.sol";
import {CharacterEnterSystem} from "../../src/systems/character/CharacterEnterSystem.sol";
import {
    Characters,
    CharactersData,
    CharacterOwner,
    NameExists,
    Counters,
    Stats,
    StatsData
} from "../../src/codegen/index.sol";
import {Race, PowerSource} from "../../src/codegen/common.sol";
import {IWorld} from "../../src/codegen/world/IWorld.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM} from "@latticexyz/world/src/worldResourceTypes.sol";
import "forge-std/console.sol";

contract CharacterCoreTest is SetUp {
    CharacterCore characterCore;
    CharacterEnterSystem characterEnterSystem;
    address player;
    bytes32 characterId;

    function _prepareForEnterGame(bytes32 preparedCharacterId) internal {
        StatsData memory stats = Stats.get(preparedCharacterId);
        stats.strength = 7;
        stats.agility = 6;
        stats.intelligence = 6;
        stats.maxHp = 18;
        stats.race = Race.Human;
        stats.powerSource = PowerSource.Physical;
        Stats.set(preparedCharacterId, stats);
    }

    function setUp() public override {
        super.setUp();

        // Deploy and register CharacterCore
        characterCore = new CharacterCore();
        ResourceId characterCoreId =
            WorldResourceIdLib.encode({typeId: RESOURCE_SYSTEM, namespace: "UD", name: "CharacterCore"});
        world.registerSystem(characterCoreId, characterCore, true);

        // Deploy and register CharacterEnterSystem
        characterEnterSystem = new CharacterEnterSystem();
        ResourceId characterEnterId =
            WorldResourceIdLib.encode({typeId: RESOURCE_SYSTEM, namespace: "UD", name: "CharEnterSys"});
        world.registerSystem(characterEnterId, characterEnterSystem, true);

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
        assertEq(Characters.getName(newCharacterId), name);
        assertTrue(uint256(uint96(uint256(newCharacterId))) > 0);
        assertFalse(Characters.getLocked(newCharacterId));

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
        _prepareForEnterGame(characterId);

        // Enter game
        characterEnterSystem.enterGame(characterId, newWeaponId, newArmorId);

        // Verify character is locked
        assertTrue(Characters.getLocked(characterId));

        CharactersData memory charData = Characters.get(characterId);
        assertTrue(charData.locked);

        vm.stopPrank();
    }

    function testIsValidCharacterId() public {
        // Test with non-existent character
        bytes32 fakeCharacterId = bytes32(uint256(999));
        assertFalse(characterCore.isValidCharacterId(fakeCharacterId));

        // Mint a character
        bytes32 name = bytes32(uint256(uint160(bytes20("TestCharacter"))));
        string memory tokenUri = "https://example.com/character/1";
        characterId = characterCore.mintCharacter(player, name, tokenUri);

        // Test with valid character
        assertTrue(characterCore.isValidCharacterId(characterId));

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
        vm.expectRevert();
        characterEnterSystem.enterGame(characterId, newWeaponId, newArmorId);
        vm.stopPrank();

        vm.stopPrank();
    }

    function testRevertWhenCharacterAlreadyInGame() public {
        bytes32 name = bytes32(uint256(uint160(bytes20("TestCharacter"))));
        string memory tokenUri = "https://example.com/character/1";
        characterId = characterCore.mintCharacter(player, name, tokenUri);
        _prepareForEnterGame(characterId);

        // Enter game first time
        characterEnterSystem.enterGame(characterId, newWeaponId, newArmorId);

        // Try to enter game again
        vm.expectRevert();
        characterEnterSystem.enterGame(characterId, newWeaponId, newArmorId);

        vm.stopPrank();
    }
}
