// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {DelegationControl} from "@latticexyz/world/src/DelegationControl.sol";
import {ResourceId} from "@latticexyz/world/src/WorldResourceId.sol";
import {AllowedGameSystems} from "@codegen/index.sol";

/**
 * @title GameDelegationControl
 * @notice Custom delegation control that restricts burner wallets to whitelisted gameplay systems.
 * @dev A compromised burner can fight, move, and shop, but cannot drain assets or access admin functions.
 *
 * Security model:
 * - AllowedGameSystems table: admin-configurable whitelist of safe system ResourceIds
 * - LootManager function-level filtering: blocks transferGold, setGoldApproval, setItemsApproval
 * - All non-whitelisted systems are blocked by omission (admin, pause, config, etc.)
 */
contract GameDelegationControl is DelegationControl {
    // LootManager blocked selectors (hardcoded security boundary)
    bytes4 private constant TRANSFER_GOLD_SELECTOR = bytes4(keccak256("transferGold(address,uint256)"));
    bytes4 private constant SET_GOLD_APPROVAL_SELECTOR = bytes4(keccak256("setGoldApproval(address,uint256)"));
    bytes4 private constant SET_ITEMS_APPROVAL_SELECTOR = bytes4(keccak256("setItemsApproval(address,bool)"));

    // LootManagerSystem ResourceId name (16 bytes, as registered in mud.config.ts)
    bytes16 private constant LOOT_MANAGER_NAME = "LootManagerSyste";

    /**
     * @notice Verify whether a delegated call is allowed.
     * @param systemId The system being called
     * @param callData The calldata being passed to the system
     * @return True if the call is allowed through delegation
     */
    function verify(address, ResourceId systemId, bytes memory callData) public view returns (bool) {
        // Check if the system is in the whitelist
        if (!AllowedGameSystems.getAllowed(systemId)) {
            return false;
        }

        // For LootManager, apply function-level filtering
        if (_isLootManager(systemId) && callData.length >= 4) {
            bytes4 selector = bytes4(callData[0]) | (bytes4(callData[1]) >> 8) | (bytes4(callData[2]) >> 16) | (bytes4(callData[3]) >> 24);
            if (
                selector == TRANSFER_GOLD_SELECTOR ||
                selector == SET_GOLD_APPROVAL_SELECTOR ||
                selector == SET_ITEMS_APPROVAL_SELECTOR
            ) {
                return false;
            }
        }

        return true;
    }

    /**
     * @notice Initialize delegation. No-op since whitelist is global, not per-delegation.
     * @dev Called by MUD during registerDelegation. delegator is _msgSender().
     */
    function initDelegation(address) public {}

    /**
     * @dev Check if the systemId corresponds to LootManagerSystem by comparing the name portion.
     * ResourceId format: 2 bytes type + 14 bytes namespace + 16 bytes name
     */
    function _isLootManager(ResourceId systemId) internal pure returns (bool) {
        // Extract the last 16 bytes (name) from the ResourceId
        bytes32 raw = ResourceId.unwrap(systemId);
        bytes16 name = bytes16(raw << 128);
        return name == LOOT_MANAGER_NAME;
    }
}
