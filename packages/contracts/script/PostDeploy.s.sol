// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";
import { StoreSwitch } from "@latticexyz/store/src/StoreSwitch.sol";
import { StoreCore, EncodedLengths } from "@latticexyz/store/src/StoreCore.sol";
import { MockEntropy } from "@test/mocks/MockEntropy.sol";
import { PuppetModule } from "@latticexyz/world-modules/src/modules/puppet/PuppetModule.sol";
import { Systems } from "@latticexyz/world/src/codegen/tables/Systems.sol";
import { IWorld } from "@world/IWorld.sol";
import { UltimateDominionConfig, Levels, MapConfig } from "@codegen/index.sol";
import { ResourceIdLib } from "@latticexyz/store/src/ResourceId.sol";
import { ResourceId, WorldResourceIdLib, WorldResourceIdInstance } from "@latticexyz/world/src/WorldResourceId.sol";
import { RESOURCE_SYSTEM } from "@latticexyz/world/src/worldResourceTypes.sol";
import { RngSystem } from "../src/systems/RngSystem.sol";
import { IERC721Mintable } from "@latticexyz/world-modules/src/modules/erc721-puppet/IERC721Mintable.sol";
import { registerERC721 } from "@latticexyz/world-modules/src/modules/erc721-puppet/registerERC721.sol";
import { ERC721System } from "@latticexyz/world-modules/src/modules/erc721-puppet/ERC721System.sol";
import { ERC721MetadataData } from "@latticexyz/world-modules/src/modules/erc721-puppet/tables/ERC721Metadata.sol";
import { GOLD_NAMESPACE, CHARACTERS_NAMESPACE, ERC721_NAME, ERC721_SYMBOL, ITEMS_NAMESPACE, TOKEN_URI } from "../constants.sol";
import { NoTransferHook } from "../src/NoTransferHook.sol";
import { BEFORE_CALL_SYSTEM } from "@latticexyz/world/src/systemHookTypes.sol";
import { Classes, ItemType, MobType } from "@codegen/common.sol";
import { WeaponStats, MonsterStats, MonsterTemplateDetails, WeaponTemplateDetails } from "@interfaces/Structs.sol";
import { IERC20Mintable } from "@latticexyz/world-modules/src/modules/erc20-puppet/IERC20Mintable.sol";
import { ERC20MetadataData } from "@latticexyz/world-modules/src/modules/erc20-puppet/tables/ERC20Metadata.sol";
import { ERC20System } from "@latticexyz/world-modules/src/modules/erc20-puppet/ERC20System.sol";
import { registerERC20 } from "@latticexyz/world-modules/src/modules/erc20-puppet/registerERC20.sol";
import { System } from "@latticexyz/world/src/System.sol";
import { CharacterSystem } from "../src/systems/CharacterSystem.sol";

import {ERC1155Module} from "@erc1155/ERC1155Module.sol";
import {ERC1155System} from "@erc1155/ERC1155System.sol";
import {IERC1155} from "@erc1155/IERC1155.sol";
import {registerERC1155} from "@erc1155/registerERC1155.sol";
import {_erc1155SystemId} from "@erc1155/utils.sol";

import "forge-std/console2.sol";
import "forge-std/StdJson.sol";

struct ResourceIds {
  ResourceId erc721SystemId;
  ResourceId erc721NamespaceId;
  ResourceId characterSystemId;
  ResourceId erc20SystemId;
  ResourceId erc20NamespaceId;
  ResourceId rngSystemId;
  ResourceId erc1155SystemId;
  ResourceId erc1155NamespaceId;
  ResourceId itemsSystemId;
  ResourceId combatSystemId;
}

