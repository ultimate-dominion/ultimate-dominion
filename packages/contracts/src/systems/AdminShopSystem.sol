// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {NotAdmin, InvalidShopEntity} from "../Errors.sol";
import {Admin, Shops, ShopsData} from "@codegen/index.sol";
import {IWorld} from "@world/IWorld.sol";
import {MobType} from "@codegen/common.sol";

contract AdminShopSystem is System {
    modifier onlyAdmin() {
        if (!Admin.get(_msgSender())) revert NotAdmin();
        _;
    }

    function adminCreateShop(
        uint16 x,
        uint16 y,
        ShopsData memory shopData,
        string memory shopMetadataUri
    ) public onlyAdmin returns (bytes32 entityId) {
        // Create the shop mob
        uint256 mobId = IWorld(_world()).UD__createMob(MobType.Shop, abi.encode(shopData), shopMetadataUri);

        // Spawn at location - create entity ID with position encoded
        entityId = IWorld(_world()).UD__spawnMob(mobId, x, y);

        // Configure shop data
        Shops.set(entityId, shopData);
    }

    // Update shop inventory without respawning
    function adminUpdateShop(bytes32 shopEntityId, ShopsData memory shopData) public onlyAdmin {
        if (!IWorld(_world()).UD__isShop(shopEntityId)) revert InvalidShopEntity();
        Shops.set(shopEntityId, shopData);
    }

    // Spawn a mob at a specific location
    function adminSpawnMob(uint256 mobId, uint16 x, uint16 y) public onlyAdmin returns (bytes32 entityId) {
        return IWorld(_world()).UD__spawnMob(mobId, x, y);
    }
}
