// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {Mobs} from "@codegen/index.sol";
import {MonsterStats} from "@interfaces/Structs.sol";
import {Classes} from "@codegen/common.sol";

/**
 * @notice Updates mob stats for existing mob IDs (1-10) without creating duplicates.
 *         Uses direct table writes via StoreSwitch — bypasses system routing.
 * @dev Run with: PRIVATE_KEY=0x... WORLD_ADDRESS=0x... forge script script/UpdateMonsterStats.s.sol \
 *        --sig "run(address)" $WORLD_ADDRESS --rpc-url $RPC_URL --broadcast --skip-simulation
 */
contract UpdateMonsterStats is Script {
    function run(address worldAddress) external {
        StoreSwitch.setStoreAddress(worldAddress);
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        // Mob 1: Cave Rat (L1)
        _updateMob(1, MonsterStats({
            agility: 7, armor: 0, class: Classes.Rogue,
            experience: 225, hitPoints: 12, intelligence: 3,
            inventory: _getExistingInventory(1), level: 1, strength: 4
        }));

        // Mob 2: Fungal Shaman (L2)
        _updateMob(2, MonsterStats({
            agility: 5, armor: 0, class: Classes.Mage,
            experience: 400, hitPoints: 14, intelligence: 9,
            inventory: _getExistingInventory(2), level: 2, strength: 4
        }));

        // Mob 3: Cavern Brute (L3)
        _updateMob(3, MonsterStats({
            agility: 5, armor: 1, class: Classes.Warrior,
            experience: 550, hitPoints: 22, intelligence: 4,
            inventory: _getExistingInventory(3), level: 3, strength: 11
        }));

        // Mob 4: Crystal Elemental (L4)
        _updateMob(4, MonsterStats({
            agility: 6, armor: 1, class: Classes.Mage,
            experience: 800, hitPoints: 20, intelligence: 12,
            inventory: _getExistingInventory(4), level: 4, strength: 5
        }));

        // Mob 5: Cave Troll (L5)
        _updateMob(5, MonsterStats({
            agility: 8, armor: 3, class: Classes.Warrior,
            experience: 1000, hitPoints: 32, intelligence: 6,
            inventory: _getExistingInventory(5), level: 5, strength: 14
        }));

        // Mob 6: Phase Spider (L6)
        _updateMob(6, MonsterStats({
            agility: 15, armor: 0, class: Classes.Rogue,
            experience: 1325, hitPoints: 28, intelligence: 7,
            inventory: _getExistingInventory(6), level: 6, strength: 10
        }));

        // Mob 7: Lich Acolyte (L7)
        _updateMob(7, MonsterStats({
            agility: 9, armor: 0, class: Classes.Mage,
            experience: 2000, hitPoints: 32, intelligence: 17,
            inventory: _getExistingInventory(7), level: 7, strength: 8
        }));

        // Mob 8: Stone Giant (L8)
        _updateMob(8, MonsterStats({
            agility: 10, armor: 4, class: Classes.Warrior,
            experience: 2500, hitPoints: 48, intelligence: 9,
            inventory: _getExistingInventory(8), level: 8, strength: 18
        }));

        // Mob 9: Shadow Stalker (L9)
        _updateMob(9, MonsterStats({
            agility: 20, armor: 0, class: Classes.Rogue,
            experience: 3250, hitPoints: 42, intelligence: 10,
            inventory: _getExistingInventory(9), level: 9, strength: 14
        }));

        // Mob 10: Shadow Dragon (L10)
        _updateMob(10, MonsterStats({
            agility: 18, armor: 3, class: Classes.Mage,
            experience: 6500, hitPoints: 70, intelligence: 20,
            inventory: _getExistingInventory(10), level: 10, strength: 18
        }));

        vm.stopBroadcast();
        console.log("All 10 monster stats updated successfully");
    }

    function _updateMob(uint256 mobId, MonsterStats memory stats) internal {
        Mobs.setMobStats(mobId, abi.encode(stats));
        console.log("Updated mob", mobId);
    }

    function _getExistingInventory(uint256 mobId) internal view returns (uint256[] memory) {
        bytes memory existing = Mobs.getMobStats(mobId);
        MonsterStats memory old = abi.decode(existing, (MonsterStats));
        return old.inventory;
    }
}
