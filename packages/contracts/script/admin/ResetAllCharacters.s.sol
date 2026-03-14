// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {Stats, StatsData, Characters, Counters, AdventureEscrow} from "@codegen/index.sol";
import {AdvancedClass} from "@codegen/common.sol";
import {CHARACTER_TOKEN_COUNTER_KEY, GOLD_NAMESPACE} from "../../constants.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_TABLE} from "@latticexyz/world/src/worldResourceTypes.sol";
import {Owners as ERC721Owners} from "@latticexyz/world-modules/src/modules/erc721-puppet/tables/Owners.sol";
import {Balances as ERC20Balances} from "@latticexyz/world-modules/src/modules/tokens/tables/Balances.sol";
import {TotalSupply} from "@latticexyz/world-modules/src/modules/erc20-puppet/tables/TotalSupply.sol";
import {_totalSupplyTableId as _goldTotalSupplyTableId} from "@latticexyz/world-modules/src/modules/erc20-puppet/utils.sol";
import {IBaseWorld} from "@latticexyz/world/src/codegen/interfaces/IBaseWorld.sol";

/**
 * @notice Full reset of all characters to baseline for V3 testing.
 *         - Stats: reset to originalStats (entry-time values)
 *         - Level: 1, XP: 0, HP: full
 *         - Advanced class: cleared
 *         - Gold: set to 5 (starting amount)
 *         - Escrow: cleared
 *
 * @dev Run with:
 *   source .env.mainnet && forge script script/admin/ResetAllCharacters.s.sol \
 *     --sig "run(address)" $WORLD_ADDRESS --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
 */
contract ResetAllCharacters is Script {
    uint256 constant STARTING_GOLD = 5 ether;

    function run(address worldAddress) external {
        StoreSwitch.setStoreAddress(worldAddress);
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        uint256 tokenCount = Counters.getCounter(CHARACTER_TOKEN_COUNTER_KEY, 0);
        console.log("Total character tokens: %d", tokenCount);

        ResourceId charsOwnersTableId = WorldResourceIdLib.encode(
            RESOURCE_TABLE, "Characters", "Owners"
        );
        ResourceId goldBalancesTableId = WorldResourceIdLib.encode(
            RESOURCE_TABLE, GOLD_NAMESPACE, "Balances"
        );
        ResourceId goldSupplyTableId = _goldTotalSupplyTableId(GOLD_NAMESPACE);

        // Track total gold changes for supply adjustment
        uint256 totalOldGold = 0;
        uint256 totalNewGold = 0;

        // Collect owner addresses and character data before broadcast
        // (reads don't need broadcast, writes do)
        address[] memory owners = new address[](tokenCount);
        bytes32[] memory characterIds = new bytes32[](tokenCount);
        StatsData[] memory originals = new StatsData[](tokenCount);
        StatsData[] memory currents = new StatsData[](tokenCount);
        uint256 validCount = 0;

        for (uint256 tokenId = 1; tokenId <= tokenCount; tokenId++) {
            address owner = ERC721Owners.get(charsOwnersTableId, tokenId);
            if (owner == address(0)) continue;

            bytes32 characterId = bytes32((uint256(uint160(owner)) << 96) | tokenId);
            StatsData memory currentStats = Stats.get(characterId);
            if (currentStats.level == 0) {
                console.log("  Token %d - level 0, skipping", tokenId);
                continue;
            }

            bytes memory originalRaw = Characters.getOriginalStats(characterId);
            if (originalRaw.length == 0) {
                console.log("  Token %d - no originalStats, skipping", tokenId);
                continue;
            }

            owners[validCount] = owner;
            characterIds[validCount] = characterId;
            originals[validCount] = abi.decode(originalRaw, (StatsData));
            currents[validCount] = currentStats;
            validCount++;
        }

        vm.startBroadcast(deployerKey);

        // Grant deployer temporary write access to Gold tables
        address deployer = vm.addr(deployerKey);
        IBaseWorld(worldAddress).grantAccess(goldBalancesTableId, deployer);
        IBaseWorld(worldAddress).grantAccess(goldSupplyTableId, deployer);
        console.log("Granted Gold table access to deployer");

        for (uint256 i = 0; i < validCount; i++) {
            StatsData memory originalStats = originals[i];
            StatsData memory currentStats = currents[i];

            console.log("  Token %d reset: L%d -> L1, XP %d -> 0", i + 1, currentStats.level, currentStats.experience);

            StatsData memory newStats = StatsData({
                strength: originalStats.strength,
                agility: originalStats.agility,
                intelligence: originalStats.intelligence,
                class: currentStats.class,
                maxHp: originalStats.maxHp,
                currentHp: originalStats.maxHp,
                level: 1,
                experience: 0,
                powerSource: currentStats.powerSource,
                race: currentStats.race,
                startingArmor: currentStats.startingArmor,
                advancedClass: AdvancedClass.None,
                hasSelectedAdvancedClass: false
            });

            Characters.setBaseStats(characterIds[i], abi.encode(newStats));
            Stats.set(characterIds[i], newStats);

            // --- Gold reset ---
            uint256 currentGold = ERC20Balances.get(goldBalancesTableId, owners[i]);
            totalOldGold += currentGold;
            totalNewGold += STARTING_GOLD;
            ERC20Balances.set(goldBalancesTableId, owners[i], STARTING_GOLD);
            console.log("    Gold: %d -> %d", currentGold / 1 ether, STARTING_GOLD / 1 ether);

            // --- Escrow reset ---
            uint256 escrow = AdventureEscrow.get(characterIds[i]);
            if (escrow > 0) {
                AdventureEscrow.set(characterIds[i], 0);
                console.log("    Escrow: %d -> 0", escrow / 1 ether);
            }
        }

        // Adjust total supply
        if (totalOldGold != totalNewGold) {
            uint256 currentSupply = TotalSupply.get(goldSupplyTableId);
            uint256 newSupply = currentSupply - totalOldGold + totalNewGold;
            TotalSupply.set(goldSupplyTableId, newSupply);
            console.log("  Gold supply: %d -> %d", currentSupply / 1 ether, newSupply / 1 ether);
        }

        // Revoke temporary access
        IBaseWorld(worldAddress).revokeAccess(goldBalancesTableId, deployer);
        IBaseWorld(worldAddress).revokeAccess(goldSupplyTableId, deployer);
        console.log("Revoked Gold table access");

        vm.stopBroadcast();
        console.log("=== Reset %d characters ===", validCount);
    }
}
