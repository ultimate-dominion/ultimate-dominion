pragma solidity >=0.8.24;

import {SetUp} from "./SetUp.sol";
import {Classes, ItemType} from "@codegen/common.sol";
<<<<<<< Updated upstream
import {StatsData} from "@codegen/index.sol";
=======
<<<<<<< Updated upstream
import {StatsData} from "@tables/Stats.sol";
>>>>>>> Stashed changes
import "forge-std/console2.sol";
=======
import {StatsData} from "@codegen/index.sol";
import "forge-std/console.sol";
>>>>>>> Stashed changes
import {PuppetModule} from "@latticexyz/world-modules/src/modules/puppet/PuppetModule.sol";
import {UltimateDominionConfig, StarterItemsData} from "@codegen/index.sol";
import {UltimateDominionConfigSystem} from "@systems/UltimateDominionConfigSystem.sol";
import {ERC1155Module} from "@erc1155/ERC1155Module.sol";
import {ERC1155System} from "@erc1155/ERC1155System.sol";
import {IERC1155MetadataURI} from "@erc1155/IERC1155MetadataURI.sol";
import {IERC1155} from "@erc1155/IERC1155.sol";
import {registerERC1155} from "@erc1155/registerERC1155.sol";
import {_erc1155SystemId} from "@erc1155/utils.sol";
import {WeaponStats, ArmorStats, AdjustedCombatStats} from "@interfaces/Structs.sol";
import {ResourceIdLib} from "@latticexyz/store/src/ResourceId.sol";
import {ResourceId, WorldResourceIdLib, WorldResourceIdInstance} from "@latticexyz/world/src/WorldResourceId.sol";
import {_itemsSystemId} from "../src/utils.sol";
import {StatRestrictions} from "@interfaces/Structs.sol";
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
        StatRestrictions memory statRestrictions =
            StatRestrictions({minStrength: 1000, minIntelligence: 0, minAgility: 0});
        WeaponStats memory weaponStats = WeaponStats({
            agiModifier: 0,
            statRestrictions: statRestrictions,
            hitPointModifier: 0,
            intModifier: 0,
            maxDamage: 4,
            minDamage: 1,
            minLevel: 0,
            strModifier: 0
        });
        vm.startPrank(deployer);
        uint256 firstItemId =
            world.UD__createItem(ItemType.Weapon, 10 ether, 100000000, abi.encode(weaponStats), "test_Weapon_uri1/");

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
        StatRestrictions memory statRestrictions =
            StatRestrictions({minStrength: 0, minIntelligence: 0, minAgility: 10000});
        WeaponStats memory weaponStats = WeaponStats({
            agiModifier: 0,
            statRestrictions: statRestrictions,
            hitPointModifier: 0,
            intModifier: 0,
            maxDamage: 4,
            minDamage: 1,
            minLevel: 0,
            strModifier: 0
        });
        vm.startPrank(deployer);
        uint256 firstItemId =
            world.UD__createItem(ItemType.Weapon, 10 ether, 100000000, abi.encode(weaponStats), "test_Weapon_uri1/");

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
        StatRestrictions memory statRestrictions =
            StatRestrictions({minStrength: 0, minIntelligence: 1000, minAgility: 0});
        WeaponStats memory weaponStats = WeaponStats({
            agiModifier: 0,
            statRestrictions: statRestrictions,
            hitPointModifier: 0,
            intModifier: 0,
            maxDamage: 4,
            minDamage: 1,
            minLevel: 0,
            strModifier: 0
        });
        vm.startPrank(deployer);
        uint256 firstItemId =
            world.UD__createItem(ItemType.Weapon, 10 ether, 100000000, abi.encode(weaponStats), "test_Weapon_uri1/");

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
        StatRestrictions memory statRestrictions = StatRestrictions({minStrength: 0, minIntelligence: 0, minAgility: 0});
        WeaponStats memory weaponStats = WeaponStats({
            agiModifier: 0,
            statRestrictions: statRestrictions,
            hitPointModifier: 0,
            intModifier: 0,
            maxDamage: 4,
            minDamage: 1,
            minLevel: 10,
            strModifier: 0
        });
        vm.startPrank(deployer);
        uint256 firstItemId =
            world.UD__createItem(ItemType.Weapon, 10 ether, 100000000, abi.encode(weaponStats), "test_Weapon_uri1/");

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

    function test_applyEquipmentBonuses() public {
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

        ArmorStats memory itemStats = world.UD__getArmorStats(newArmorId);
        StatsData memory baseStats = world.UD__getStats(bobCharacterId);

        world.UD__equipItems(bobCharacterId, itemsToEquip);

        startGasReport("apply stat bonuses");
        AdjustedCombatStats memory modifiedStats = world.UD__applyEquipmentBonuses(bobCharacterId);
        endGasReport();
        ArmorStats memory armorStats = world.UD__getArmorStats(newArmorId);
        assertTrue(world.UD__isEquipped(bobCharacterId, newArmorId));

        assertEq(modifiedStats.adjustedStrength, uint256(int256(baseStats.strength) + armorStats.strModifier));
        assertEq(modifiedStats.adjustedAgility, uint256(int256(baseStats.agility) + armorStats.agiModifier));
        assertEq(modifiedStats.adjustedIntelligence, uint256(int256(baseStats.intelligence) + armorStats.intModifier));
        assertEq(modifiedStats.adjustedMaxHp, uint256(int256(baseStats.baseHp) + armorStats.hitPointModifier));
    }

    function test_unequipItem() public {
        uint256 fees = entropy.getFee(address(1));
        vm.startPrank(alice);
        world.UD__rollStats{value: fees}(alicesRandomness, alicesCharacterId, Classes.Rogue);
        world.UD__enterGame(alicesCharacterId);
        StarterItemsData memory starterDat = world.UD__getStarterItems(Classes.Rogue);

        world.UD__equipItems(alicesCharacterId, starterDat.itemIds);
        assertTrue(world.UD__isEquipped(alicesCharacterId, starterDat.itemIds[0]));
        startGasReport("uneqip 1 item");
        world.UD__unequipItem(alicesCharacterId, starterDat.itemIds[0]);
        endGasReport();
        assertFalse(world.UD__isEquipped(alicesCharacterId, starterDat.itemIds[0]));
    }
}
