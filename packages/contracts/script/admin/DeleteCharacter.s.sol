// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;
import "forge-std/Script.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {
    Characters,
    CharacterOwner,
    NameExists,
    Stats,
    Spawned,
    PositionV2,
    CharacterEquipment,
    CharacterFirstActions,
    CharacterZoneCompletion,
    PlayerLifetimeStats
} from "@codegen/index.sol";

/**
 * @notice Deletes a character and restores CharacterOwner to the correct character.
 *
 * Usage (beta):
 *   source .env.testnet && forge script script/DeleteCharacter.s.sol \
 *     --rpc-url $RPC_HTTP_URL --broadcast --private-key $PRIVATE_KEY
 */
contract DeleteCharacter is Script {
    function run() external {
        address worldAddress = vm.envAddress("WORLD_ADDRESS");
        StoreSwitch.setStoreAddress(worldAddress);

        // ---- CONFIGURE THESE ----
        address ownerAddr = 0xA50f7B2d929a01dE39c933CFf795D082A0575adC;

        // Abril = tokenId 2
        uint256 deleteTokenId = 2;
        bytes32 deleteCharId = bytes32(uint256(uint160(ownerAddr)) << 96 | deleteTokenId);

        // Pechuga = tokenId 1 (restore CharacterOwner to this)
        uint256 restoreTokenId = 1;
        bytes32 restoreCharId = bytes32(uint256(uint160(ownerAddr)) << 96 | restoreTokenId);
        // -------------------------

        // Read Abril's name before deleting so we can free it
        bytes32 abrilName = Characters.getName(deleteCharId);

        console.log("Deleting character:");
        console.logBytes32(deleteCharId);
        console.log("Restoring CharacterOwner to:");
        console.logBytes32(restoreCharId);
        console.log("Freeing name:");
        console.logBytes32(abrilName);

        vm.startBroadcast();

        // 1. Delete Characters table entry
        Characters.deleteRecord(deleteCharId);

        // 2. Delete Stats
        Stats.deleteRecord(deleteCharId);

        // 3. Delete Spawned (despawn)
        Spawned.deleteRecord(deleteCharId);

        // 4. Delete PositionV2
        PositionV2.deleteRecord(deleteCharId);

        // 5. Delete CharacterEquipment
        CharacterEquipment.deleteRecord(deleteCharId);

        // 6. Delete CharacterFirstActions
        CharacterFirstActions.deleteRecord(deleteCharId);

        // 7. Delete PlayerLifetimeStats
        PlayerLifetimeStats.deleteRecord(deleteCharId);

        // 8. Free the name
        if (abrilName != bytes32(0)) {
            NameExists.set(abrilName, false);
        }

        // 9. ERC721 Owners/Balances tables are in the "characters" namespace
        //    which the deployer can't write to directly. These are non-critical
        //    for gameplay — skip them. The token will be orphaned but harmless.

        // 10. Restore CharacterOwner to pechuga
        CharacterOwner.set(ownerAddr, restoreTokenId, restoreCharId);

        vm.stopBroadcast();

        console.log("Done. CharacterOwner restored to pechuga.");
    }
}
