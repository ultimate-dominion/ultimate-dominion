// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IWorld} from "@world/IWorld.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {
    Items,
    ItemsData,
    WeaponStats,
    WeaponStatsData,
    StatRestrictions,
    StatRestrictionsData
} from "@codegen/index.sol";

/**
 * @title FixAgiWeaponDamage
 * @notice Bumps minDamage and maxDamage by 1 for AGI weapons that round to 0
 *         after the 0.9x AGI_ATTACK_MODIFIER. Affected items: 27, 30, 49, 51, 55.
 * @dev Run with:
 *   PRIVATE_KEY=0x... forge script script/FixAgiWeaponDamage.s.sol \
 *     --sig "run(address)" $WORLD_ADDRESS --rpc-url $RPC_URL --broadcast --skip-simulation
 */
contract FixAgiWeaponDamage is Script {
    function run(address worldAddress) external {
        StoreSwitch.setStoreAddress(worldAddress);
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        uint256[5] memory itemIds = [uint256(27), 30, 49, 51, 55];

        console.log("=== Fix AGI Weapon Damage ===");
        console.log("World:", worldAddress);

        vm.startBroadcast(deployerKey);

        for (uint256 i = 0; i < itemIds.length; i++) {
            uint256 itemId = itemIds[i];
            ItemsData memory item = Items.get(itemId);
            require(item.stats.length > 0, "Item not found");

            WeaponStatsData memory ws = WeaponStats.get(itemId);
            StatRestrictionsData memory sr = StatRestrictions.get(itemId);

            console.log("--- Item", itemId);
            console.log("  Before: min=%d max=%d", uint256(ws.minDamage), uint256(ws.maxDamage));

            ws.minDamage += 1;
            ws.maxDamage += 1;

            console.log("  After:  min=%d max=%d", uint256(ws.minDamage), uint256(ws.maxDamage));

            bytes memory newStats = abi.encode(ws, sr);
            IWorld(worldAddress).UD__adminUpdateItemStats(
                itemId, item.dropChance, item.price, item.rarity, newStats
            );
        }

        vm.stopBroadcast();
        console.log("=== Done: %d weapons updated ===", itemIds.length);
    }
}
