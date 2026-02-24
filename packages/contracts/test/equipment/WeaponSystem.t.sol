// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {SetUp} from "../SetUp.sol";
import {WeaponSystem} from "../../src/systems/equipment/WeaponSystem.sol";
import {
    Characters,
    CharactersData,
    Stats,
    StatsData,
    CharacterEquipment,
    CharacterEquipmentData,
    Items,
    ItemsData,
    WeaponStats,
    WeaponStatsData,
    StatRestrictions,
    StatRestrictionsData
} from "../../src/codegen/index.sol";
import {ItemType, Classes, PowerSource, Race, ArmorType, AdvancedClass} from "../../src/codegen/common.sol";
import {_itemsSystemId} from "../../src/utils.sol";
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
import {IERC1155System} from "@erc1155/IERC1155System.sol";
import {registerERC1155} from "@erc1155/registerERC1155.sol";
import {Owners} from "@erc1155/tables/Owners.sol";
import {TotalSupply} from "@erc1155/tables/TotalSupply.sol";
import {ERC1155URIStorage} from "@erc1155/tables/ERC1155URIStorage.sol";
import {ERC1155MetadataURI} from "@erc1155/tables/ERC1155MetadataURI.sol";
import {ERC1155Module} from "@erc1155/ERC1155Module.sol";
import "forge-std/console.sol";

