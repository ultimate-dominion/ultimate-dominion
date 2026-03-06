// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IWorld} from "@world/IWorld.sol";
import {UltimateDominionConfig, MapConfig, Admin, Levels} from "@codegen/index.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {IERC20Mintable} from "@latticexyz/world-modules/src/modules/erc20-puppet/IERC20Mintable.sol";
import {registerERC20} from "@latticexyz/world-modules/src/modules/erc20-puppet/registerERC20.sol";
import {ERC20MetadataData} from "@latticexyz/world-modules/src/modules/erc20-puppet/tables/ERC20Metadata.sol";
import {IERC721Mintable} from "@latticexyz/world-modules/src/modules/erc721-puppet/IERC721Mintable.sol";
import {registerERC721} from "@latticexyz/world-modules/src/modules/erc721-puppet/registerERC721.sol";
import {ERC721MetadataData} from "@latticexyz/world-modules/src/modules/erc721-puppet/tables/ERC721Metadata.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM} from "@latticexyz/world/src/worldResourceTypes.sol";
import {NoTransferHook} from "../../src/NoTransferHook.sol";
import {_erc721SystemId} from "@latticexyz/world-modules/src/modules/erc721-puppet/utils.sol";
import {BEFORE_CALL_SYSTEM} from "@latticexyz/world/src/systemHookTypes.sol";
import {GOLD_NAMESPACE, CHARACTERS_NAMESPACE, ITEMS_NAMESPACE, ERC721_NAME, ERC721_SYMBOL, TOKEN_URI} from "../../constants.sol";
import {PuppetModule} from "@latticexyz/world-modules/src/modules/puppet/PuppetModule.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";
import {RngSystem} from "../../src/systems/RngSystem.sol";
import {System} from "@latticexyz/world/src/System.sol";
import {registerERC1155} from "@erc1155/registerERC1155.sol";
import {IERC1155} from "@erc1155/IERC1155.sol";

/**
 * @title MinimalPostDeploy (Tier 1)
 * @notice Deploys the core foundation needed for the game to function
 * @dev This is the first tier of the 3-tier deployment system
 *
 * Deploys:
 * - PuppetModule (MUD core)
 * - Gold ERC20 token
 * - Character ERC721 token
 * - Items ERC1155 token
 * - RngSystem
 * - Basic configuration (MaxPlayers, Admin)
 * - Access grants for feature scripts
 *
 * Usage:
 *   forge script MinimalPostDeploy --broadcast --sig "run(address)" <WORLD_ADDRESS>
 */
