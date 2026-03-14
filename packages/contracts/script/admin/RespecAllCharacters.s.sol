// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {Stats, StatsData, Characters, Counters} from "@codegen/index.sol";
import {AdvancedClass} from "@codegen/common.sol";
import {CHARACTER_TOKEN_COUNTER_KEY} from "../../constants.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_TABLE} from "@latticexyz/world/src/worldResourceTypes.sol";
import {Owners as ERC721Owners} from "@latticexyz/world-modules/src/modules/erc721-puppet/tables/Owners.sol";

/**
 * @notice Respec all characters for V3 balance patch.
 *         Resets STR/AGI/INT to entry-time values (originalStats), level to 1,
 *         keeps XP so characters can re-level with new diminishing returns.
 *         Clears advanced class selection so it can be re-chosen at L10.
 *
 * @dev Run with:
 *   source .env.testnet && forge script script/admin/RespecAllCharacters.s.sol \
 *     --sig "run(address)" $WORLD_ADDRESS --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
 */
contract RespecAllCharacters is Script {
    function run(address worldAddress) external {
        StoreSwitch.setStoreAddress(worldAddress);
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        uint256 tokenCount = Counters.getCounter(CHARACTER_TOKEN_COUNTER_KEY, 0);
        console.log("Total character tokens: %d", tokenCount);

        ResourceId charsOwnersTableId = WorldResourceIdLib.encode(
            RESOURCE_TABLE, "Characters", "Owners"
        );

        vm.startBroadcast(deployerKey);

        uint256 respecced = 0;
        for (uint256 tokenId = 1; tokenId <= tokenCount; tokenId++) {
            address owner = ERC721Owners.get(charsOwnersTableId, tokenId);
            if (owner == address(0)) continue;

            // characterId = (address << 96) | tokenId
            bytes32 characterId = bytes32((uint256(uint160(owner)) << 96) | tokenId);

            // Read current stats for level and XP
            StatsData memory currentStats = Stats.get(characterId);
            if (currentStats.level == 0) {
                console.log("  Token %d - level 0, skipping", tokenId);
                continue;
            }

            // Read originalStats (stats at game entry, before any leveling)
            bytes memory originalRaw = Characters.getOriginalStats(characterId);
            if (originalRaw.length == 0) {
                console.log("  Token %d - no originalStats, skipping", tokenId);
                continue;
            }

            StatsData memory originalStats = abi.decode(originalRaw, (StatsData));

            console.log("  Token %d respec: L%d -> L1", tokenId, currentStats.level);
            console.log("    STR: %d -> %d", uint256(currentStats.strength), uint256(originalStats.strength));
            console.log("    AGI: %d -> %d", uint256(currentStats.agility), uint256(originalStats.agility));
            console.log("    INT: %d -> %d", uint256(currentStats.intelligence), uint256(originalStats.intelligence));
            console.log("    HP:  %d -> %d", uint256(currentStats.maxHp), uint256(originalStats.maxHp));

            // Build respec'd stats: base values from original entry, level reset to 1
            StatsData memory newStats = StatsData({
                strength: originalStats.strength,
                agility: originalStats.agility,
                intelligence: originalStats.intelligence,
                class: currentStats.class,
                maxHp: originalStats.maxHp,
                currentHp: originalStats.maxHp,
                level: 1,
                experience: currentStats.experience, // keep XP so they can re-level
                powerSource: currentStats.powerSource,
                race: currentStats.race,
                startingArmor: currentStats.startingArmor,
                advancedClass: AdvancedClass.None,
                hasSelectedAdvancedClass: false
            });

            // Write to both Characters.baseStats and Stats table
            Characters.setBaseStats(characterId, abi.encode(newStats));
            Stats.set(characterId, newStats);

            respecced++;
        }

        vm.stopBroadcast();
        console.log("=== Respecced %d characters ===", respecced);
    }
}
