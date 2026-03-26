// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {Levels, Stats, StatsData, Characters, Counters} from "@codegen/index.sol";
import {CHARACTER_TOKEN_COUNTER_KEY} from "../../constants.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_TABLE} from "@latticexyz/world/src/worldResourceTypes.sol";
import {Owners as ERC721Owners} from "@latticexyz/world-modules/src/modules/erc721-puppet/tables/Owners.sol";

/**
 * @notice EMERGENCY: Fix level cap exploit. Deployed MAX_LEVEL=20 with no Z2 XP thresholds,
 *         causing Levels[11-19] = 0 → calculateLevelFromExperience returns L20 for everyone.
 *
 *         Phase 1 (this script — run BEFORE code redeploy):
 *         1. Set Levels[10-20] to type(uint256).max → blocks leveling past L10 even with MAX_LEVEL=20 on-chain
 *         2. Roll back characters above L10 → reset level, stats, HP to L10 values
 *
 *         Phase 2 (separate): redeploy contracts with MAX_LEVEL=10
 *
 * @dev Run with: source .env.mainnet && forge script script/admin/FixLevelCap.s.sol \
 *        --sig "run(address)" $WORLD_ADDRESS --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
 */
contract FixLevelCap is Script {
    uint256 constant Z1_MAX_LEVEL = 10;
    // L9 threshold = 16,000 — this is what calculateLevelFromExperience uses for the L10 cap
    // with MAX_LEVEL=10 after code redeploy
    uint256 constant L9_XP_THRESHOLD = 16000;

    function run(address worldAddress) external {
        StoreSwitch.setStoreAddress(worldAddress);
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        // ============================================================
        // 1. Block leveling past L10 by setting L10-20 to unreachable XP
        //    With MAX_LEVEL=20 on-chain, calculateLevelFromExperience reads
        //    levelsTable[0..19]. Setting [10..19] to max makes levelsTable[19]
        //    unreachable, so the >= check at MAX_LEVEL-1 always fails.
        //    The loop also can't match L11+ since threshold > any real XP.
        // ============================================================
        console.log("=== Setting Levels 10-20 to unreachable ===");
        for (uint256 level = Z1_MAX_LEVEL; level <= 20; level++) {
            uint256 existing = Levels.get(level);
            Levels.setExperience(level, type(uint256).max);
            console.log("  Levels[%d]: %d -> max", level, existing);
        }

        // ============================================================
        // 2. Roll back characters above L10
        // ============================================================
        console.log("=== Rolling back characters above L10 ===");
        uint256 tokenCount = Counters.getCounter(CHARACTER_TOKEN_COUNTER_KEY, 0);
        console.log("Total character tokens: %d", tokenCount);

        ResourceId charsOwnersTableId = WorldResourceIdLib.encode(
            RESOURCE_TABLE, "Characters", "Owners"
        );

        uint256 rolledBack = 0;
        for (uint256 tokenId = 1; tokenId <= tokenCount; tokenId++) {
            address owner = ERC721Owners.get(charsOwnersTableId, tokenId);
            if (owner == address(0)) continue;

            bytes32 characterId = bytes32((uint256(uint160(owner)) << 96) | tokenId);

            StatsData memory stats = Stats.get(characterId);
            if (stats.level <= Z1_MAX_LEVEL) continue;

            uint256 oldLevel = stats.level;

            // Calculate how many illegitimate levels were gained
            uint256 illegitLevels = stats.level - Z1_MAX_LEVEL;

            // Reverse stat point gains: L11+ gives 1 stat per 2 levels (every even level)
            // Count even levels in range (Z1_MAX_LEVEL+1 .. stats.level)
            uint256 illegitStatPoints = 0;
            for (uint256 lvl = Z1_MAX_LEVEL + 1; lvl <= stats.level; lvl++) {
                if (lvl % 2 == 0) illegitStatPoints++;
            }

            // Reverse HP gains: L11+ gives 1 HP per level
            int256 illegitHp = int256(illegitLevels);

            // Reset level
            Stats.setLevel(characterId, Z1_MAX_LEVEL);

            // Reduce max HP (clamp to at least 1)
            int256 newMaxHp = stats.maxHp - illegitHp;
            if (newMaxHp < 1) newMaxHp = 1;
            Stats.setMaxHp(characterId, newMaxHp);

            // Clamp current HP to new max
            if (stats.currentHp > newMaxHp) {
                Stats.setCurrentHp(characterId, newMaxHp);
            }

            // Cap XP at L9 threshold (prevents immediate re-level after fix)
            if (stats.experience > L9_XP_THRESHOLD) {
                Stats.setExperience(characterId, L9_XP_THRESHOLD);
            }

            // Reduce stats proportionally — remove illegit stat points from highest stat
            // (simple approach: reduce STR, AGI, INT by removing from whichever is highest)
            if (illegitStatPoints > 0) {
                _removeStatPoints(characterId, stats, illegitStatPoints);
            }

            // Also sync Characters.baseStats
            bytes memory baseStatsRaw = Characters.getBaseStats(characterId);
            if (baseStatsRaw.length > 0) {
                StatsData memory baseStats = abi.decode(baseStatsRaw, (StatsData));
                baseStats.level = Z1_MAX_LEVEL;
                baseStats.maxHp = newMaxHp;
                if (baseStats.currentHp > newMaxHp) baseStats.currentHp = newMaxHp;
                if (baseStats.experience > L9_XP_THRESHOLD) baseStats.experience = L9_XP_THRESHOLD;
                Characters.setBaseStats(characterId, abi.encode(baseStats));
            }

            console.log("  Token %d: L%d -> L%d", tokenId, oldLevel, Z1_MAX_LEVEL);
            rolledBack++;
        }

        console.log("Rolled back %d characters", rolledBack);

        vm.stopBroadcast();
        console.log("=== Level cap fix complete ===");
    }

    /**
     * @dev Remove illegitimate stat points by taking from whichever stat is highest, one at a time.
     *      This is a best-effort reversal since we don't know which stats the player chose.
     */
    function _removeStatPoints(bytes32 characterId, StatsData memory stats, uint256 points) internal {
        int256 str = stats.strength;
        int256 agi = stats.agility;
        int256 intel = stats.intelligence;

        for (uint256 i = 0; i < points; i++) {
            if (str >= agi && str >= intel && str > 0) {
                str--;
            } else if (agi >= str && agi >= intel && agi > 0) {
                agi--;
            } else if (intel > 0) {
                intel--;
            }
        }

        Stats.setStrength(characterId, str);
        Stats.setAgility(characterId, agi);
        Stats.setIntelligence(characterId, intel);
    }
}
