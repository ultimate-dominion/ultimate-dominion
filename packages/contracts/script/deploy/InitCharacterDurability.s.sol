// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";

import {IWorld} from "@world/IWorld.sol";
import {Characters, CharacterEquipment, ItemDurability, CharacterItemDurability} from "@codegen/index.sol";

/**
 * @title InitCharacterDurability
 * @notice Initializes CharacterItemDurability for all existing character-item pairs.
 *         Must be run AFTER DeployDurabilityData.s.sol sets ItemDurability.maxDurability.
 *
 *         Without this, existing items read currentDurability=0 (MUD default) and
 *         appear broken — canEquipDurability returns false, _degradeItem skips them.
 *
 * Usage:
 *   forge script InitCharacterDurability --broadcast \
 *     --sig "run(address,bytes32[])" <WORLD_ADDRESS> "[charId1,charId2,...]"
 *
 *   Character IDs can be fetched from the indexer snapshot.
 */
contract InitCharacterDurability is Script {
    function run(address _worldAddress, bytes32[] calldata characterIds) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);
        StoreSwitch.setStoreAddress(_worldAddress);

        IWorld world = IWorld(_worldAddress);

        console.log("=== InitCharacterDurability ===");
        console.log("Characters to process:", characterIds.length);

        uint256 initialized = 0;
        uint256 skipped = 0;

        for (uint256 c; c < characterIds.length; c++) {
            bytes32 charId = characterIds[c];

            // Process equipped weapons
            uint256 wc = CharacterEquipment.lengthEquippedWeapons(charId);
            for (uint256 i; i < wc; i++) {
                uint256 itemId = CharacterEquipment.getItemEquippedWeapons(charId, i);
                if (_initItem(charId, itemId)) initialized++;
                else skipped++;
            }

            // Process equipped armor
            uint256 ac = CharacterEquipment.lengthEquippedArmor(charId);
            for (uint256 i; i < ac; i++) {
                uint256 itemId = CharacterEquipment.getItemEquippedArmor(charId, i);
                if (_initItem(charId, itemId)) initialized++;
                else skipped++;
            }

            // Process equipped spells (won't have durability, but safe to check)
            uint256 sc = CharacterEquipment.lengthEquippedSpells(charId);
            for (uint256 i; i < sc; i++) {
                uint256 itemId = CharacterEquipment.getItemEquippedSpells(charId, i);
                if (_initItem(charId, itemId)) initialized++;
                else skipped++;
            }

            if ((c + 1) % 20 == 0) {
                console.log("  Progress:", c + 1, "/", characterIds.length, "characters");
            }
        }

        vm.stopBroadcast();

        console.log("Initialized:", initialized, "items");
        console.log("Skipped:", skipped, "(no durability or already set)");
        console.log("=== InitCharacterDurability Complete ===");
    }

    function _initItem(bytes32 charId, uint256 itemId) internal returns (bool) {
        uint256 maxDur = ItemDurability.getMaxDurability(itemId);
        if (maxDur == 0) return false; // No durability tracking

        uint256 currentDur = CharacterItemDurability.getCurrentDurability(charId, itemId);
        if (currentDur > 0) return false; // Already initialized

        CharacterItemDurability.setCurrentDurability(charId, itemId, maxDur);
        return true;
    }
}
