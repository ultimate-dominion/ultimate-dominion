// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {IWorld} from "@world/IWorld.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM} from "@latticexyz/world/src/worldResourceTypes.sol";
import {System} from "@latticexyz/world/src/System.sol";
import {CharacterEquipment} from "@codegen/index.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";

/**
 * @title UnequipGhostSystem
 * @notice Root system to remove a ghost weapon from CharacterEquipment.
 *         Root systems bypass all access control via delegatecall.
 */
contract UnequipGhostSystem is System {
    function removeWeapon(bytes32 characterId, uint256 weaponId) public {
        uint256[] memory weapons = CharacterEquipment.getEquippedWeapons(characterId);
        uint256 len = weapons.length;
        bool found = false;

        // Find and swap-remove the weapon
        for (uint256 i = 0; i < len; i++) {
            if (weapons[i] == weaponId) {
                // Move last element to this position
                weapons[i] = weapons[len - 1];
                found = true;
                break;
            }
        }
        require(found, "Weapon not found in equipped list");

        // Rebuild array without last element
        uint256[] memory newWeapons = new uint256[](len - 1);
        for (uint256 i = 0; i < len - 1; i++) {
            newWeapons[i] = weapons[i];
        }
        CharacterEquipment.setEquippedWeapons(characterId, newWeapons);
        // Note: stats NOT recalculated here (root system can't callback into World).
        // Equip/unequip any item through the normal UI to trigger recalc.
    }
}

contract UnequipGhost is Script {
    function run(address worldAddress, bytes32 characterId, uint256 weaponId) external {
        StoreSwitch.setStoreAddress(worldAddress);
        vm.startBroadcast();

        UnequipGhostSystem sys = new UnequipGhostSystem();
        ResourceId systemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "", "UnequipGhost");

        try IWorld(worldAddress).registerSystem(systemId, sys, true) {
            console.log("Registered UnequipGhostSystem");
        } catch {
            IWorld(worldAddress).registerSystem(systemId, sys, true);
            console.log("Upgraded UnequipGhostSystem");
        }

        IWorld(worldAddress).call(
            systemId,
            abi.encodeCall(UnequipGhostSystem.removeWeapon, (characterId, weaponId))
        );
        console.log("Removed weapon from equipped list");

        vm.stopBroadcast();
    }
}