contract PostDeploy is Script {
  using stdJson for string;

  IWorld public world;
  ResourceIds public resourceIds;
  address public worldAddress;

  function run(address _worldAddress) external {
    worldAddress = _worldAddress;
    world = IWorld(worldAddress);
    // Specify a store so that you can use tables directly in PostDeploy
    StoreSwitch.setStoreAddress(worldAddress);

    // Load the private key from the `PRIVATE_KEY` environment variable (in .env)
    uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Start broadcasting transactions from the deployer account
        vm.startBroadcast(deployerPrivateKey);
        if (block.chainid == 31337) {
            // Set entropy contracts
            address mockEntropy = address(new MockEntropy());
            UltimateDominionConfig.setEntropy(mockEntropy);
            UltimateDominionConfig.setPythProvider(address(1));
        } else if (block.chainid == 84532) {
            UltimateDominionConfig.setEntropy(0x41c9e39574F40Ad34c79f1C99B66A45eFB830d4c);
            UltimateDominionConfig.setPythProvider(0x6CC14824Ea2918f5De5C2f75A9Da968ad4BD6344);
        } else if (block.chainid == 8453) {
            UltimateDominionConfig.setEntropy(0x6E7D74FA7d5c90FEF9F0512987605a6d546181Bb);
            UltimateDominionConfig.setPythProvider(0x52DeaA1c84233F7bb8C8A45baeDE41091c616506);
        }

    uint16 height = uint16(10);
    uint16 width = uint16(10);
    MapConfig.set(width, height);

    //install puppet
    world.installModule(new PuppetModule(), new bytes(0));

    _addRngSystem();

    // install gold module
    IERC20Mintable goldToken = registerERC20(
      world,
      GOLD_NAMESPACE,
      ERC20MetadataData({ decimals: 18, name: "GoldToken", symbol: unicode"🜚" })
    );

    UltimateDominionConfig.setGoldToken(address(goldToken));

    // characters
    IERC721Mintable characters = registerERC721(
      world,
      CHARACTERS_NAMESPACE,
      ERC721MetadataData({ name: ERC721_NAME, symbol: ERC721_SYMBOL, baseURI: TOKEN_URI })
    );

    UltimateDominionConfig.setCharacterToken(address(characters));

    {
      resourceIds.erc20NamespaceId = WorldResourceIdLib.encodeNamespace(GOLD_NAMESPACE);
      resourceIds.erc20SystemId = WorldResourceIdLib.encode({
        typeId: RESOURCE_SYSTEM,
        namespace: "Gold",
        name: "GoldToken"
      });

      resourceIds.characterSystemId = WorldResourceIdLib.encode({
        typeId: RESOURCE_SYSTEM,
        namespace: "UD",
        name: "CharacterSystem"
      });

      resourceIds.erc721NamespaceId = WorldResourceIdLib.encodeNamespace(CHARACTERS_NAMESPACE);

      resourceIds.erc721SystemId = WorldResourceIdLib.encode({
        typeId: RESOURCE_SYSTEM,
        namespace: "Characters",
        name: "ERC721System"
      });
      resourceIds.combatSystemId = WorldResourceIdLib.encode({
        typeId: RESOURCE_SYSTEM,
        namespace: "UD",
        name: "CombatSystem"
      });
      resourceIds.erc1155SystemId = _erc1155SystemId(ITEMS_NAMESPACE);
      resourceIds.erc1155NamespaceId = WorldResourceIdLib.encodeNamespace(ITEMS_NAMESPACE);
      resourceIds.itemsSystemId = WorldResourceIdLib.encode({
        typeId: RESOURCE_SYSTEM,
        namespace: "UD",
        name: "ItemsSystem"
      });
    }

    address characterSystemAddress = Systems.getSystem(resourceIds.characterSystemId);

    System goldSystemContract = new ERC20System();

    world.registerSystem(resourceIds.erc20SystemId, goldSystemContract, true);

    IWorld(worldAddress).grantAccess(resourceIds.erc20NamespaceId, worldAddress);
    IWorld(worldAddress).registerFunctionSelector(resourceIds.erc20SystemId, "mint(address,uint256)");

    world.transferOwnership(resourceIds.erc20NamespaceId, address(characterSystemAddress));

    System systemContract = new ERC721System();
    world.registerSystem(resourceIds.erc721SystemId, systemContract, true);

    NoTransferHook characterHook = new NoTransferHook();

    world.registerSystemHook(resourceIds.erc721SystemId, characterHook, BEFORE_CALL_SYSTEM);

    // Transfer characters namespace to World
    world.grantAccess(resourceIds.erc721SystemId, worldAddress);
    world.grantAccess(resourceIds.erc721SystemId, characterSystemAddress);
    world.transferOwnership(resourceIds.erc721NamespaceId, characterSystemAddress);

    address items = _deployErc1155(world, ITEMS_NAMESPACE);
    UltimateDominionConfig.setItems(address(items));
    //allow entropy system to call callback on Combat system
    world.grantAccess(resourceIds.combatSystemId, UltimateDominionConfig.getEntropy());
    _createStarterItems();
    _createMonsters();
    setLevels();
    vm.stopBroadcast();
  }

  function _deployErc1155(IWorld _world, bytes14 itemsNamespace) internal returns (address) {
    string memory json = vm.readFile("items.json");
    string memory metadataUriPrefix = json.readString(".metadataUriPrefix");

    IERC1155 _items = registerERC1155(_world, itemsNamespace, metadataUriPrefix);

    // ERC1155System erc1155System = new ERC1155System();
    address itemsSystemAddress = Systems.getSystem(resourceIds.itemsSystemId);

    // _world.registerSystem(resourceIds.erc1155SystemId, erc1155System, false);
    _world.grantAccess(resourceIds.erc1155SystemId, worldAddress);
    world.transferOwnership(resourceIds.erc1155NamespaceId, itemsSystemAddress);
    return address(_items);
  }

  function _addRngSystem() internal {
    System rngSystem = new RngSystem();

    resourceIds.rngSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "", "RngSystem");

    world.registerSystem(resourceIds.rngSystemId, rngSystem, true);
    world.registerRootFunctionSelector(
      resourceIds.rngSystemId,
      "getRng(bytes32,uint8,bytes)",
      "getRng(bytes32,uint8,bytes)"
    );
    world.registerRootFunctionSelector(
      resourceIds.rngSystemId,
      "entropyCallback(uint64,address,bytes32)",
      "entropyCallback(uint64,address,bytes32)"
    );
    world.registerRootFunctionSelector(
      resourceIds.rngSystemId,
      "_entropyCallback(uint64,address,bytes32)",
      "_entropyCallback(uint64,address,bytes32)"
    );
    world.registerRootFunctionSelector(resourceIds.rngSystemId, "getFee()", "getFee()");
    world.registerRootFunctionSelector(resourceIds.rngSystemId, "getEntropy()", "getEntropy()");
  }

  function _createStarterItems() internal {
    string memory json = vm.readFile("items.json");
    bytes memory itemStatsData = vm.parseJson(json, ".items");

    WeaponTemplateDetails[] memory itemTemplateDetails = abi.decode(itemStatsData, (WeaponTemplateDetails[]));

    uint256[] memory warriorItemIds = new uint256[](1);
    uint256[] memory rogueItemIds = new uint256[](1);
    uint256[] memory mageItemIds = new uint256[](1);

    for (uint256 i = 0; i < itemTemplateDetails.length; i++) {
      WeaponTemplateDetails memory itemTemplate = itemTemplateDetails[i];

      WeaponStats memory newWeapon = WeaponStats({
        agiModifier: itemTemplate.stats.agiModifier,
        classRestrictions: itemTemplate.stats.classRestrictions,
        hitPointModifier: itemTemplate.stats.hitPointModifier,
        intModifier: itemTemplate.stats.intModifier,
        maxDamage: itemTemplate.stats.maxDamage,
        minDamage: itemTemplate.stats.minDamage,
        minLevel: itemTemplate.stats.minLevel,
        strModifier: itemTemplate.stats.strModifier
      });

      uint256 starterItemId = world.UD__createItem(
        ItemType.Weapon,
        10 ether,
        abi.encode(newWeapon),
        itemTemplate.metadataUri
      );

      if (i == 0) {
        warriorItemIds[0] = starterItemId;
      }
      if (i == 1) {
        rogueItemIds[0] = starterItemId;
      }
      if (i == 2) {
        mageItemIds[0] = starterItemId;
      }
    }

    uint256[] memory amounts = new uint256[](1);
    amounts[0] = 1;

    world.UD__setStarterItems(Classes.Warrior, warriorItemIds, amounts);
    world.UD__setStarterItems(Classes.Rogue, rogueItemIds, amounts);
    world.UD__setStarterItems(Classes.Mage, mageItemIds, amounts);
  }

  function _createMonsters() internal {
    string memory json = vm.readFile("monsters.json");
    bytes memory monsterStatsData = vm.parseJson(json, ".monsters");

    MonsterTemplateDetails[] memory monsterTemplateDetails = abi.decode(monsterStatsData, (MonsterTemplateDetails[]));

    for (uint256 i = 0; i < monsterTemplateDetails.length; i++) {
      MonsterTemplateDetails memory monsterTemplate = monsterTemplateDetails[i];

      MonsterStats memory newMonster = MonsterStats({
        agility: monsterTemplate.stats.agility,
        armor: monsterTemplate.stats.armor,
        class: monsterTemplate.stats.class,
        experience: monsterTemplate.stats.experience,
        hitPoints: monsterTemplate.stats.hitPoints,
        level: monsterTemplate.stats.level,
        intelligence: monsterTemplate.stats.intelligence,
        inventory: monsterTemplate.stats.inventory,
        strength: monsterTemplate.stats.strength
      });

      world.UD__createMob(MobType.Monster, abi.encode(newMonster), monsterTemplate.metadataUri);
    }
  }

  function setLevels() internal {
    Levels.setExperience(1, 300);
    Levels.setExperience(2, 900);
    Levels.setExperience(3, 2700);
    Levels.setExperience(4, 6500);
    Levels.setExperience(5, 14000);
    Levels.setExperience(6, 23000);
    Levels.setExperience(7, 34000);
    Levels.setExperience(8, 48000);
    Levels.setExperience(9, 64000);
    Levels.setExperience(10, 85000);
    Levels.setExperience(11, 100000);
    Levels.setExperience(12, 120000);
    Levels.setExperience(13, 140000);
    Levels.setExperience(14, 165000);
    Levels.setExperience(15, 195000);
    Levels.setExperience(16, 225000);
    Levels.setExperience(17, 265000);
    Levels.setExperience(18, 305000);
    Levels.setExperience(19, 355000);
  }
}
