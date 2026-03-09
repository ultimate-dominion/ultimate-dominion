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
import {GOLD_NAMESPACE, WORLD_NAMESPACE} from "../constants.sol";

/// @dev Root system that mints gold directly via table writes — single use
contract GoldSeeder is System {
    function seed(address to, uint256 amount) public {
        ResourceId balancesTableId = _balancesTableId(GOLD_NAMESPACE);
        ResourceId totalSupplyTableId = _totalSupplyTableId(GOLD_NAMESPACE);

        uint256 currentBalance = ERC20Balances.get(balancesTableId, to);
        ERC20Balances.set(balancesTableId, to, currentBalance + amount);

        uint256 currentSupply = ERC20TotalSupply.get(totalSupplyTableId);
        ERC20TotalSupply.set(totalSupplyTableId, currentSupply + amount);
    }
}

/// @dev Dead replacement — overwrites GoldSeeder slot so it can never mint again
contract DeadSystem is System {
    fallback() external { revert("DISABLED"); }
}

contract SeedLootManagerGold is Script {
    function run() external {
        address worldAddress = vm.envAddress("WORLD_ADDRESS");
        // Revenue address — founder allocation
        address recipient = 0x4AcA6731e27389D6b337150EDDb4463b81438D36;
        IWorld world = IWorld(worldAddress);

        vm.startBroadcast();

        // Deploy root seeder system
        GoldSeeder seeder = new GoldSeeder();
        ResourceId seederId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "", "GoldSeeder");
        world.registerSystem(seederId, seeder, true);

        // 1. Mint 20,000,000 gold to revenue address (founder allocation)
        uint256 revenueAmount = 20_000_000 ether;
        world.call(seederId, abi.encodeCall(GoldSeeder.seed, (recipient, revenueAmount)));
        console.log("Minted", revenueAmount / 1 ether, "gold to revenue address", recipient);

        // 2. Mint pool liquidity gold to deployer (for Uniswap V3 pool seeding)
        address deployer = msg.sender;
        uint256 poolAmount = vm.envOr("POOL_GOLD_AMOUNT", uint256(50_000 ether));
        world.call(seederId, abi.encodeCall(GoldSeeder.seed, (deployer, poolAmount)));
        console.log("Minted", poolAmount / 1 ether, "gold to deployer for pool", deployer);

        // 3. Replace seeder with dead contract — can never mint via this system ID again
        DeadSystem dead = new DeadSystem();
        world.registerSystem(seederId, dead, true);
        console.log("GoldSeeder replaced with DeadSystem - minting disabled");

        vm.stopBroadcast();
    }
}
