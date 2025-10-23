// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {Script} from "forge-std/Script.sol";
import {IERC20Mintable} from "@latticexyz/world-modules/src/modules/erc20-puppet/IERC20Mintable.sol";
import {registerERC20} from "@latticexyz/world-modules/src/modules/erc20-puppet/registerERC20.sol";
import {ERC20MetadataData} from "@latticexyz/world-modules/src/modules/erc20-puppet/tables/ERC20Metadata.sol";
import {ResourceId, WorldResourceIdLib, WorldResourceIdInstance} from "@latticexyz/world/src/WorldResourceId.sol";
import {IWorld} from "../src/codegen/world/IWorld.sol";
import {RESOURCE_SYSTEM} from "@latticexyz/world/src/worldResourceTypes.sol";
import {System} from "@latticexyz/world/src/System.sol";
import {GOLD_NAMESPACE} from "../constants.sol";
import {CharacterCore} from "../src/systems/character/CharacterCore.sol";

import {UltimateDominionConfig} from "../src/codegen/index.sol";
import "forge-std/console.sol";

contract DeployGold is Script {
    function run(address worldAddress) public returns (address) {
        IWorld world = IWorld(worldAddress);
        StoreSwitch.setStoreAddress(worldAddress);

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        IERC20Mintable goldToken =
            registerERC20(world, GOLD_NAMESPACE, ERC20MetadataData({decimals: 18, name: "Gold", symbol: unicode"🜚"}));

        ResourceId systemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "Gold", "GoldToken");

        CharacterCore characterCore = new CharacterCore();

        // Note: CharacterCore is already registered in DeployCharacters.sol
        // This script just sets up the gold token

        goldToken.mint(worldAddress, 100_000_000 ether);
        UltimateDominionConfig.setGoldToken(address(goldToken));

        vm.stopBroadcast();

        return address(goldToken);
    }
}
