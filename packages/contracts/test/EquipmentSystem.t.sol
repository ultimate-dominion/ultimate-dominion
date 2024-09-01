pragma solidity >=0.8.24;

import {SetUp} from "./SetUp.sol";
import {Classes, ItemType} from "@codegen/common.sol";
import {StatsData} from "@codegen/index.sol";
import "forge-std/console.sol";
import {PuppetModule} from "@latticexyz/world-modules/src/modules/puppet/PuppetModule.sol";
import {UltimateDominionConfig, StarterItemsData} from "@codegen/index.sol";
import {UltimateDominionConfigSystem} from "@systems/UltimateDominionConfigSystem.sol";
import {ERC1155Module} from "@erc1155/ERC1155Module.sol";
import {ERC1155System} from "@erc1155/ERC1155System.sol";
import {IERC1155MetadataURI} from "@erc1155/IERC1155MetadataURI.sol";
import {IERC1155} from "@erc1155/IERC1155.sol";
import {registerERC1155} from "@erc1155/registerERC1155.sol";
import {_erc1155SystemId} from "@erc1155/utils.sol";
import {AdjustedCombatStats} from "@interfaces/Structs.sol";
import {
    WeaponStats,
    WeaponStatsData,
    ArmorStats,
    ArmorStatsData,
    StatRestrictions,
    StatRestrictionsData
} from "@codegen/index.sol";
import {ResourceIdLib} from "@latticexyz/store/src/ResourceId.sol";
import {ResourceId, WorldResourceIdLib, WorldResourceIdInstance} from "@latticexyz/world/src/WorldResourceId.sol";
import {_itemsSystemId} from "../src/utils.sol";
import {
    GOLD_NAMESPACE,
    CHARACTERS_NAMESPACE,
    ERC721_NAME,
    ERC721_SYMBOL,
    TOKEN_URI,
    ITEMS_NAMESPACE
} from "../constants.sol";
import {GasReporter} from "@latticexyz/gas-report/src/GasReporter.sol";