contract MinimalPostDeploy is Script {
    IWorld public world;
    address public deployer;

    function run(address _worldAddress) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        world = IWorld(_worldAddress);
        StoreSwitch.setStoreAddress(_worldAddress);

        console.log("=== Tier 1: MinimalPostDeploy ===");
        console.log("World address:", _worldAddress);
        console.log("Deployer:", deployer);

        // Install PuppetModule (required for ERC20/ERC721/ERC1155)
        _installPuppetModule();

        // Deploy tokens
        _deployGoldToken(_worldAddress);
        _deployCharacterToken();
        _deployItemsToken();

        // Configure character system
        _configureCharacterSystem();

        // Deploy RngSystem
        _deployRngSystem();

        // Set basic configuration
        _setBasicConfig();

        // Grant access for feature scripts
        _grantFeatureAccess();

        vm.stopBroadcast();

        console.log("=== Tier 1 Complete ===");
    }

    /**
     * @notice Run without broadcast management (for orchestration)
     */
    function runInternal(address _worldAddress, address _deployer) external {
        world = IWorld(_worldAddress);
        deployer = _deployer;
        StoreSwitch.setStoreAddress(_worldAddress);

        console.log("=== Tier 1: MinimalPostDeploy (Internal) ===");

        _installPuppetModule();
        _deployGoldToken(_worldAddress);
        _deployCharacterToken();
        _deployItemsToken();
        _configureCharacterSystem();
        _deployRngSystem();
        _setBasicConfig();
        _grantFeatureAccess();

        console.log("=== Tier 1 Complete ===");
    }

    function _installPuppetModule() internal {
        console.log("Installing PuppetModule...");
        try world.installModule(new PuppetModule(), new bytes(0)) {
            console.log("  PuppetModule installed");
        } catch {
            console.log("  PuppetModule already installed, skipping");
        }
    }

    function _deployGoldToken(address _worldAddress) internal {
        if (UltimateDominionConfig.getGoldToken() == address(0)) {
            console.log("Deploying Gold token...");
            IERC20Mintable goldToken = registerERC20(
                world,
                GOLD_NAMESPACE,
                ERC20MetadataData({decimals: 18, name: "Gold", symbol: unicode"🜚"})
            );
            goldToken.mint(_worldAddress, 100_000_000 ether);
            UltimateDominionConfig.setGoldToken(address(goldToken));
            console.log("  Gold token deployed at:", address(goldToken));
        } else {
            console.log("  Gold token already configured, skipping");
        }
    }

    function _deployCharacterToken() internal {
        if (UltimateDominionConfig.getCharacterToken() == address(0)) {
            console.log("Deploying Character token...");
            IERC721Mintable characters = registerERC721(
                world,
                CHARACTERS_NAMESPACE,
                ERC721MetadataData({name: ERC721_NAME, symbol: ERC721_SYMBOL, baseURI: TOKEN_URI})
            );
            UltimateDominionConfig.setCharacterToken(address(characters));
            console.log("  Character token deployed at:", address(characters));
        } else {
            console.log("  Character token already configured, skipping");
        }
    }

    function _deployItemsToken() internal {
        if (UltimateDominionConfig.getItems() == address(0)) {
            console.log("Deploying Items ERC1155 token...");
            IERC1155 items = registerERC1155(world, ITEMS_NAMESPACE, "ipfs://");
            UltimateDominionConfig.setItems(address(items));
            console.log("  Items ERC1155 token deployed at:", address(items));

            // Grant deployer access to Items namespace
            ResourceId itemsNamespaceId = WorldResourceIdLib.encodeNamespace(ITEMS_NAMESPACE);
            try world.grantAccess(itemsNamespaceId, deployer) {
                console.log("  Granted Items namespace access to deployer");
            } catch {
                console.log("  Items namespace access already granted");
            }
        } else {
            console.log("  Items token already configured, skipping");
        }
    }

    function _configureCharacterSystem() internal {
        console.log("Configuring Character system...");

        ResourceId characterCoreId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "CharacterCore");
        ResourceId namespaceId = WorldResourceIdLib.encodeNamespace("Characters");
        ResourceId erc721SystemId = _erc721SystemId(CHARACTERS_NAMESPACE);

        address characterCoreAddress = Systems.getSystem(characterCoreId);
        console.log("  CharacterCore address:", characterCoreAddress);

        address worldAddress = address(world);

        // Grant ERC721System access
        try world.grantAccess(erc721SystemId, worldAddress) {
            console.log("  Granted ERC721System access to World");
        } catch {}

        try world.grantAccess(erc721SystemId, characterCoreAddress) {
            console.log("  Granted ERC721System access to CharacterCore");
        } catch {}

        // Register hook
        NoTransferHook characterHook = new NoTransferHook();
        try world.registerSystemHook(erc721SystemId, characterHook, BEFORE_CALL_SYSTEM) {
            console.log("  Registered NoTransferHook");
        } catch {}

        // Transfer ownership
        try world.transferOwnership(namespaceId, characterCoreAddress) {
            console.log("  Transferred Characters namespace to CharacterCore");
        } catch {}
    }

    function _deployRngSystem() internal {
        console.log("Deploying RngSystem...");
        System rngSystem = new RngSystem();
        ResourceId rngSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "", "RngSystem");

        try world.registerSystem(rngSystemId, rngSystem, true) {
            world.registerRootFunctionSelector(rngSystemId, "getRng(bytes32,uint8,bytes)", "getRng(bytes32,uint8,bytes)");
            console.log("  RngSystem deployed and registered");
        } catch {
            console.log("  RngSystem already registered, skipping");
        }
    }

    function _setBasicConfig() internal {
        console.log("Setting basic configuration...");

        // Set max players
        UltimateDominionConfig.setMaxPlayers(100);
        console.log("  Max players: 100");

        // Set deployer as admin
        Admin.set(deployer, true);
        console.log("  Admin set:", deployer);

        // Set map config
        MapConfig.set(10, 10);
        console.log("  Map config: 10x10");

        // Set level experience requirements
        // ~29 gameplay hours to L10, hardcore ~1 week, medium ~3 weeks
        Levels.setExperience(1, 500);
        Levels.setExperience(2, 2000);
        Levels.setExperience(3, 5500);
        Levels.setExperience(4, 25000);
        Levels.setExperience(5, 85000);
        Levels.setExperience(6, 200000);
        Levels.setExperience(7, 450000);
        Levels.setExperience(8, 900000);
        Levels.setExperience(9, 1600000);
        Levels.setExperience(10, 2500000);
        console.log("  Level requirements set (1-10)");
    }

    function _grantFeatureAccess() internal {
        console.log("Granting access for feature scripts...");

        ResourceId udNamespaceId = WorldResourceIdLib.encodeNamespace("UD");
        ResourceId effectsSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "EffectsSystem");
        ResourceId itemsSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "ItemsSystem");
        ResourceId mobSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "MobSystem");

        try world.grantAccess(udNamespaceId, deployer) {
            console.log("  Granted UD namespace access");
        } catch {}

        try world.grantAccess(effectsSystemId, deployer) {
            console.log("  Granted EffectsSystem access");
        } catch {}

        try world.grantAccess(itemsSystemId, deployer) {
            console.log("  Granted ItemsSystem access");
        } catch {}

        try world.grantAccess(mobSystemId, deployer) {
            console.log("  Granted MobSystem access");
        } catch {}
    }

    /**
     * @notice Verify core deployment is complete
     */
    function verify(address _worldAddress) external returns (bool) {
        StoreSwitch.setStoreAddress(_worldAddress);

        bool hasGold = UltimateDominionConfig.getGoldToken() != address(0);
        bool hasCharacter = UltimateDominionConfig.getCharacterToken() != address(0);
        bool hasItems = UltimateDominionConfig.getItems() != address(0);
        bool hasMaxPlayers = UltimateDominionConfig.getMaxPlayers() > 0;

        return hasGold && hasCharacter && hasItems && hasMaxPlayers;
    }
}
