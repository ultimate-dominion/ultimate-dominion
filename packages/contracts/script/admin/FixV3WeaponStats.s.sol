// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";

import {WeaponStats, WeaponStatsData, ArmorStats, ArmorStatsData} from "@codegen/index.sol";
import {ArmorType} from "@codegen/common.sol";

/**
 * @title FixV3WeaponStats
 * @notice Writes missing WeaponStats/ArmorStats for BalancePatchV3 items (tokens 76-82).
 *         The items were created via createItem but their stats tables are all zeros on-chain.
 * @dev Run with:
 *   source .env.mainnet && forge script script/admin/FixV3WeaponStats.s.sol \
 *     --sig "run(address)" $WORLD_ADDRESS \
 *     --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" \
 *     --broadcast --skip-simulation
 */
contract FixV3WeaponStats is Script {
    function run(address worldAddress) external {
        StoreSwitch.setStoreAddress(worldAddress);
        vm.startBroadcast();

        // ===== Token 76: Trollhide Cleaver (R4 STR weapon) =====
        {
            bytes32[] memory effects = new bytes32[](2);
            effects[0] = bytes32(0xbeeab8b096ac11af000000000000000000000000000000000000000000000000); // physicalDamage
            effects[1] = bytes32(0x98562f2b32aeb98f000000000000000000000000000000000000000000000000); // weaken

            WeaponStats.set(76, WeaponStatsData({
                agiModifier: 3,
                intModifier: 0,
                hpModifier: 5,
                maxDamage: 9,
                minDamage: 6,
                minLevel: 0,
                strModifier: 3,
                effects: effects
            }));
            console.log("  76 Trollhide Cleaver: stats written");
        }

        // ===== Token 77: Phasefang (R4 AGI/INT weapon) =====
        {
            bytes32[] memory effects = new bytes32[](3);
            effects[0] = bytes32(0xeee09063621624b3000000000000000000000000000000000000000000000000); // magicDamage
            effects[1] = bytes32(0x02994e830bd997a6000000000000000000000000000000000000000000000000); // poison_dot
            effects[2] = bytes32(0xd2812fe9b0b2cad2000000000000000000000000000000000000000000000000); // blind

            WeaponStats.set(77, WeaponStatsData({
                agiModifier: 4,
                intModifier: 3,
                hpModifier: 5,
                maxDamage: 8,
                minDamage: 4,
                minLevel: 0,
                strModifier: 0,
                effects: effects
            }));
            console.log("  77 Phasefang: stats written");
        }

        // ===== Token 78: Drakescale Staff (R4 STR/INT weapon) =====
        {
            bytes32[] memory effects = new bytes32[](2);
            effects[0] = bytes32(0xeee09063621624b3000000000000000000000000000000000000000000000000); // magicDamage
            effects[1] = bytes32(0x54a7e38986f19669000000000000000000000000000000000000000000000000); // stupify

            WeaponStats.set(78, WeaponStatsData({
                agiModifier: 0,
                intModifier: 3,
                hpModifier: 5,
                maxDamage: 8,
                minDamage: 5,
                minLevel: 0,
                strModifier: 2,
                effects: effects
            }));
            console.log("  78 Drakescale Staff: stats written");
        }

        // ===== Token 79: Dire Rat Bite (monster weapon) =====
        {
            bytes32[] memory effects = new bytes32[](2);
            effects[0] = bytes32(0xbeeab8b096ac11af000000000000000000000000000000000000000000000000); // physicalDamage
            effects[1] = bytes32(0x02994e830bd997a6000000000000000000000000000000000000000000000000); // poison_dot

            WeaponStats.set(79, WeaponStatsData({
                agiModifier: 0,
                intModifier: 0,
                hpModifier: 0,
                maxDamage: 4,
                minDamage: 2,
                minLevel: 0,
                strModifier: 0,
                effects: effects
            }));
            console.log("  79 Dire Rat Bite: stats written");
        }

        // ===== Token 80: Basilisk Fang (monster weapon) =====
        {
            bytes32[] memory effects = new bytes32[](2);
            effects[0] = bytes32(0xbeeab8b096ac11af000000000000000000000000000000000000000000000000); // physicalDamage
            effects[1] = bytes32(0x056c2744282a177f000000000000000000000000000000000000000000000000); // petrify

            WeaponStats.set(80, WeaponStatsData({
                agiModifier: 0,
                intModifier: 0,
                hpModifier: 0,
                maxDamage: 5,
                minDamage: 3,
                minLevel: 0,
                strModifier: 0,
                effects: effects
            }));
            console.log("  80 Basilisk Fang: stats written");
        }

        // ===== Token 81: Basilisk Gaze (monster weapon) =====
        {
            bytes32[] memory effects = new bytes32[](2);
            effects[0] = bytes32(0xeee09063621624b3000000000000000000000000000000000000000000000000); // magicDamage
            effects[1] = bytes32(0x667ea11c140dca69000000000000000000000000000000000000000000000000); // petrifying_gaze_dmg

            WeaponStats.set(81, WeaponStatsData({
                agiModifier: 0,
                intModifier: 0,
                hpModifier: 0,
                maxDamage: 14,
                minDamage: 8,
                minLevel: 0,
                strModifier: 0,
                effects: effects
            }));
            console.log("  81 Basilisk Gaze: stats written");
        }

        // ===== Token 82: Drake's Cowl (R3 INT armor) =====
        {
            ArmorStats.set(82, ArmorStatsData({
                agiModifier: 0,
                armorModifier: 6,
                hpModifier: 0,
                intModifier: 5,
                minLevel: 1,
                strModifier: 0,
                armorType: ArmorType.Cloth
            }));
            console.log("  82 Drake's Cowl: stats written");
        }

        vm.stopBroadcast();
        console.log("All V3 item stats fixed.");
    }
}
