// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {Stats, StatsData, Characters} from "@codegen/index.sol";

/**
 * @notice Set a character's level and XP for testing.
 * @dev Run with: source .env.mainnet && forge script script/admin/SetCharacterLevel.s.sol \
 *        --sig "run(address,bytes32,uint256,uint256)" $WORLD_ADDRESS <characterId> <level> <xp> \
 *        --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
 */
contract SetCharacterLevel is Script {
    function run(address worldAddress, bytes32 characterId, uint256 targetLevel, uint256 targetXp) external {
        StoreSwitch.setStoreAddress(worldAddress);
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        StatsData memory stats = Stats.get(characterId);
        console.log("Current level: %d, XP: %d", stats.level, stats.experience);

        stats.level = targetLevel;
        stats.experience = targetXp;

        // Update both tables
        Stats.set(characterId, stats);
        Characters.setBaseStats(characterId, abi.encode(stats));

        console.log("Set to level: %d, XP: %d", targetLevel, targetXp);
        vm.stopBroadcast();
    }
}
