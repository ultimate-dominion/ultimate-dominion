// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {Levels} from "@codegen/index.sol";

/**
 * @notice Updates XP thresholds for all levels. PostDeploy doesn't run on upgrade deploys,
 *         so this script sets them manually via direct table writes.
 * @dev Run with: PRIVATE_KEY=0x... WORLD_ADDRESS=0x... forge script script/UpdateXpThresholds.s.sol \
 *        --sig "run(address)" $WORLD_ADDRESS --rpc-url $RPC_URL --broadcast --skip-simulation
 */
contract UpdateXpThresholds is Script {
    function run(address worldAddress) external {
        StoreSwitch.setStoreAddress(worldAddress);
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        // Early game: hand-tuned thresholds (~29 gameplay hours to L10)
        // Scaled /100 from original values to match gold-per-kill order of magnitude
        Levels.setExperience(1, 5);
        Levels.setExperience(2, 20);
        Levels.setExperience(3, 55);
        Levels.setExperience(4, 250);
        Levels.setExperience(5, 850);
        Levels.setExperience(6, 2000);
        Levels.setExperience(7, 4500);
        Levels.setExperience(8, 9000);
        Levels.setExperience(9, 16000);
        Levels.setExperience(10, 25000);

        // Mid-game: quadratic growth (L11-30)
        uint256 baseExp = 25000;
        for (uint256 level = 11; level <= 30; level++) {
            baseExp += (level * level * 250);
            Levels.setExperience(level, baseExp);
        }

        // Late game: cubic growth (L31-50)
        for (uint256 level = 31; level <= 50; level++) {
            baseExp += (level * level * level * 10);
            Levels.setExperience(level, baseExp);
        }

        vm.stopBroadcast();
        console.log("XP thresholds updated for levels 1-50");
    }
}
