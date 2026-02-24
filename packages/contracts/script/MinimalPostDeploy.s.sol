// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {PuppetModule} from "@latticexyz/world-modules/src/modules/puppet/PuppetModule.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM} from "@latticexyz/world/src/worldResourceTypes.sol";
import {IERC721Mintable} from "@latticexyz/world-modules/src/modules/erc721-puppet/IERC721Mintable.sol";
import {registerERC721} from "@latticexyz/world-modules/src/modules/erc721-puppet/registerERC721.sol";
import {ERC721MetadataData} from "@latticexyz/world-modules/src/modules/erc721-puppet/tables/ERC721Metadata.sol";
import {IERC20Mintable} from "@latticexyz/world-modules/src/modules/erc20-puppet/IERC20Mintable.sol";
import {registerERC20} from "@latticexyz/world-modules/src/modules/erc20-puppet/registerERC20.sol";
import {ERC20MetadataData} from "@latticexyz/world-modules/src/modules/erc20-puppet/tables/ERC20Metadata.sol";
import {System} from "@latticexyz/world/src/System.sol";

import {IWorld} from "@world/IWorld.sol";
import {UltimateDominionConfig, MapConfig, Admin} from "@codegen/index.sol";
import {RngSystem} from "@systems/RngSystem.sol";
import {
    GOLD_NAMESPACE,
    CHARACTERS_NAMESPACE,
    ERC721_NAME,
    ERC721_SYMBOL,
    TOKEN_URI
} from "../constants.sol";

contract MinimalPostDeploy is Script {
    IWorld public world;

    function run(address _worldAddress) external {
        world = IWorld(_worldAddress);
        StoreSwitch.setStoreAddress(_worldAddress);

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        console.log("Running minimal PostDeploy...");

        // Basic setup only
        _setupBasicConfig();
        _deployEssentialModules();
        _deployCoreSystems();

        vm.stopBroadcast();
    }

    function _setupBasicConfig() internal {
        // Map config
        MapConfig.set(10, 10);
        
        // Set admin
        Admin.set(vm.addr(vm.envUint("PRIVATE_KEY")), true);
        
        console.log("Basic config set up");
    }

    function _deployEssentialModules() internal {
        // Install puppet module
        world.installModule(new PuppetModule(), new bytes(0));

        // Deploy gold token
        IERC20Mintable goldToken = registerERC20(
            world, GOLD_NAMESPACE, ERC20MetadataData({decimals: 18, name: "GoldToken", symbol: unicode"🜚"})
        );
        UltimateDominionConfig.setGoldToken(address(goldToken));

        // Deploy character token
        IERC721Mintable characters = registerERC721(
            world,
            CHARACTERS_NAMESPACE,
            ERC721MetadataData({name: ERC721_NAME, symbol: ERC721_SYMBOL, baseURI: TOKEN_URI})
        );
        UltimateDominionConfig.setCharacterToken(address(characters));

        console.log("Essential modules deployed");
    }

    function _deployCoreSystems() internal {
        // Deploy RngSystem
        System rngSystem = new RngSystem();
        ResourceId rngSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "", "RngSystem");
        world.registerSystem(rngSystemId, rngSystem, true);
        world.registerRootFunctionSelector(rngSystemId, "getRng(bytes32,uint8,bytes)", "getRng(bytes32,uint8,bytes)");

        console.log("Core systems deployed");
    }
}