contract WeaponSystemTest is SetUp {
    WeaponSystem weaponSystem;
    address player;
    bytes32 characterId;
    uint256 weaponId;

    function setUp() public override {
        super.setUp();
        
        // Deploy and register WeaponSystem
        weaponSystem = new WeaponSystem();
        ResourceId weaponSystemId = WorldResourceIdLib.encode({
            typeId: RESOURCE_SYSTEM,
            namespace: "UD",
            name: "WeaponSystem"
        });
        world.registerSystem(weaponSystemId, weaponSystem, true);

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
            locked: true,
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
            level: 5,
            powerSource: PowerSource.None,
            race: Race.None,
            startingArmor: ArmorType.None,
            advancedClass: AdvancedClass.None,
            hasSelectedAdvancedClass: false
        }));

        // Create test weapon
        weaponId = 1;
        Items.set(weaponId, ItemsData({
            itemType: ItemType.Weapon,
            dropChance: 1000,
            price: 100,
            stats: ""
        }));

        WeaponStats.set(weaponId, WeaponStatsData({
            agiModifier: 2,
            intModifier: 0,
            hpModifier: 10,
            maxDamage: 20,
            minDamage: 10,
            minLevel: 1,
            strModifier: 5,
            effects: new bytes32[](0)
        }));

        StatRestrictions.set(weaponId, StatRestrictionsData({
            minStrength: 5,
            minAgility: 3,
            minIntelligence: 0
        }));

        // Mint weapon to player
        erc1155System.mint(player, weaponId, 1, "");

        vm.stopPrank();
    }

    function testEquipWeapon() public {
        vm.startPrank(player);
        
        // Equip weapon
        weaponSystem.equipWeapon(characterId, weaponId);
        
        // Check weapon is equipped
        assertTrue(weaponSystem.isWeaponEquipped(characterId, weaponId));
        
        // Check equipped weapons
        uint256[] memory equippedWeapons = weaponSystem.getEquippedWeapons(characterId);
        assertEq(equippedWeapons.length, 1);
        assertEq(equippedWeapons[0], weaponId);
        
        vm.stopPrank();
    }

    function testUnequipWeapon() public {
        vm.startPrank(player);
        
        // Equip weapon first
        weaponSystem.equipWeapon(characterId, weaponId);
        assertTrue(weaponSystem.isWeaponEquipped(characterId, weaponId));
        
        // Unequip weapon
        bool success = weaponSystem.unequipWeapon(characterId, weaponId);
        assertTrue(success);
        
        // Check weapon is not equipped
        assertFalse(weaponSystem.isWeaponEquipped(characterId, weaponId));
        
        // Check no weapons equipped
        uint256[] memory equippedWeapons = weaponSystem.getEquippedWeapons(characterId);
        assertEq(equippedWeapons.length, 0);
        
        vm.stopPrank();
    }

    function testCheckWeaponRequirements() public {
        // Test valid requirements
        assertTrue(weaponSystem.checkWeaponRequirements(characterId, weaponId));
        
        // Test invalid level requirement
        WeaponStats.set(weaponId, WeaponStatsData({
            agiModifier: 2,
            intModifier: 0,
            hpModifier: 10,
            maxDamage: 20,
            minDamage: 10,
            minLevel: 10, // Higher than character level
            strModifier: 5,
            effects: new bytes32[](0)
        }));
        assertFalse(weaponSystem.checkWeaponRequirements(characterId, weaponId));
        
        // Reset weapon stats
        WeaponStats.set(weaponId, WeaponStatsData({
            agiModifier: 2,
            intModifier: 0,
            hpModifier: 10,
            maxDamage: 20,
            minDamage: 10,
            minLevel: 1,
            strModifier: 5,
            effects: new bytes32[](0)
        }));
        
        // Test invalid stat requirements
        StatRestrictions.set(weaponId, StatRestrictionsData({
            minStrength: 15, // Higher than character strength
            minAgility: 3,
            minIntelligence: 0
        }));
        assertFalse(weaponSystem.checkWeaponRequirements(characterId, weaponId));
    }

    function testGetWeaponStats() public {
        WeaponStatsData memory stats = weaponSystem.getWeaponStatsData(weaponId);
        assertEq(stats.minLevel, 1);
        assertEq(stats.strModifier, 5);
        assertEq(stats.agiModifier, 2);
        assertEq(stats.intModifier, 0);
        assertEq(stats.hpModifier, 10);
    }

    function testCanEquipMoreWeapons() public {
        // Initially can equip weapons
        assertTrue(weaponSystem.canEquipMoreWeapons(characterId));
        
        // Equip weapon
        vm.startPrank(player);
        weaponSystem.equipWeapon(characterId, weaponId);
        vm.stopPrank();
        
        // Still can equip more (limit is 4 total items)
        assertTrue(weaponSystem.canEquipMoreWeapons(characterId));
    }

    function testCalculateWeaponBonuses() public {
        vm.startPrank(player);
        
        // Equip weapon
        weaponSystem.equipWeapon(characterId, weaponId);
        
        // Calculate bonuses
        CharacterEquipmentData memory bonuses = weaponSystem.calculateWeaponBonuses(characterId);
        assertEq(bonuses.strBonus, 5);
        assertEq(bonuses.agiBonus, 2);
        assertEq(bonuses.intBonus, 0);
        assertEq(bonuses.hpBonus, 10);
        
        vm.stopPrank();
    }

    function testWeaponEffects() public {
        // Add effects to weapon
        bytes32[] memory effects = new bytes32[](2);
        effects[0] = bytes32(uint256(1));
        effects[1] = bytes32(uint256(2));
        
        WeaponStats.set(weaponId, WeaponStatsData({
            agiModifier: 2,
            intModifier: 0,
            hpModifier: 10,
            maxDamage: 20,
            minDamage: 10,
            minLevel: 1,
            strModifier: 5,
            effects: effects
        }));
        
        // Check specific effect
        assertTrue(weaponSystem.checkWeaponEffect(weaponId, bytes32(uint256(1))));
        assertFalse(weaponSystem.checkWeaponEffect(weaponId, bytes32(uint256(3))));
        
        // Get all effects
        bytes32[] memory weaponEffects = weaponSystem.getWeaponEffects(weaponId);
        assertEq(weaponEffects.length, 2);
        assertEq(weaponEffects[0], bytes32(uint256(1)));
        assertEq(weaponEffects[1], bytes32(uint256(2)));
    }

    function testRevertWhenNotCharacterOwner() public {
        vm.startPrank(address(0x2)); // Different address
        
        vm.expectRevert("WEAPON: Not Character Owner");
        weaponSystem.equipWeapon(characterId, weaponId);
        
        vm.stopPrank();
    }

    function testRevertWhenNotItemOwner() public {
        vm.startPrank(player);
        
        // Create weapon owned by different player
        uint256 otherWeaponId = 2;
        Items.set(otherWeaponId, ItemsData({
            itemType: ItemType.Weapon,
            dropChance: 1000,
            price: 100,
            stats: ""
        }));
        
        vm.expectRevert("WEAPON: Not Item Owner");
        weaponSystem.equipWeapon(characterId, otherWeaponId);
        
        vm.stopPrank();
    }

    function testRevertWhenNotAWeapon() public {
        vm.startPrank(player);
        
        // Create non-weapon item
        uint256 armorId = 3;
        Items.set(armorId, ItemsData({
            itemType: ItemType.Armor,
            dropChance: 1000,
            price: 100,
            stats: ""
        }));
        
        vm.expectRevert("WEAPON: Not a weapon");
        weaponSystem.equipWeapon(characterId, armorId);
        
        vm.stopPrank();
    }

}
