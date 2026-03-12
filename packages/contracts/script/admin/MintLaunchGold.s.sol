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
import {GOLD_NAMESPACE} from "../../constants.sol";

/// @dev Temporary root system for launch gold minting
contract LaunchGoldSeeder is System {
    function seed(address to, uint256 amount) public {
        ResourceId balancesTableId = _balancesTableId(GOLD_NAMESPACE);
        ResourceId totalSupplyTableId = _totalSupplyTableId(GOLD_NAMESPACE);

        uint256 currentBalance = ERC20Balances.get(balancesTableId, to);
        ERC20Balances.set(balancesTableId, to, currentBalance + amount);

        uint256 currentSupply = ERC20TotalSupply.get(totalSupplyTableId);
        ERC20TotalSupply.set(totalSupplyTableId, currentSupply + amount);
    }
}

contract DeadLaunchSeeder is System {
    fallback() external { revert("DISABLED"); }
}

contract MintLaunchGold is Script {
    function run() external {
        address worldAddress = vm.envAddress("WORLD_ADDRESS");
        IWorld world = IWorld(worldAddress);

        vm.startBroadcast();

        // Deploy temporary seeder
        LaunchGoldSeeder seeder = new LaunchGoldSeeder();
        ResourceId seederId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "", "LaunchSeeder");
        world.registerSystem(seederId, seeder, true);

        // Mint 500K gold to deployer (for pool seeding)
        address deployer = msg.sender;
        uint256 poolAmount = 500_000 ether;
        world.call(seederId, abi.encodeCall(LaunchGoldSeeder.seed, (deployer, poolAmount)));
        console.log("Minted 500K gold to deployer:", deployer);

        // Mint 20M gold to revenue wallet (market reserve)
        address revenueWallet = 0x4AcA6731e27389D6b337150EDDb4463b81438D36;
        uint256 reserveAmount = 20_000_000 ether;
        world.call(seederId, abi.encodeCall(LaunchGoldSeeder.seed, (revenueWallet, reserveAmount)));
        console.log("Minted 20M gold to revenue wallet:", revenueWallet);

        // Kill the seeder - no more minting possible
        DeadLaunchSeeder dead = new DeadLaunchSeeder();
        world.registerSystem(seederId, dead, true);
        console.log("LaunchSeeder replaced with DeadLaunchSeeder - minting disabled");

        vm.stopBroadcast();
    }
}
