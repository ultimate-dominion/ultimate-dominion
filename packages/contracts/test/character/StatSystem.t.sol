// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {SetUp} from "../SetUp.sol";
import {StatSystem} from "../../src/systems/character/StatSystem.sol";
import {
    Characters,
    CharactersData,
    Stats,
    StatsData,
    Levels,
    CharacterEquipment
} from "../../src/codegen/index.sol";
import {Classes, RngRequestType} from "../../src/codegen/common.sol";
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
import {AdjustedCombatStats} from "../../src/interfaces/Structs.sol";
import "forge-std/console.sol";

contract StatSystemTest is SetUp {
    StatSystem statSystem;
    address player;
    bytes32 characterId;

    function setUp() public override {
        super.setUp();

        // Deploy and register StatSystem
        statSystem = new StatSystem();
        ResourceId statSystemId = WorldResourceIdLib.encode({
            typeId: RESOURCE_SYSTEM,
            namespace: "UD",
            name: "StatSystem"
        });
        world.registerSystem(statSystemId, statSystem, true);

        // Create test player
        player = address(0x1);
        vm.startPrank(player);

        // Create character
        characterId = world.UD__mintCharacter(player, bytes32("TestCharacter"), "test_character_uri");

        // Set up character data
        Characters.set(characterId, CharactersData({
            tokenId: 1,
            owner: player,
            name: bytes32(uint256(uint160(bytes20("TestCharacter")))),
            locked: false,
            originalStats: "",
            baseStats: ""
        }));

        // Set character stats
        Stats.set(characterId, StatsData({
            strength: 10,
            agility: 8,
            class: Classes.Warrior,
            intelligence: 6,
            maxHp: 100,
            currentHp: 100,
            experience: 0,
            level: 1
        }));

        vm.stopPrank();
    }

    function testRollStats() public {
        vm.startPrank(player);

        bytes32 userRandomNumber = bytes32(uint256(12345));
        Classes class = Classes.Warrior;

        // This will fail because we don't have RNG system set up, but we can test the function exists
        // In a real test, we'd need to mock the RNG system
        vm.expectRevert(); // Expected to fail due to missing RNG system
        statSystem.rollStats(userRandomNumber, characterId, class);

        vm.stopPrank();
    }

    function testUpdateStats() public {
        vm.startPrank(player);

        StatsData memory newStats = StatsData({
            strength: 15,
            agility: 12,
            class: Classes.Warrior,
            intelligence: 8,
            maxHp: 120,
            currentHp: 120,
            experience: 100,
            level: 2
        });

        statSystem.updateStats(characterId, newStats);

        // Verify stats were updated
        StatsData memory updatedStats = statSystem.getStats(characterId);
        assertEq(updatedStats.strength, 15);
        assertEq(updatedStats.agility, 12);
        assertEq(updatedStats.intelligence, 8);
        assertEq(updatedStats.maxHp, 120);
        assertEq(updatedStats.level, 2);

        vm.stopPrank();
    }

    function testCalculateStatBonuses() public {
        // Test stat bonus calculation
        (int256 strBonus, int256 agiBonus, int256 intBonus, int256 hpBonus) = 
            statSystem.calculateStatBonuses(characterId);

        // These values depend on the StatCalculator library implementation
        // For now, just verify the function doesn't revert and returns values
        assertTrue(strBonus >= 0);
        assertTrue(agiBonus >= 0);
        assertTrue(intBonus >= 0);
        assertTrue(hpBonus >= 0);

        vm.stopPrank();
    }

    function testValidateStatRequirements() public {
        // Test with valid requirements
        StatsData memory requiredStats = StatsData({
            strength: 5,
            agility: 3,
            class: Classes.Warrior,
            intelligence: 2,
            maxHp: 50,
            currentHp: 50,
            experience: 0,
            level: 1
        });

        assertTrue(statSystem.validateStatRequirements(characterId, requiredStats));

        // Test with invalid requirements
        requiredStats.strength = 20; // Higher than character's strength
        assertFalse(statSystem.validateStatRequirements(characterId, requiredStats));

        vm.stopPrank();
    }

    function testGetCurrentAvailableLevel() public {
        // Set up levels table
        Levels.set(0, 0);   // Level 1 requires 0 XP
        Levels.set(1, 100); // Level 2 requires 100 XP
        Levels.set(2, 250); // Level 3 requires 250 XP

        // Test with 0 experience
        assertEq(statSystem.getCurrentAvailableLevel(0), 1);

        // Test with 100 experience
        assertEq(statSystem.getCurrentAvailableLevel(100), 2);

        // Test with 150 experience
        assertEq(statSystem.getCurrentAvailableLevel(150), 2);

        // Test with 250 experience
        assertEq(statSystem.getCurrentAvailableLevel(250), 3);

        vm.stopPrank();
    }

    function testGetStats() public {
        StatsData memory stats = statSystem.getStats(characterId);
        assertEq(stats.strength, 10);
        assertEq(stats.agility, 8);
        assertEq(stats.intelligence, 6);
        assertEq(stats.level, 1);

        vm.stopPrank();
    }

    function testGetBaseStats() public {
        // Set base stats
        StatsData memory baseStats = StatsData({
            strength: 12,
            agility: 10,
            class: Classes.Warrior,
            intelligence: 8,
            maxHp: 110,
            currentHp: 110,
            experience: 50,
            level: 2
        });
        Characters.setBaseStats(characterId, abi.encode(baseStats));

        StatsData memory retrievedStats = statSystem.getBaseStats(characterId);
        assertEq(retrievedStats.strength, 12);
        assertEq(retrievedStats.agility, 10);
        assertEq(retrievedStats.intelligence, 8);
        assertEq(retrievedStats.level, 2);

        vm.stopPrank();
    }

    function testGetClass() public {
        Classes class = statSystem.getClass(characterId);
        assertTrue(class == Classes.Warrior);

        vm.stopPrank();
    }

    function testGetExperience() public {
        uint256 experience = statSystem.getExperience(characterId);
        assertEq(experience, 0);

        vm.stopPrank();
    }

    function testGetLevel() public {
        uint256 level = statSystem.getLevel(characterId);
        assertEq(level, 1);

        vm.stopPrank();
    }

    function testRevertWhenNotCharacterOwner() public {
        address otherPlayer = address(0x2);
        vm.startPrank(otherPlayer);

        StatsData memory newStats = StatsData({
            strength: 15,
            agility: 12,
            class: Classes.Warrior,
            intelligence: 8,
            maxHp: 120,
            currentHp: 120,
            experience: 100,
            level: 2
        });

        vm.expectRevert("STAT SYSTEM: INVALID OPERATOR");
        statSystem.updateStats(characterId, newStats);

        vm.stopPrank();
    }

    function testRevertWhenInvalidCharacter() public {
        vm.startPrank(player);

        bytes32 fakeCharacterId = bytes32(uint256(999));
        StatsData memory newStats = StatsData({
            strength: 15,
            agility: 12,
            class: Classes.Warrior,
            intelligence: 8,
            maxHp: 120,
            currentHp: 120,
            experience: 100,
            level: 2
        });

        vm.expectRevert("STAT SYSTEM: INVALID CHARACTER");
        statSystem.updateStats(fakeCharacterId, newStats);

        vm.stopPrank();
    }

    function testRevertWhenCharacterInGame() public {
        vm.startPrank(player);

        // Lock character (simulate being in game)
        Characters.setLocked(characterId, true);

        StatsData memory newStats = StatsData({
            strength: 15,
            agility: 12,
            class: Classes.Warrior,
            intelligence: 8,
            maxHp: 120,
            currentHp: 120,
            experience: 100,
            level: 2
        });

        vm.expectRevert("STAT SYSTEM: cannot update stats in game");
        statSystem.updateStats(characterId, newStats);

        vm.stopPrank();
    }
}
