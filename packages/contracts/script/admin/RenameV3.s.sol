// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {System} from "@latticexyz/world/src/System.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM} from "@latticexyz/world/src/worldResourceTypes.sol";
import {IWorld} from "@world/IWorld.sol";
import {Mobs} from "@codegen/index.sol";
import {ERC1155URIStorage} from "@erc1155/tables/ERC1155URIStorage.sol";
import {_erc1155URIStorageTableId} from "@erc1155/utils.sol";
import {ITEMS_NAMESPACE} from "../../constants.sol";

/**
 * @title RenameV3System
 * @notice Root system that renames item + monster metadata URIs.
 *         Runs via delegatecall with World context — bypasses access checks.
 */
contract RenameV3System is System {
    function renameAll() public {
        ResourceId tableId = _erc1155URIStorageTableId(ITEMS_NAMESPACE);

        // --- Item URI renames (8 weapons + 2 armor) ---

        ERC1155URIStorage.setUri(tableId, 32, "weapon:light_mace");          // was weapon:steel_mace
        ERC1155URIStorage.setUri(tableId, 33, "weapon:shortbow");            // was weapon:recurve_bow
        ERC1155URIStorage.setUri(tableId, 35, "weapon:notched_blade");       // was weapon:etched_blade
        ERC1155URIStorage.setUri(tableId, 39, "weapon:dire_rat_fang");       // was weapon:rat_kings_fang
        ERC1155URIStorage.setUri(tableId, 41, "weapon:notched_cleaver");     // was weapon:brutes_cleaver
        ERC1155URIStorage.setUri(tableId, 42, "weapon:crystal_shard");       // was weapon:crystal_blade
        ERC1155URIStorage.setUri(tableId, 43, "weapon:gnarled_cudgel");      // was weapon:trolls_bonebreaker
        ERC1155URIStorage.setUri(tableId, 46, "weapon:stone_maul");          // was weapon:giants_club

        ERC1155URIStorage.setUri(tableId, 19, "armor:etched_chainmail");     // was armor:chainmail_shirt
        ERC1155URIStorage.setUri(tableId, 23, "armor:carved_stone_plate");   // was armor:cracked_stone_plate

        // --- Monster metadata renames (6 monsters) ---

        Mobs.setMobMetadata(1, "monster:dire_rat");        // was monster:cave_rat
        Mobs.setMobMetadata(5, "monster:ironhide_troll");   // was monster:cave_troll
        Mobs.setMobMetadata(7, "monster:bonecaster");       // was monster:lich_acolyte
        Mobs.setMobMetadata(8, "monster:rock_golem");       // was monster:stone_giant
        Mobs.setMobMetadata(9, "monster:pale_stalker");     // was monster:shadow_stalker
        Mobs.setMobMetadata(10, "monster:dusk_drake");      // was monster:shadow_dragon
    }
}

/**
 * @title RenameV3
 * @notice Deploys RenameV3System as root system and executes it.
 * @dev Run with:
 *   cd packages/contracts && forge script script/admin/RenameV3.s.sol \
 *     --sig "run(address)" 0x99d01939F58B965E6E84a1D167E710Abdf5764b0 \
 *     --rpc-url "https://rpc.ultimatedominion.com?token=..." \
 *     --private-key 0x... --broadcast --skip-simulation
 */
contract RenameV3 is Script {
    function run(address worldAddress) external {
        StoreSwitch.setStoreAddress(worldAddress);
        vm.startBroadcast();

        console.log("=== RenameV3 ===");
        console.log("World:", worldAddress);

        // Deploy root system
        RenameV3System sys = new RenameV3System();
        ResourceId systemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "", "RenameV3");

        IWorld(worldAddress).registerSystem(systemId, sys, true);
        console.log("Registered RenameV3System");

        // Execute via world.call (root system = delegatecall, full access)
        IWorld(worldAddress).call(
            systemId,
            abi.encodeCall(RenameV3System.renameAll, ())
        );
        console.log("All renames applied");

        vm.stopBroadcast();
        console.log("=== RenameV3 Complete ===");
    }
}
