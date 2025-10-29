// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";
import { IWorld } from "@world/IWorld.sol";
import { UltimateDominionConfig } from "@codegen/index.sol";
import { StoreSwitch } from "@latticexyz/store/src/StoreSwitch.sol";
import { IERC20Mintable } from "@latticexyz/world-modules/src/modules/erc20-puppet/IERC20Mintable.sol";
import { registerERC20 } from "@latticexyz/world-modules/src/modules/erc20-puppet/registerERC20.sol";
import { ERC20MetadataData } from "@latticexyz/world-modules/src/modules/erc20-puppet/tables/ERC20Metadata.sol";
import { IERC721Mintable } from "@latticexyz/world-modules/src/modules/erc721-puppet/IERC721Mintable.sol";
import { registerERC721 } from "@latticexyz/world-modules/src/modules/erc721-puppet/registerERC721.sol";
import { ERC721MetadataData } from "@latticexyz/world-modules/src/modules/erc721-puppet/tables/ERC721Metadata.sol";
import { ResourceId, WorldResourceIdLib } from "@latticexyz/world/src/WorldResourceId.sol";
import { RESOURCE_SYSTEM } from "@latticexyz/world/src/worldResourceTypes.sol";
import { NoTransferHook } from "../src/NoTransferHook.sol";
import { _erc721SystemId } from "@latticexyz/world-modules/src/modules/erc721-puppet/utils.sol";
import { BEFORE_CALL_SYSTEM } from "@latticexyz/world/src/systemHookTypes.sol";
import { GOLD_NAMESPACE, CHARACTERS_NAMESPACE, ERC721_NAME, ERC721_SYMBOL, TOKEN_URI } from "../constants.sol";
import { PuppetModule } from "@latticexyz/world-modules/src/modules/puppet/PuppetModule.sol";
import { Systems } from "@latticexyz/world/src/codegen/tables/Systems.sol";
import { RngSystem } from "../src/systems/RngSystem.sol";
import { System } from "@latticexyz/world/src/System.sol";

contract PostDeployCoreGameState is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        address worldAddress = vm.envAddress("WORLD_ADDRESS");
        IWorld world = IWorld(worldAddress);
        StoreSwitch.setStoreAddress(worldAddress);

        console.log("Initializing Core Game State for world at:", worldAddress);

        // Install PuppetModule first - required for ERC20/ERC721 registration
        console.log("Installing PuppetModule...");
        world.installModule(new PuppetModule(), new bytes(0));
        console.log("PuppetModule installed");

        // Deploy and configure Gold token
        console.log("Deploying Gold token...");
        IERC20Mintable goldToken =
            registerERC20(world, GOLD_NAMESPACE, ERC20MetadataData({decimals: 18, name: "Gold", symbol: unicode"🜚"}));
        goldToken.mint(worldAddress, 100_000_000 ether);
        UltimateDominionConfig.setGoldToken(address(goldToken));
        console.log("Gold token deployed at:", address(goldToken));

        // Deploy and configure Character NFT token
        console.log("Deploying Character token...");
        IERC721Mintable characters = registerERC721(
            world,
            CHARACTERS_NAMESPACE,
            ERC721MetadataData({name: ERC721_NAME, symbol: ERC721_SYMBOL, baseURI: TOKEN_URI})
        );

        ResourceId characterCoreId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "CharacterCore");
        ResourceId namespaceId = WorldResourceIdLib.encodeNamespace("Characters");
        ResourceId erc721SystemId = _erc721SystemId(CHARACTERS_NAMESPACE);

        // Get already-registered CharacterCore system address (registered by MUD during deployment)
        address characterCoreAddress = Systems.getSystem(characterCoreId);
        console.log("CharacterCore system address:", characterCoreAddress);

        // Grant access to ERC721System for both worldAddress AND CharacterCore (like dev branch does)
        world.grantAccess(erc721SystemId, worldAddress);
        world.grantAccess(erc721SystemId, characterCoreAddress);
        console.log("Granted ERC721System access to World and CharacterCore");

        // Register hook
        NoTransferHook characterHook = new NoTransferHook();
        world.registerSystemHook(erc721SystemId, characterHook, BEFORE_CALL_SYSTEM);

        // Transfer ownership of characters namespace to CharacterCore (not worldAddress!)
        world.transferOwnership(namespaceId, characterCoreAddress);
        console.log("Transferred Characters namespace ownership to CharacterCore");

        UltimateDominionConfig.setCharacterToken(address(characters));
        console.log("Character token deployed at:", address(characters));

        // Deploy and register RngSystem (it's excluded from mud.config, so register manually)
        console.log("Deploying RngSystem...");
        System rngSystem = new RngSystem();
        ResourceId rngSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "", "RngSystem");
        world.registerSystem(rngSystemId, rngSystem, true);
        // Register the getRng function selector (enum RngRequestType compiles to uint8)
        world.registerRootFunctionSelector(rngSystemId, "getRng(bytes32,uint8,bytes)", "getRng(bytes32,uint8,bytes)");
        console.log("RngSystem deployed and registered");

        // Set max players
        UltimateDominionConfig.setMaxPlayers(100);
        console.log("Max players set to:", 100);

        console.log("Core Game State initialization completed!");

        vm.stopBroadcast();
    }
}
