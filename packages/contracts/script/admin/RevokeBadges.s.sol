// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {System} from "@latticexyz/world/src/System.sol";
import {IWorld} from "@world/IWorld.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM, RESOURCE_TABLE} from "@latticexyz/world/src/worldResourceTypes.sol";
import {Owners as ERC721Owners} from "@latticexyz/world-modules/src/modules/erc721-puppet/tables/Owners.sol";
import {Balances as ERC721Balances} from "@latticexyz/world-modules/src/modules/tokens/tables/Balances.sol";
import {BADGES_NAMESPACE} from "../../constants.sol";

/**
 * @title RevokeBadgesSystem
 * @notice Root system that revokes illegitimate badges via direct table writes.
 *         Root systems run via delegatecall with World context, bypassing access control.
 */
contract RevokeBadgesSystem is System {
    function revokeAll() public {
        ResourceId ownersTableId = WorldResourceIdLib.encode(RESOURCE_TABLE, BADGES_NAMESPACE, "Owners");
        ResourceId balancesTableId = WorldResourceIdLib.encode(RESOURCE_TABLE, BADGES_NAMESPACE, "Balances");

        // Base-200 badges (invalid -- should not exist)
        _revoke(ownersTableId, balancesTableId, 200_000_001); // mokn
        _revoke(ownersTableId, balancesTableId, 200_000_006); // pechugaa
        _revoke(ownersTableId, balancesTableId, 200_000_010); // Masterpiece
        _revoke(ownersTableId, balancesTableId, 200_000_014); // TK
        _revoke(ownersTableId, balancesTableId, 200_000_015); // Tony
        _revoke(ownersTableId, balancesTableId, 200_000_016); // King

        // Base-201 badges (Lore Keeper) -- unearned
        // Masterpiece (201000010) excluded -- has 8/8 fragments
        _revoke(ownersTableId, balancesTableId, 201_000_001); // mokn
        _revoke(ownersTableId, balancesTableId, 201_000_006); // pechugaa
        _revoke(ownersTableId, balancesTableId, 201_000_014); // TK
        _revoke(ownersTableId, balancesTableId, 201_000_015); // Tony
        _revoke(ownersTableId, balancesTableId, 201_000_016); // King
    }

    function _revoke(ResourceId ownersTableId, ResourceId balancesTableId, uint256 badgeId) internal {
        address owner = ERC721Owners.get(ownersTableId, badgeId);
        if (owner == address(0)) return;

        ERC721Owners.set(ownersTableId, badgeId, address(0));

        uint256 bal = ERC721Balances.get(balancesTableId, owner);
        if (bal > 0) {
            ERC721Balances.set(balancesTableId, owner, bal - 1);
        }
    }
}

/**
 * @title RevokeBadges
 * @notice Deploys RevokeBadgesSystem as a root system, calls revokeAll, done.
 *
 *         Usage:
 *         source .env.mainnet && forge script script/admin/RevokeBadges.s.sol \
 *           --tc RevokeBadges --sig "run(address)" $WORLD_ADDRESS \
 *           --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
 */
contract RevokeBadges is Script {
    function run(address worldAddress) external {
        StoreSwitch.setStoreAddress(worldAddress);
        vm.startBroadcast();

        console.log("=== Revoke Illegitimate Badges ===");
        console.log("World:", worldAddress);

        RevokeBadgesSystem sys = new RevokeBadgesSystem();

        ResourceId systemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "", "RevokeBadges");
        try IWorld(worldAddress).registerSystem(systemId, sys, true) {
            console.log("Registered RevokeBadgesSystem");
        } catch {
            IWorld(worldAddress).registerSystem(systemId, sys, true);
            console.log("Upgraded RevokeBadgesSystem");
        }

        IWorld(worldAddress).call(
            systemId,
            abi.encodeCall(RevokeBadgesSystem.revokeAll, ())
        );
        console.log("All illegitimate badges revoked");

        vm.stopBroadcast();
    }
}
