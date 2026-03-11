// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Script.sol";
import {IWorld} from "@world/IWorld.sol";
import {System} from "@latticexyz/world/src/System.sol";
import {WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM} from "@latticexyz/world/src/worldResourceTypes.sol";
import {Balances as ERC20Balances} from "@latticexyz/world-modules/src/modules/tokens/tables/Balances.sol";
import {TotalSupply as ERC20TotalSupply} from "@latticexyz/world-modules/src/modules/erc20-puppet/tables/TotalSupply.sol";
import {_balancesTableId, _totalSupplyTableId} from "@latticexyz/world-modules/src/modules/erc20-puppet/utils.sol";
import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {GOLD_NAMESPACE} from "../constants.sol";

/// @dev Temporary root system - mints gold, then gets replaced with dead contract
contract GoldSeeder2 is System {
    function seed(address to, uint256 amount) public {
        ResourceId balancesTableId = _balancesTableId(GOLD_NAMESPACE);
        ResourceId totalSupplyTableId = _totalSupplyTableId(GOLD_NAMESPACE);

        uint256 currentBalance = ERC20Balances.get(balancesTableId, to);
        ERC20Balances.set(balancesTableId, to, currentBalance + amount);

        uint256 currentSupply = ERC20TotalSupply.get(totalSupplyTableId);
        ERC20TotalSupply.set(totalSupplyTableId, currentSupply + amount);
    }
}

contract DeadSystem2 is System {
    fallback() external { revert("DISABLED"); }
}

contract TopUpPoolGold is Script {
    function run() external {
        address worldAddress = vm.envAddress("WORLD_ADDRESS");
        IWorld world = IWorld(worldAddress);

        vm.startBroadcast();

        // Deploy temporary seeder with a different system ID
        GoldSeeder2 seeder = new GoldSeeder2();
        ResourceId seederId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "", "GoldSeeder2");
        world.registerSystem(seederId, seeder, true);

        // Mint 450K gold to deployer for pool top-up
        address deployer = msg.sender;
        uint256 amount = 450_000 ether;
        world.call(seederId, abi.encodeCall(GoldSeeder2.seed, (deployer, amount)));
        console.log("Minted", amount / 1 ether, "gold to deployer for pool top-up", deployer);

        // Kill the seeder
        DeadSystem2 dead = new DeadSystem2();
        world.registerSystem(seederId, dead, true);
        console.log("GoldSeeder2 replaced with DeadSystem2 - minting disabled");

        vm.stopBroadcast();
    }
}
