// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {Levels, Stats, StatsData, Characters, Mobs, Counters} from "@codegen/index.sol";
import {MonsterStats} from "@interfaces/Structs.sol";
import {Classes} from "@codegen/common.sol";
import {CHARACTER_TOKEN_COUNTER_KEY} from "../../constants.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_TABLE} from "@latticexyz/world/src/worldResourceTypes.sol";
import {Owners as ERC721Owners} from "@latticexyz/world-modules/src/modules/erc721-puppet/tables/Owners.sol";

/**
 * @notice Scales down all XP values by 100x to make numbers proportional to gold drops.
 *         Updates: (1) level thresholds, (2) monster base XP, (3) all existing character XP.
 *         Same kill count and progression speed — just smaller numbers.
 * @dev Run with: source .env.mainnet && forge script script/ScaleDownXp.s.sol \
 *        --sig "run(address)" $WORLD_ADDRESS --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
 */
contract ScaleDownXp is Script {
    uint256 constant SCALE_FACTOR = 100;

    function run(address worldAddress) external {
        StoreSwitch.setStoreAddress(worldAddress);
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        // ============================================================
        // 1. Update level thresholds (divide by 100)
        // ============================================================
        console.log("=== Updating level thresholds ===");
        Levels.setExperience(1, 5);       // was 500
        Levels.setExperience(2, 20);      // was 2000
        Levels.setExperience(3, 55);      // was 5500
        Levels.setExperience(4, 250);     // was 25000
        Levels.setExperience(5, 850);     // was 85000
        Levels.setExperience(6, 2000);    // was 200000
        Levels.setExperience(7, 4500);    // was 450000
        Levels.setExperience(8, 9000);    // was 900000
        Levels.setExperience(9, 16000);   // was 1600000
        Levels.setExperience(10, 25000);  // was 2500000
        console.log("Level thresholds updated (L2-L10)");

        // Mid-game thresholds (L11-30) — scale down too
        uint256 baseExp = 25000;
        for (uint256 level = 11; level <= 30; level++) {
            baseExp += (level * level * 250); // was * 25000
            Levels.setExperience(level, baseExp);
        }

        // Late game (L31-50)
        for (uint256 level = 31; level <= 50; level++) {
            baseExp += (level * level * level * 10); // was * 1000
            Levels.setExperience(level, baseExp);
        }
        console.log("Level thresholds updated (L11-L50)");

        // ============================================================
        // 2. Update monster base XP (divide by 100)
        // ============================================================
        console.log("=== Updating monster XP ===");

        // Mob 1: Cave Rat (225 -> 2)
        _updateMobXp(1, 2);
        // Mob 2: Fungal Shaman (400 -> 4)
        _updateMobXp(2, 4);
        // Mob 3: Cavern Brute (550 -> 6)
        _updateMobXp(3, 6);
        // Mob 4: Crystal Elemental (800 -> 8)
        _updateMobXp(4, 8);
        // Mob 5: Cave Troll (1000 -> 10)
        _updateMobXp(5, 10);
        // Mob 6: Phase Spider (1325 -> 13)
        _updateMobXp(6, 13);
        // Mob 7: Lich Acolyte (2000 -> 20)
        _updateMobXp(7, 20);
        // Mob 8: Stone Giant (2500 -> 25)
        _updateMobXp(8, 25);
        // Mob 9: Shadow Stalker (3250 -> 33)
        _updateMobXp(9, 33);
        // Mob 10: Shadow Dragon (6500 -> 65)
        _updateMobXp(10, 65);
        console.log("All 10 monster XP values updated");

        // ============================================================
        // 3. Migrate existing character XP (divide by 100)
        // ============================================================
        console.log("=== Migrating character XP ===");
        uint256 tokenCount = Counters.getCounter(CHARACTER_TOKEN_COUNTER_KEY, 0);
        console.log("Total character tokens: %d", tokenCount);

        ResourceId charsOwnersTableId = WorldResourceIdLib.encode(
            RESOURCE_TABLE, "Characters", "Owners"
        );

        uint256 migrated = 0;
        for (uint256 tokenId = 1; tokenId <= tokenCount; tokenId++) {
            // Reconstruct characterId from ERC721 owner
            address owner = ERC721Owners.get(charsOwnersTableId, tokenId);
            if (owner == address(0)) continue;

            // characterId = (address << 96) | tokenId
            bytes32 characterId = bytes32((uint256(uint160(owner)) << 96) | tokenId);

            uint256 oldXp = Stats.getExperience(characterId);
            if (oldXp == 0) {
                console.log("  Token %d - no XP, skipping", tokenId);
                continue;
            }

            uint256 newXp = oldXp / SCALE_FACTOR;
            if (newXp == 0) newXp = 1; // Don't zero out non-zero XP

            Stats.setExperience(characterId, newXp);

            // Also update Characters.baseStats experience
            bytes memory baseStatsRaw = Characters.getBaseStats(characterId);
            if (baseStatsRaw.length > 0) {
                StatsData memory baseStats = abi.decode(baseStatsRaw, (StatsData));
                if (baseStats.experience > 0) {
                    baseStats.experience = baseStats.experience / SCALE_FACTOR;
                    if (baseStats.experience == 0) baseStats.experience = 1;
                    Characters.setBaseStats(characterId, abi.encode(baseStats));
                }
            }

            console.log("  Token %d XP: %d -> %d", tokenId, oldXp, newXp);
            migrated++;
        }

        console.log("Migrated %d characters", migrated);

        vm.stopBroadcast();
        console.log("=== XP scale-down complete ===");
    }

    function _updateMobXp(uint256 mobId, uint256 newXp) internal {
        bytes memory existing = Mobs.getMobStats(mobId);
        MonsterStats memory stats = abi.decode(existing, (MonsterStats));
        uint256 oldXp = stats.experience;
        stats.experience = newXp;
        Mobs.setMobStats(mobId, abi.encode(stats));
        console.log("  Mob %d XP: %d -> %d", mobId, oldXp, newXp);
    }
}
