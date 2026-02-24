// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";
import { IWorld } from "@world/IWorld.sol";
import { UltimateDominionConfig } from "@codegen/index.sol";
import { Classes } from "@codegen/common.sol";
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
import { IItemsSystem } from "@codegen/world/IItemsSystem.sol";
// (no direct import needed for delegation control; we'll refer to it by resource id)

contract PostDeployCoreGameState is Script {
    function _seedStarterItems(IWorld world, ResourceId itemsSystemId, address /*udPuppet*/ ) internal {
        console.log("Seeding StarterItems...");
        {
            uint256[] memory warriorItems = new uint256[](1);
            uint256[] memory warriorAmts = new uint256[](1);
            warriorItems[0] = 6; // Rusty Axe
            warriorAmts[0] = 1;
            world.UD__setStarterItems(Classes.Warrior, warriorItems, warriorAmts);
        }
        {
            uint256[] memory rogueItems = new uint256[](1);
            uint256[] memory rogueAmts = new uint256[](1);
            rogueItems[0] = 9; // Throwing Dagger
            rogueAmts[0] = 1;
            world.UD__setStarterItems(Classes.Rogue, rogueItems, rogueAmts);
        }
        {
            uint256[] memory mageItems = new uint256[](1);
            uint256[] memory mageAmts = new uint256[](1);
            mageItems[0] = 8; // Novice Staff
            mageAmts[0] = 1;
            world.UD__setStarterItems(Classes.Mage, mageItems, mageAmts);
        }
        console.log("StarterItems seeded");
    }
    /**
     * @notice Main entry point - caller manages broadcast
     */
    function run(address worldAddress, uint256 deployerPrivateKey) public {
        IWorld world = IWorld(worldAddress);
        StoreSwitch.setStoreAddress(worldAddress);

        console.log("Initializing Core Game State for world at:", worldAddress);

        // Install PuppetModule first - required for ERC20/ERC721 registration (idempotent)
        console.log("Installing PuppetModule (idempotent)...");
        try world.installModule(new PuppetModule(), new bytes(0)) {
            console.log("PuppetModule installed");
        } catch {
            console.log("PuppetModule already installed, skipping");
        }

        // Deploy and configure Gold token (idempotent)
        if (UltimateDominionConfig.getGoldToken() == address(0)) {
            console.log("Deploying Gold token...");
            IERC20Mintable goldTokenTmp = registerERC20(
                world,
                GOLD_NAMESPACE,
                ERC20MetadataData({decimals: 18, name: "Gold", symbol: unicode"🜚"})
            );
            goldTokenTmp.mint(worldAddress, 100_000_000 ether);
            UltimateDominionConfig.setGoldToken(address(goldTokenTmp));
            console.log("Gold token deployed at:", address(goldTokenTmp));
        } else {
            console.log("Gold token already configured, skipping");
        }

        // Deploy and configure Character NFT token (idempotent)
        IERC721Mintable characters;
        if (UltimateDominionConfig.getCharacterToken() == address(0)) {
            console.log("Deploying Character token...");
            IERC721Mintable _characters = registerERC721(
                world,
                CHARACTERS_NAMESPACE,
                ERC721MetadataData({name: ERC721_NAME, symbol: ERC721_SYMBOL, baseURI: TOKEN_URI})
            );
            characters = _characters;
            UltimateDominionConfig.setCharacterToken(address(characters));
            console.log("Character token deployed at:", address(characters));
        } else {
            console.log("Character token already configured, skipping");
            characters = IERC721Mintable(UltimateDominionConfig.getCharacterToken());
        }

        ResourceId characterCoreId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "CharacterCore");
        ResourceId namespaceId = WorldResourceIdLib.encodeNamespace("Characters");
        ResourceId erc721SystemId = _erc721SystemId(CHARACTERS_NAMESPACE);

        // Get already-registered CharacterCore system address (registered by MUD during deployment)
        address characterCoreAddress = Systems.getSystem(characterCoreId);
        console.log("CharacterCore system address:", characterCoreAddress);

        // Grant access to ERC721System for both worldAddress AND CharacterCore (like dev branch does)
        // Granting may require ownership; ignore if already granted / not permitted
        try world.grantAccess(erc721SystemId, worldAddress) {
            console.log("Granted ERC721System access to World");
        } catch { console.log("ERC721System access for World already set or not permitted, skipping"); }
        try world.grantAccess(erc721SystemId, characterCoreAddress) {
            console.log("Granted ERC721System access to CharacterCore");
        } catch { console.log("ERC721System access for CharacterCore already set or not permitted, skipping"); }

        // Register hook (idempotent)
        NoTransferHook characterHook = new NoTransferHook();
        try world.registerSystemHook(erc721SystemId, characterHook, BEFORE_CALL_SYSTEM) {
            // ok
        } catch { console.log("ERC721System hook already set or not permitted, skipping"); }

        // Transfer ownership of characters namespace to CharacterCore (not worldAddress!)
        try world.transferOwnership(namespaceId, characterCoreAddress) {
            console.log("Transferred Characters namespace ownership to CharacterCore");
        } catch { console.log("Characters namespace ownership already transferred, skipping"); }

        // UltimateDominionConfig character token already set above

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

        // Prepare UD namespace puppet + delegation and seed via world.callFrom
        ResourceId itemsSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "ItemsSystem");
        ResourceId udNamespaceId = WorldResourceIdLib.encodeNamespace("UD");

        // Grant deployer access to UD namespace so we can seed starter items
        address deployer = vm.addr(deployerPrivateKey);
        try world.grantAccess(udNamespaceId, deployer) {
            console.log("Granted UD namespace access to deployer");
        } catch {
            console.log("UD namespace access already granted or not permitted");
        }

        // Ensure delegation control is registered for UD (idempotent)
        ResourceId puppetDelegationId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "puppet", "Delegation");
        try world.registerNamespaceDelegation(udNamespaceId, puppetDelegationId, new bytes(0)) {
            // ok
        } catch {}

        // Grant deployer access to systems needed for game data seeding
        // This allows the SeedGameData script to run after deployment
        ResourceId effectsSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "EffectsSystem");
        ResourceId mobSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "MobSystem");

        try world.grantAccess(udNamespaceId, deployer) {
            console.log("Granted UD namespace access to deployer");
        } catch { console.log("UD namespace access already granted"); }

        try world.grantAccess(itemsSystemId, deployer) {
            console.log("Granted ItemsSystem access to deployer");
        } catch { console.log("ItemsSystem access already granted"); }

        try world.grantAccess(effectsSystemId, deployer) {
            console.log("Granted EffectsSystem access to deployer");
        } catch { console.log("EffectsSystem access already granted"); }

        try world.grantAccess(mobSystemId, deployer) {
            console.log("Granted MobSystem access to deployer");
        } catch { console.log("MobSystem access already granted"); }

        console.log("Core Game State initialization completed!");
    }
}
