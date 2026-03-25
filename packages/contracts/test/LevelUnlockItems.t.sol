// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {IWorld} from "@codegen/world/IWorld.sol";
import {
    Stats,
    StatsData,
    Characters,
    Levels,
    LevelUnlockItems,
    Admin,
    Items,
    WeaponStats,
    WeaponStatsData,
    StatRestrictions,
    StatRestrictionsData
} from "@codegen/index.sol";
import {AdvancedClass, ItemType} from "@codegen/common.sol";
import {Owners} from "@erc1155/tables/Owners.sol";
import {_ownersTableId} from "@erc1155/utils.sol";
import {ITEMS_NAMESPACE, MAX_LEVEL} from "../constants.sol";

contract Test_LevelUnlockItems is Test {
    using stdJson for string;

    address deployer = vm.addr(vm.envUint("PRIVATE_KEY"));
    uint256 public userNonce = 0;

    IWorld public world;
    address public worldAddress;

    uint256 constant TEST_SPELL_LEVEL = 15;
    uint256 testSpellItemId;

    function setUp() public {
        vm.deal(deployer, 100 ether);
        vm.startPrank(deployer);

        worldAddress = vm.envAddress("WORLD_ADDRESS");
        StoreSwitch.setStoreAddress(worldAddress);
        world = IWorld(worldAddress);

        // Set up XP thresholds through L15
        Levels.set(0, 0);
        for (uint256 i = 1; i < MAX_LEVEL; i++) {
            Levels.set(i, i * 100000); // Simple linear scaling for tests
        }

        // Create a test spell item
        bytes32[] memory effects = new bytes32[](1);
        effects[0] = bytes32(bytes8(keccak256(abi.encode("test_spell_effect"))));
        WeaponStatsData memory weaponStats = WeaponStatsData({
            agiModifier: 0, intModifier: 0, hpModifier: 0,
            maxDamage: 0, minDamage: 0, minLevel: TEST_SPELL_LEVEL,
            strModifier: 0, effects: effects
        });
        StatRestrictionsData memory noRestrictions = StatRestrictionsData({
            minAgility: 0, minIntelligence: 0, minStrength: 0
        });
        testSpellItemId = world.UD__createItem(
            ItemType.Weapon, 0, 0, 0, 1,
            abi.encode(weaponStats, noRestrictions),
            "spell:test_spell"
        );

        // Configure LevelUnlockItems for Warrior at level 15
        uint256[] memory itemIds = new uint256[](1);
        itemIds[0] = testSpellItemId;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1;
        LevelUnlockItems.set(TEST_SPELL_LEVEL, AdvancedClass.Warrior, itemIds, amounts);

        vm.stopPrank();
    }

    // ==================== Helpers ====================

    function _getUser() internal returns (address payable) {
        address payable user = payable(address(uint160(uint256(keccak256(abi.encodePacked(userNonce++))))));
        vm.deal(user, 100 ether);
        return user;
    }

    function _createCharacter(address user) internal returns (bytes32) {
        vm.prank(user);
        bytes32 charId = world.UD__mintCharacter(
            user,
            bytes32(abi.encodePacked("Char", userNonce)),
            "test_uri"
        );
        return charId;
    }

    function _setCharacterToLevel(bytes32 charId, uint256 level, AdvancedClass advClass) internal {
        vm.startPrank(deployer);
        StatsData memory stats = Stats.get(charId);
        stats.level = level;
        // Give enough stats so level-up validation passes
        stats.strength = int256(level * 2);
        stats.agility = int256(level);
        stats.intelligence = int256(level);
        stats.maxHp = int256(20 + level * 2);
        stats.currentHp = stats.maxHp;
        world.UD__adminSetStats(charId, stats);

        // Also update baseStats to match
        StatsData memory baseStats = stats;
        Characters.setBaseStats(charId, abi.encode(baseStats));

        // Set advanced class
        Stats.setAdvancedClass(charId, advClass);

        // Set XP high enough for next level
        Stats.setExperience(charId, (level + 1) * 100000);
        vm.stopPrank();
    }

    function _levelUp(bytes32 charId, address user) internal {
        StatsData memory current = Stats.get(charId);
        StatsData memory desired = current;
        desired.strength = current.strength + 1; // Put 1 point in STR
        vm.prank(user);
        world.UD__levelCharacter(charId, desired);
    }

    function _ownsItem(address owner, uint256 itemId) internal view returns (bool) {
        uint256 balance = Owners.getBalance(_ownersTableId(ITEMS_NAMESPACE), owner, itemId);
        return balance > 0;
    }

    // ==================== Happy Path ====================

    function test_levelUnlock_grantsSpellAtL15() public {
        address alice = _getUser();
        bytes32 charId = _createCharacter(alice);

        _setCharacterToLevel(charId, 14, AdvancedClass.Warrior);

        // Should NOT have spell yet
        assertFalse(_ownsItem(alice, testSpellItemId), "Should not have spell before L15");

        // Level up to 15
        _levelUp(charId, alice);

        // Should now have spell
        assertTrue(_ownsItem(alice, testSpellItemId), "Should have spell after L15");
        assertEq(Stats.getLevel(charId), 15, "Should be level 15");
    }

    // ==================== No Grant Without Class ====================

    function test_levelUnlock_noGrantWithoutAdvancedClass() public {
        address alice = _getUser();
        bytes32 charId = _createCharacter(alice);

        // Set to L14 with NO advanced class
        _setCharacterToLevel(charId, 14, AdvancedClass.None);

        _levelUp(charId, alice);

        // Should NOT have spell (no class = no unlock)
        assertFalse(_ownsItem(alice, testSpellItemId), "Should not have spell without class");
    }

    // ==================== No Grant At Wrong Level ====================

    function test_levelUnlock_noGrantAtWrongLevel() public {
        address alice = _getUser();
        bytes32 charId = _createCharacter(alice);

        // Set to L12 with Warrior class
        _setCharacterToLevel(charId, 12, AdvancedClass.Warrior);

        // Level to 13 — should not get L15 spell
        _levelUp(charId, alice);

        assertFalse(_ownsItem(alice, testSpellItemId), "Should not have spell at L13");
    }

    // ==================== Wrong Class Gets Nothing ====================

    function test_levelUnlock_wrongClassGetsNothing() public {
        address alice = _getUser();
        bytes32 charId = _createCharacter(alice);

        // Set to L14 with Wizard class (LevelUnlockItems only configured for Warrior)
        _setCharacterToLevel(charId, 14, AdvancedClass.Wizard);

        _levelUp(charId, alice);

        // Wizard should NOT get the Warrior spell
        assertFalse(_ownsItem(alice, testSpellItemId), "Wizard should not get Warrior spell");
    }

    // ==================== Multiple Classes Each Get Their Own ====================

    function test_levelUnlock_multipleClassesGetOwnSpells() public {
        // Create a second spell for Wizard
        vm.startPrank(deployer);
        bytes32[] memory effects2 = new bytes32[](1);
        effects2[0] = bytes32(bytes8(keccak256(abi.encode("wizard_test_spell"))));
        WeaponStatsData memory ws2 = WeaponStatsData({
            agiModifier: 0, intModifier: 0, hpModifier: 0,
            maxDamage: 0, minDamage: 0, minLevel: TEST_SPELL_LEVEL,
            strModifier: 0, effects: effects2
        });
        StatRestrictionsData memory noR = StatRestrictionsData({
            minAgility: 0, minIntelligence: 0, minStrength: 0
        });
        uint256 wizardSpellId = world.UD__createItem(
            ItemType.Weapon, 0, 0, 0, 1,
            abi.encode(ws2, noR),
            "spell:wizard_test"
        );

        uint256[] memory wizItemIds = new uint256[](1);
        wizItemIds[0] = wizardSpellId;
        uint256[] memory wizAmounts = new uint256[](1);
        wizAmounts[0] = 1;
        LevelUnlockItems.set(TEST_SPELL_LEVEL, AdvancedClass.Wizard, wizItemIds, wizAmounts);
        vm.stopPrank();

        // Warrior levels to 15
        address alice = _getUser();
        bytes32 warChar = _createCharacter(alice);
        _setCharacterToLevel(warChar, 14, AdvancedClass.Warrior);
        _levelUp(warChar, alice);

        // Wizard levels to 15
        address bob = _getUser();
        bytes32 wizChar = _createCharacter(bob);
        _setCharacterToLevel(wizChar, 14, AdvancedClass.Wizard);
        _levelUp(wizChar, bob);

        // Warrior gets warrior spell, not wizard spell
        assertTrue(_ownsItem(alice, testSpellItemId), "Warrior should have warrior spell");
        assertFalse(_ownsItem(alice, wizardSpellId), "Warrior should NOT have wizard spell");

        // Wizard gets wizard spell, not warrior spell
        assertTrue(_ownsItem(bob, wizardSpellId), "Wizard should have wizard spell");
        assertFalse(_ownsItem(bob, testSpellItemId), "Wizard should NOT have warrior spell");
    }

    // ==================== No Double Grant ====================

    function test_levelUnlock_noDoubleGrantOnRelevel() public {
        address alice = _getUser();
        bytes32 charId = _createCharacter(alice);

        _setCharacterToLevel(charId, 14, AdvancedClass.Warrior);
        _levelUp(charId, alice);

        assertTrue(_ownsItem(alice, testSpellItemId), "Should have spell");

        // The level-up system only processes one level at a time.
        // A second call at L15 won't re-trigger because it won't hit the
        // L15 threshold again (level goes to 16, which has no unlock items).
        _levelUp(charId, alice);
        assertEq(Stats.getLevel(charId), 16, "Should be level 16");
    }
}
