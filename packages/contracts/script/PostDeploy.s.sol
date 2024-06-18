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
import { UltimateDominionConfig } from "../src/codegen/index.sol";
import { ResourceIdLib } from "@latticexyz/store/src/ResourceId.sol";
import { ResourceId, WorldResourceIdLib, WorldResourceIdInstance } from "@latticexyz/world/src/WorldResourceId.sol";
import { RESOURCE_SYSTEM } from "@latticexyz/world/src/worldResourceTypes.sol";
import { DeployGold } from "./DeployGold.sol";
import { DeployCharacters } from "./DeployCharacters.sol";
import { RngSystem } from "../src/systems/RngSystem.sol";
import { IERC721Mintable } from "@latticexyz/world-modules/src/modules/erc721-puppet/IERC721Mintable.sol";
import { registerERC721 } from "@latticexyz/world-modules/src/modules/erc721-puppet/registerERC721.sol";
import { ERC721System } from "@latticexyz/world-modules/src/modules/erc721-puppet/ERC721System.sol";
import { ERC721MetadataData } from "@latticexyz/world-modules/src/modules/erc721-puppet/tables/ERC721Metadata.sol";
import { GOLD_NAMESPACE, CHARACTERS_NAMESPACE, ERC721_NAME, ERC721_SYMBOL, TOKEN_URI } from "../constants.sol";
import { NoTransferHook } from "../src/NoTransferHook.sol";
import { BEFORE_CALL_SYSTEM } from "@latticexyz/world/src/systemHookTypes.sol";
import { Classes } from "@codegen/common.sol";

import { IERC20Mintable } from "@latticexyz/world-modules/src/modules/erc20-puppet/IERC20Mintable.sol";
import { ERC20MetadataData } from "@latticexyz/world-modules/src/modules/erc20-puppet/tables/ERC20Metadata.sol";
import { ERC20System } from "@latticexyz/world-modules/src/modules/erc20-puppet/ERC20System.sol";
import { registerERC20 } from "@latticexyz/world-modules/src/modules/erc20-puppet/registerERC20.sol";
import { System } from "@latticexyz/world/src/System.sol";
import { CharacterSystem } from "../src/systems/CharacterSystem.sol";

import "forge-std/console2.sol";

struct ResourceIds {
  ResourceId erc721SystemId;
  ResourceId erc721NamespaceId;
  ResourceId characterSystemId;
  ResourceId erc20SystemId;
  ResourceId erc20NamespaceId;
  ResourceId rngSystemId;
}

contract PostDeploy is Script {
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

    vm.stopBroadcast();
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
}
