// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {IWorld} from "@world/IWorld.sol";
import {IERC20} from "@latticexyz/world-modules/src/modules/erc20-puppet/IERC20.sol";
import {Allowances} from "@latticexyz/world-modules/src/modules/erc20-puppet/tables/Allowances.sol";
import {Balances as ERC20Balances} from "@latticexyz/world-modules/src/modules/tokens/tables/Balances.sol";
import {_erc20SystemId, _allowancesTableId, _balancesTableId} from "@latticexyz/world-modules/src/modules/erc20-puppet/utils.sol";
import {GOLD_NAMESPACE} from "../../constants.sol";
import {GoldERC20System} from "../systems/GoldERC20System.sol";

/**
 * @title GoldLib
 * @notice Library for Gold token operations routed through the ERC20 puppet.
 *         All operations emit proper Transfer events from the Gold token address.
 *
 *         Must be called from a system running in delegatecall context (address(this) = World).
 *         Relies on the World having Gold namespace access (set in EnsureAccess.s.sol).
 */
library GoldLib {
    /**
     * @notice Mint Gold to an address. Emits Transfer(address(0), to, amount) from Gold token.
     * @param world The World contract address (pass _world() from the calling system)
     * @param to Recipient address
     * @param amount Amount of Gold to mint (18 decimals)
     */
    function goldMint(address world, address to, uint256 amount) internal {
        if (amount == 0) return;
        ResourceId erc20SystemId = _erc20SystemId(GOLD_NAMESPACE);
        IWorld(world).call(erc20SystemId, abi.encodeCall(GoldERC20System.mintWithAccess, (to, amount)));
    }

    /**
     * @notice Burn Gold from an address. Emits Transfer(from, address(0), amount) from Gold token.
     *         Reverts if from has insufficient balance.
     * @param world The World contract address
     * @param from Address to burn from
     * @param amount Amount of Gold to burn
     */
    function goldBurn(address world, address from, uint256 amount) internal {
        if (amount == 0) return;
        ResourceId erc20SystemId = _erc20SystemId(GOLD_NAMESPACE);
        IWorld(world).call(erc20SystemId, abi.encodeCall(GoldERC20System.burnWithAccess, (from, amount)));
    }

    /**
     * @notice Transfer Gold between addresses. Emits Transfer(from, to, amount) from Gold token.
     *         Sets a max allowance for the World before calling transferFrom on the ERC20System.
     *         This is safe because the World already has direct write access to Gold balance tables.
     * @param world The World contract address
     * @param from Sender address
     * @param to Recipient address
     * @param amount Amount of Gold to transfer
     */
    function goldTransfer(address world, address from, address to, uint256 amount) internal {
        if (amount == 0) return;
        // Grant the World max allowance to transfer from `from`.
        // This is not a new privilege — the World can already write Gold balances directly.
        // We set it to enable the ERC20System's transferFrom path which emits proper events.
        ResourceId allowancesTableId = _allowancesTableId(GOLD_NAMESPACE);
        Allowances.set(allowancesTableId, from, world, type(uint256).max);

        ResourceId erc20SystemId = _erc20SystemId(GOLD_NAMESPACE);
        IWorld(world).call(erc20SystemId, abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
    }

    /**
     * @notice Read Gold balance for an address. Direct table read — no events.
     * @param account Address to check
     * @return balance Gold balance (18 decimals)
     */
    function goldBalanceOf(address account) internal view returns (uint256 balance) {
        ResourceId balancesTableId = _balancesTableId(GOLD_NAMESPACE);
        balance = ERC20Balances.get(balancesTableId, account);
    }
}
