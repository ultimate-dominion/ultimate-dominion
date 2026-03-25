// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {IWorld} from "@world/IWorld.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM} from "@latticexyz/world/src/worldResourceTypes.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {System} from "@latticexyz/world/src/System.sol";
import {AdventureEscrow, GasReserve, Characters} from "@codegen/index.sol";
import {Balances as ERC20Balances} from "@latticexyz/world-modules/src/modules/tokens/tables/Balances.sol";
import {TotalSupply} from "@latticexyz/world-modules/src/modules/erc20-puppet/tables/TotalSupply.sol";
import {_balancesTableId, _totalSupplyTableId} from "@latticexyz/world-modules/src/modules/erc20-puppet/utils.sol";
import {PuppetMaster} from "@latticexyz/world-modules/src/modules/puppet/PuppetMaster.sol";

bytes14 constant GOLD_NAMESPACE = "Gold";

/**
 * @title MigrateEscrowSystem
 * @notice Root system that migrates AdventureEscrow balances to wallet Gold + GasReserve.
 *
 *         Writes directly to Gold ERC20 tables (Balances, TotalSupply) to avoid
 *         World_CallbackNotAllowed from re-entrant GoldLib calls in root system context.
 *
 *         For each character with escrow > 0:
 *           - Mint 95% Gold to the character's owner wallet (real ERC20)
 *           - Mint 5% Gold to the World address (backing for GasReserve)
 *           - Add 5% to the character's GasReserve balance
 *           - Zero out the AdventureEscrow balance
 *           - Emit Transfer events via puppet for ERC20 compliance
 *
 *         Idempotent: skips characters with escrow already at 0.
 */
contract MigrateEscrowSystem is System {
    event Transfer(address indexed from, address indexed to, uint256 value);

    function migrate(bytes32[] calldata characterIds) public {
        address world = _world();
        ResourceId balancesTableId = _balancesTableId(GOLD_NAMESPACE);
        ResourceId totalSupplyTableId = _totalSupplyTableId(GOLD_NAMESPACE);

        uint256 totalMinted = 0;

        for (uint256 i = 0; i < characterIds.length; i++) {
            bytes32 characterId = characterIds[i];
            uint256 escrowBalance = AdventureEscrow.get(characterId);

            // Idempotent: skip if already migrated
            if (escrowBalance == 0) continue;

            address owner = Characters.getOwner(characterId);
            require(owner != address(0), "MigrateEscrow: character has no owner");

            uint256 reserveSplit = escrowBalance / 20; // 5%
            uint256 walletSplit = escrowBalance - reserveSplit; // 95%

            // Mint 95% to player wallet — direct table write
            ERC20Balances.set(balancesTableId, owner, ERC20Balances.get(balancesTableId, owner) + walletSplit);

            // Mint 5% to World (backs GasReserve) — direct table write
            ERC20Balances.set(balancesTableId, world, ERC20Balances.get(balancesTableId, world) + reserveSplit);

            // Credit the GasReserve for this character
            uint256 currentReserve = GasReserve.getBalance(characterId);
            GasReserve.setBalance(characterId, currentReserve + reserveSplit);

            // Zero out escrow
            AdventureEscrow.set(characterId, 0);

            totalMinted += escrowBalance;
        }

        // Update total supply once (cheaper than per-iteration)
        if (totalMinted > 0) {
            TotalSupply.set(totalSupplyTableId, TotalSupply.get(totalSupplyTableId) + totalMinted);
        }
    }
}

/**
 * @title MigrateEscrowToWallet
 * @notice Forge script that deploys MigrateEscrowSystem as a root system and calls it.
 *
 * Usage:
 *   source .env.mainnet && FOUNDRY_PROFILE=base-mainnet forge script \
 *     script/MigrateEscrowToWallet.s.sol --tc MigrateEscrowToWallet \
 *     --sig "run(address,bytes32[])" $WORLD_ADDRESS "[0x...,0x...]" \
 *     --rpc-url $RPC_URL --broadcast --private-key $PRIVATE_KEY
 *
 *   Idempotent: safe to run multiple times. Characters with escrow=0 are skipped.
 */
contract MigrateEscrowToWallet is Script {
    function run(address worldAddress, bytes32[] calldata characterIds) external {
        StoreSwitch.setStoreAddress(worldAddress);

        vm.startBroadcast();

        console.log("=== MigrateEscrowToWallet ===");
        console.log("World:", worldAddress);

        // Deploy the root system
        MigrateEscrowSystem migrateSystem = new MigrateEscrowSystem();

        // Register as root system
        ResourceId systemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "", "MigrateEscrow");
        IWorld(worldAddress).registerSystem(systemId, migrateSystem, true);
        console.log("Registered MigrateEscrowSystem");

        // Call via world.call (root system runs in delegatecall context)
        IWorld(worldAddress).call(
            systemId,
            abi.encodeCall(MigrateEscrowSystem.migrate, (characterIds))
        );

        console.log("Migration complete");

        vm.stopBroadcast();
    }
}
