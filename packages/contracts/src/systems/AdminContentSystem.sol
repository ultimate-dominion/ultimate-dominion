// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {NotAdmin} from "../Errors.sol";
import {Admin} from "@codegen/index.sol";
import {IWorld} from "@world/IWorld.sol";
import {ItemType, MobType, EffectType} from "@codegen/common.sol";

/**
 * @title AdminContentSystem
 * @notice Admin functions for content creation (items, mobs, effects, loot)
 * @dev Split from AdminSystem to reduce contract size
 */
contract AdminContentSystem is System {
    modifier onlyAdmin() {
        if (!Admin.get(_msgSender())) revert NotAdmin();
        _;
    }

    function adminCreateItem(
        ItemType itemType,
        uint256 supply,
        uint256 dropChance,
        uint256 price,
        uint256 rarity,
        bytes memory stats,
        string memory itemMetadataURI
    ) public onlyAdmin returns (uint256) {
        return IWorld(_world()).UD__createItem(itemType, supply, dropChance, price, rarity, stats, itemMetadataURI);
    }

    function adminCreateItems(
        ItemType[] memory itemTypes,
        uint256[] memory supply,
        uint256[] memory dropChances,
        uint256[] memory prices,
        uint256[] memory rarities,
        bytes[] memory stats,
        string[] memory itemMetadataURIs
    ) public onlyAdmin {
        IWorld(_world()).UD__createItems(itemTypes, supply, dropChances, prices, rarities, stats, itemMetadataURIs);
    }

    function adminResupplyLootManager(uint256 itemId, uint256 newSupply) public onlyAdmin {
        IWorld(_world()).UD__resupplyLootManager(itemId, newSupply);
    }

    function adminCreateMob(MobType mobType, bytes memory stats, string memory mobMetadataUri) public onlyAdmin returns (uint256) {
        return IWorld(_world()).UD__createMob(mobType, stats, mobMetadataUri);
    }

    function adminCreateMobs(MobType[] calldata mobTypes, bytes[] calldata stats, string[] calldata mobMetadataURIs) external onlyAdmin {
        IWorld(_world()).UD__createMobs(mobTypes, stats, mobMetadataURIs);
    }

    function adminCreateEffect(
        EffectType effectType,
        string memory name,
        bytes memory effectStats
    ) public onlyAdmin returns (bytes32) {
        return IWorld(_world()).UD__createEffect(effectType, name, effectStats);
    }
}
