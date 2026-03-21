// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {IWorld} from "@world/IWorld.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM} from "@latticexyz/world/src/worldResourceTypes.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {System} from "@latticexyz/world/src/System.sol";
import {AdventureEscrow, GasReserve, Characters} from "@codegen/index.sol";
import {GoldLib} from "../src/libraries/GoldLib.sol";

/**
 * @title MigrateEscrowSystem
 * @notice Root system that migrates AdventureEscrow balances to wallet Gold + GasReserve.
 *
 *         For each character with escrow > 0:
 *           - Mint 95% Gold to the character's owner wallet (real ERC20)
 *           - Mint 5% Gold to the World address (backing for GasReserve)
 *           - Add 5% to the character's GasReserve balance
 *           - Zero out the AdventureEscrow balance
 *
 *         Idempotent: skips characters with escrow already at 0.
 *         Must be run as a root system (delegatecall) so GoldLib has World context.
 */
contract MigrateEscrowSystem is System {
    function migrate(bytes32[] calldata characterIds) public {
        address world = _world();

        for (uint256 i = 0; i < characterIds.length; i++) {
            bytes32 characterId = characterIds[i];
            uint256 escrowBalance = AdventureEscrow.get(characterId);

            // Idempotent: skip if already migrated
            if (escrowBalance == 0) continue;

            address owner = Characters.getOwner(characterId);
            require(owner != address(0), "MigrateEscrow: character has no owner");

            uint256 reserveSplit = escrowBalance / 20; // 5%
            uint256 walletSplit = escrowBalance - reserveSplit; // 95%

            // Mint 95% as real Gold to the player's wallet
            GoldLib.goldMint(world, owner, walletSplit);

            // Mint 5% as real Gold to the World (backs the GasReserve)
            GoldLib.goldMint(world, world, reserveSplit);

            // Credit the GasReserve for this character
            uint256 currentReserve = GasReserve.getBalance(characterId);
            GasReserve.setBalance(characterId, currentReserve + reserveSplit);

            // Zero out escrow
            AdventureEscrow.set(characterId, 0);
        }
    }
}

/**
 * @title MigrateEscrowToWallet
 * @notice Forge script that deploys MigrateEscrowSystem as a root system and calls it.
 *
 * Usage:
 *   source .env.testnet && forge script script/MigrateEscrowToWallet.s.sol \
 *     --sig "run(address,bytes32[])" $WORLD_ADDRESS "[0x...,0x...]" \
 *     --rpc-url $RPC_URL --broadcast
 *
 *   Pass the list of characterIds that have non-zero escrow balances.
 *   Query on-chain or from the indexer to build this list before running.
 *
 *   Idempotent: safe to run multiple times. Characters with escrow=0 are skipped.
 */
contract MigrateEscrowToWallet is Script {
    function run(address worldAddress, bytes32[] calldata characterIds) external {
        StoreSwitch.setStoreAddress(worldAddress);

        vm.startBroadcast();

        console.log("=== MigrateEscrowToWallet ===");
        console.log("World:", worldAddress);
        console.log("Characters to migrate:", characterIds.length);

        // Deploy the root system
        MigrateEscrowSystem migrateSystem = new MigrateEscrowSystem();

        // Register as root system
        ResourceId systemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "", "MigrateEscrow");
        try IWorld(worldAddress).registerSystem(systemId, migrateSystem, true) {
            console.log("Registered MigrateEscrowSystem");
        } catch {
            IWorld(worldAddress).registerSystem(systemId, migrateSystem, true);
            console.log("Upgraded MigrateEscrowSystem");
        }

        // Call via world.call (root system runs in delegatecall context)
        IWorld(worldAddress).call(
            systemId,
            abi.encodeCall(MigrateEscrowSystem.migrate, (characterIds))
        );

        console.log("Migration complete");

        vm.stopBroadcast();
    }
}