contract Test_EquipmentSystem is SetUp, GasReporter {
    function setUp() public virtual override {
        super.setUp();
        vm.prank(deployer);
        world.grantAccess(_itemsSystemId("UD"), address(this));
    }

    function test_equipItems() public {
        uint256[] memory itemIds = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);
        bytes32[] memory characterIds = new bytes32[](1);
        itemIds[0] = newArmorId;
        amounts[0] = 1;
        characterIds[0] = bobCharacterId;
        world.UD__dropItems(characterIds, itemIds, amounts);
        vm.startPrank(bob);
        uint256[] memory itemsToEquip = new uint256[](1);
        itemsToEquip[0] = newArmorId;
        startGasReport("equip 1 item");
        world.UD__equipItems(bobCharacterId, itemsToEquip);
        endGasReport();
        assertTrue(world.UD__isEquipped(bobCharacterId, newArmorId));
    }

    function test_equipItems_Revert_LowStr() public {
        StatRestrictionsData memory statRestrictions =
            StatRestrictionsData({minStrength: 1000, minIntelligence: 0, minAgility: 0});
        bytes32[] memory effectIds = new bytes32[](1);
        effectIds[0] = basicActionIdStatsId;
        WeaponStatsData memory weaponStats = WeaponStatsData({
            agiModifier: 0,
            hpModifier: 0,
            intModifier: 0,
            maxDamage: 4,
            minDamage: 1,
            minLevel: 0,
            strModifier: 0,
            effects: effectIds
        });
        vm.startPrank(deployer);
        uint256 firstItemId = world.UD__createItem(
            ItemType.Weapon, 10 ether, 100000000, abi.encode(weaponStats, statRestrictions), "test_Weapon_uri1/"
        );

        uint256[] memory itemIds = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);
        bytes32[] memory characterIds = new bytes32[](1);
        itemIds[0] = firstItemId;
        amounts[0] = 1;
        characterIds[0] = bobCharacterId;
        world.UD__dropItems(characterIds, itemIds, amounts);
        vm.startPrank(bob);
        uint256[] memory itemsToEquip = new uint256[](1);
        itemsToEquip[0] = firstItemId;
        vm.expectRevert();
        world.UD__equipItems(bobCharacterId, itemsToEquip);
    }

    function test_equipItems_Revert_LowAgi() public {
        StatRestrictionsData memory statRestrictions =
            StatRestrictionsData({minStrength: 0, minIntelligence: 0, minAgility: 10000});
        bytes32[] memory effectIds = new bytes32[](1);
        effectIds[0] = basicActionIdStatsId;
        WeaponStatsData memory weaponStats = WeaponStatsData({
            agiModifier: 0,
            hpModifier: 0,
            intModifier: 0,
            maxDamage: 4,
            minDamage: 1,
            minLevel: 0,
            strModifier: 0,
            effects: effectIds
        });
        vm.startPrank(deployer);
        uint256 firstItemId = world.UD__createItem(
            ItemType.Weapon, 10 ether, 100000000, abi.encode(weaponStats, statRestrictions), "test_Weapon_uri1/"
        );

        uint256[] memory itemIds = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);
        bytes32[] memory characterIds = new bytes32[](1);
        itemIds[0] = firstItemId;
        amounts[0] = 1;
        characterIds[0] = bobCharacterId;
        world.UD__dropItems(characterIds, itemIds, amounts);
        vm.startPrank(bob);
        uint256[] memory itemsToEquip = new uint256[](1);
        itemsToEquip[0] = firstItemId;
        vm.expectRevert();
        world.UD__equipItems(bobCharacterId, itemsToEquip);
    }

    function test_equipItems_Revert_LowInt() public {
        StatRestrictionsData memory statRestrictions =
            StatRestrictionsData({minStrength: 0, minIntelligence: 1000, minAgility: 0});
        bytes32[] memory effectIds = new bytes32[](1);
        effectIds[0] = basicActionIdStatsId;
        WeaponStatsData memory weaponStats = WeaponStatsData({
            agiModifier: 0,
            hpModifier: 0,
            intModifier: 0,
            maxDamage: 4,
            minDamage: 1,
            minLevel: 0,
            strModifier: 0,
            effects: effectIds
        });
        vm.startPrank(deployer);
        uint256 firstItemId = world.UD__createItem(
            ItemType.Weapon, 10 ether, 100000000, abi.encode(weaponStats, statRestrictions), "test_Weapon_uri1/"
        );

        uint256[] memory itemIds = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);
        bytes32[] memory characterIds = new bytes32[](1);
        itemIds[0] = firstItemId;
        amounts[0] = 1;
        characterIds[0] = bobCharacterId;
        world.UD__dropItems(characterIds, itemIds, amounts);
        vm.startPrank(bob);
        uint256[] memory itemsToEquip = new uint256[](1);
        itemsToEquip[0] = firstItemId;
        vm.expectRevert();
        world.UD__equipItems(bobCharacterId, itemsToEquip);
    }

    function test_equipItems_Revert_LowLvl() public {
        StatRestrictionsData memory statRestrictions =
            StatRestrictionsData({minStrength: 0, minIntelligence: 0, minAgility: 0});
        bytes32[] memory effectIds = new bytes32[](1);
        effectIds[0] = basicActionIdStatsId;
        WeaponStatsData memory weaponStats = WeaponStatsData({
            agiModifier: 0,
            hpModifier: 0,
            intModifier: 0,
            maxDamage: 4,
            minDamage: 1,
            minLevel: 10,
            strModifier: 0,
            effects: effectIds
        });
        vm.startPrank(deployer);
        uint256 firstItemId = world.UD__createItem(
            ItemType.Weapon, 10 ether, 100000000, abi.encode(weaponStats, statRestrictions), "test_Weapon_uri1/"
        );

        uint256[] memory itemIds = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);
        bytes32[] memory characterIds = new bytes32[](1);
        itemIds[0] = firstItemId;
        amounts[0] = 1;
        characterIds[0] = bobCharacterId;
        world.UD__dropItems(characterIds, itemIds, amounts);
        vm.startPrank(bob);
        uint256[] memory itemsToEquip = new uint256[](1);
        itemsToEquip[0] = firstItemId;
        vm.expectRevert();
        world.UD__equipItems(bobCharacterId, itemsToEquip);
    }

    function test_calculateEquipmentBonuses() public {
        uint256[] memory itemIds = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);
        bytes32[] memory characterIds = new bytes32[](1);
        itemIds[0] = newArmorId;
        amounts[0] = 1;
        characterIds[0] = bobCharacterId;
        world.UD__dropItems(characterIds, itemIds, amounts);

        vm.startPrank(bob);
        uint256[] memory itemsToEquip = new uint256[](1);
        itemsToEquip[0] = newArmorId;

        ArmorStatsData memory itemStats = world.UD__getArmorStats(newArmorId);
        AdjustedCombatStats memory baseStats = world.UD__getCombatStats(bobCharacterId);

        world.UD__equipItems(bobCharacterId, itemsToEquip);

        startGasReport("apply stat bonuses");
        AdjustedCombatStats memory modifiedStats = world.UD__calculateEquipmentBonuses(bobCharacterId);
        endGasReport();
        ArmorStatsData memory armorStats = world.UD__getArmorStats(newArmorId);
        assertTrue(world.UD__isEquipped(bobCharacterId, newArmorId));

        assertEq(modifiedStats.strength, int256(baseStats.strength) + armorStats.strModifier);
        assertEq(modifiedStats.agility, int256(baseStats.agility) + armorStats.agiModifier);
        assertEq(modifiedStats.intelligence, int256(baseStats.intelligence) + armorStats.intModifier);
        assertEq(modifiedStats.maxHp, int256(baseStats.maxHp) + armorStats.hpModifier);
    }

    function test_unequipItem() public {
        uint256 fees = entropy.getFee(address(1));
        vm.startPrank(alice);
        world.UD__rollStats{value: fees}(alicesRandomness, alicesCharacterId, Classes.Rogue);
        world.UD__enterGame(alicesCharacterId);
        StarterItemsData memory starterDat = world.UD__getStarterItems(Classes.Rogue);

        world.UD__equipItems(alicesCharacterId, starterDat.itemIds);
        AdjustedCombatStats memory equippedStats = world.UD__getCombatStats(alicesCharacterId);
        assertEq(equippedStats.armor, 1);
        assertTrue(world.UD__isEquipped(alicesCharacterId, starterDat.itemIds[0]));
        startGasReport("uneqip 1 item");
        world.UD__unequipItem(alicesCharacterId, starterDat.itemIds[0]);

        endGasReport();
        AdjustedCombatStats memory unEquippedStats = world.UD__getCombatStats(alicesCharacterId);
        assertFalse(world.UD__isEquipped(alicesCharacterId, starterDat.itemIds[0]));
        assertEq(unEquippedStats.armor, 0);
    }
}
