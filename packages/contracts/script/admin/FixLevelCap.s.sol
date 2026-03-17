// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {Levels, Stats, StatsData, Characters, Counters} from "@codegen/index.sol";
import {CHARACTER_TOKEN_COUNTER_KEY, MAX_LEVEL} from "../../constants.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_TABLE} from "@latticexyz/world/src/worldResourceTypes.sol";
import {Owners as ERC721Owners} from "@latticexyz/world-modules/src/modules/erc721-puppet/tables/Owners.sol";

/**
 * @notice Fixes the level 10 XP cap bug. Three operations:
 *         1. Set Levels[10] = 16,000 (match level 10 threshold to stop XP bleed)
 *         2. Delete Levels entries 11-50 (remove orphaned future-expansion data)
 *         3. Cap affected characters' XP to 16,000
 * @dev Run with: source .env.mainnet && forge script script/admin/FixLevelCap.s.sol \
 *        --sig "run(address)" $WORLD_ADDRESS --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
 */
contract FixLevelCap is Script {
    uint256 constant LEVEL_10_XP_CAP = 16000;

    function run(address worldAddress) external {
        StoreSwitch.setStoreAddress(worldAddress);
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        // ============================================================
        // 1. Set Levels[10] = 16,000 (was 25,000)
        // ============================================================
        uint256 oldLevel10Xp = Levels.get(MAX_LEVEL);
        Levels.setExperience(MAX_LEVEL, LEVEL_10_XP_CAP);
        console.log("Levels[10] XP: %d -> %d", oldLevel10Xp, LEVEL_10_XP_CAP);

        // ============================================================
        // 2. Delete Levels entries 11-50
        // ============================================================
        console.log("=== Deleting Levels 11-50 ===");
        for (uint256 level = 11; level <= 50; level++) {
            uint256 existing = Levels.get(level);
            if (existing > 0) {
                Levels.deleteRecord(level);
                console.log("  Deleted Levels[%d] (was %d)", level, existing);
            }
        }

        // ============================================================
        // 3. Cap affected characters' XP to 16,000
        // ============================================================
        console.log("=== Capping character XP ===");
        uint256 tokenCount = Counters.getCounter(CHARACTER_TOKEN_COUNTER_KEY, 0);
        console.log("Total character tokens: %d", tokenCount);

        ResourceId charsOwnersTableId = WorldResourceIdLib.encode(
            RESOURCE_TABLE, "Characters", "Owners"
        );

        uint256 capped = 0;
        for (uint256 tokenId = 1; tokenId <= tokenCount; tokenId++) {
            address owner = ERC721Owners.get(charsOwnersTableId, tokenId);
            if (owner == address(0)) continue;

            bytes32 characterId = bytes32((uint256(uint160(owner)) << 96) | tokenId);

            StatsData memory stats = Stats.get(characterId);
            if (stats.level < MAX_LEVEL || stats.experience <= LEVEL_10_XP_CAP) continue;

            uint256 oldXp = stats.experience;
            Stats.setExperience(characterId, LEVEL_10_XP_CAP);

            // Also update Characters.baseStats experience
            bytes memory baseStatsRaw = Characters.getBaseStats(characterId);
            if (baseStatsRaw.length > 0) {
                StatsData memory baseStats = abi.decode(baseStatsRaw, (StatsData));
                if (baseStats.experience > LEVEL_10_XP_CAP) {
                    baseStats.experience = LEVEL_10_XP_CAP;
                    Characters.setBaseStats(characterId, abi.encode(baseStats));
                }
            }

            console.log("  Token %d XP: %d -> %d", tokenId, oldXp, LEVEL_10_XP_CAP);
            capped++;
        }

        console.log("Capped %d characters", capped);

        vm.stopBroadcast();
        console.log("=== Level cap fix complete ===");
    }
}
