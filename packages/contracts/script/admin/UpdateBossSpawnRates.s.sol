// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {BossSpawnConfig} from "@codegen/index.sol";

/**
 * @title UpdateBossSpawnRates
 * @notice Updates Basilisk spawn rate to 50bp (~2 encounters/day at 10 DAU).
 *
 * NOTE: BossSpawnConfig is a singleton (one global boss). Warden boss spawning
 * requires a contract upgrade to support per-zone boss config (ZoneBossConfig table).
 *
 * Usage:
 *   FOUNDRY_PROFILE=script forge script script/admin/UpdateBossSpawnRates.s.sol \
 *     --sig "run(address,uint256)" <WORLD_ADDRESS> <BASILISK_MOB_ID> \
 *     --rpc-url <RPC> --broadcast --skip-simulation
 */
contract UpdateBossSpawnRates is Script {
    uint256 constant BASILISK_CHANCE_BP = 50; // 0.5% per tile entry, ~2/day at 10 DAU

    function run(address worldAddress, uint256 basiliskMobId) external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);
        StoreSwitch.setStoreAddress(worldAddress);

        console.log("=== UpdateBossSpawnRates ===");

        uint256 oldRate = BossSpawnConfig.getSpawnChanceBp();
        uint256 oldMob = BossSpawnConfig.getBossMobId();
        BossSpawnConfig.set(basiliskMobId, BASILISK_CHANCE_BP);
        console.log("  Basilisk updated");
        console.log("    old mob:", oldMob, "new mob:", basiliskMobId);
        console.log("    old rate:", oldRate, "new rate:", BASILISK_CHANCE_BP);

        vm.stopBroadcast();
        console.log("=== UpdateBossSpawnRates Complete ===");
    }
}
