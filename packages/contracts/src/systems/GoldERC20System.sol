// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {ERC20System} from "@latticexyz/world-modules/src/modules/erc20-puppet/ERC20System.sol";
import {SystemRegistry} from "@latticexyz/world/src/codegen/tables/SystemRegistry.sol";
import {AccessControl} from "@latticexyz/world/src/AccessControl.sol";

/**
 * @title GoldERC20System
 * @notice Drop-in replacement for the Gold namespace's ERC20System.
 *         MUD's default ERC20System.mint/burn require namespace OWNERSHIP,
 *         which is a singleton — only one address can be owner. This breaks
 *         cross-namespace calls (UD systems calling GoldLib).
 *
 *         This subclass adds mintWithAccess/burnWithAccess that check namespace
 *         ACCESS instead of ownership. Multiple systems can hold access grants.
 *         All ERC20 standard functions (transfer, approve, etc.) are unchanged.
 */
contract GoldERC20System is ERC20System {
    /**
     * @notice Mint Gold tokens. Requires caller to have access to the Gold namespace.
     * @param account Recipient address
     * @param value Amount to mint (18 decimals)
     */
    function mintWithAccess(address account, uint256 value) public {
        _requireNamespaceAccess();
        if (account == address(0)) revert ERC20InvalidReceiver(address(0));
        _update(address(0), account, value);
    }

    /**
     * @notice Burn Gold tokens. Requires caller to have access to the Gold namespace.
     * @param account Address to burn from
     * @param value Amount to burn (18 decimals)
     */
    function burnWithAccess(address account, uint256 value) public {
        _requireNamespaceAccess();
        if (account == address(0)) revert ERC20InvalidSender(address(0));
        _update(account, address(0), value);
    }

    /**
     * @notice Transfer Gold between addresses. Requires caller to have access to the Gold namespace.
     *         Bypasses the ERC20 allowance mechanism — MUD's _msgSender() returns the calling
     *         system's registered address (not the World), so allowance-based transferFrom fails
     *         for system-to-system calls.
     * @param from Sender address
     * @param to Recipient address
     * @param value Amount to transfer (18 decimals)
     */
    function transferWithAccess(address from, address to, uint256 value) public {
        _requireNamespaceAccess();
        if (from == address(0)) revert ERC20InvalidSender(address(0));
        if (to == address(0)) revert ERC20InvalidReceiver(address(0));
        _update(from, to, value);
    }

    /**
     * @dev Check that _msgSender() has access to this system's namespace.
     *      Uses StoreSwitch (not StoreCore) since this is a non-root system.
     */
    function _requireNamespaceAccess() internal view {
        AccessControl.requireAccess(SystemRegistry.get(address(this)), _msgSender());
    }

}
