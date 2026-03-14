// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {IWorld} from "@world/IWorld.sol";
import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_NAMESPACE} from "@latticexyz/world/src/worldResourceTypes.sol";
import {WORLD_NAMESPACE} from "../../constants.sol";
import {
    GasStationConfig,
    GasStationCooldown,
    GasStationSwapConfig,
    Stats,
    CharacterOwner,
    CharacterOwnerData,
    UltimateDominionConfig,
    AdventureEscrow
} from "@codegen/index.sol";
import {Balances as ERC20Balances} from "@latticexyz/world-modules/src/modules/tokens/tables/Balances.sol";
import {TotalSupply as ERC20TotalSupply} from "@latticexyz/world-modules/src/modules/erc20-puppet/tables/TotalSupply.sol";
import {_balancesTableId as _goldBalancesTableId, _totalSupplyTableId as _goldTotalSupplyTableId} from "@latticexyz/world-modules/src/modules/erc20-puppet/utils.sol";
import {GOLD_NAMESPACE, GAS_STATION_MIN_LEVEL, UNISWAP_MIN_OUTPUT} from "../../constants.sol";
import {IERC20Mintable} from "@latticexyz/world-modules/src/modules/erc20-puppet/IERC20Mintable.sol";
import {ISwapRouter} from "@interfaces/ISwapRouter.sol";
import {IWETH} from "@interfaces/IWETH.sol";
import {
    GasStationDisabled,
    GasStationCooldownActive,
    GasStationMaxSwapExceeded,
    GasStationInsufficientTreasury,
    GasStationBelowMinLevel,
    GasStationTransferFailed,
    GasStationZeroAmount,
    GasStationSwapFailed,
    GasStationNotRelayer,
    GasStationArrayMismatch,
    InsufficientBalance
} from "../Errors.sol";
import {PauseLib} from "../libraries/PauseLib.sol";
import {_requireOwner} from "../utils.sol";

/**
 * @title GasStationSystem
 * @notice Allows players (level 3+) to swap Gold for ETH to cover gas.
 * @dev Two modes:
 *      1. Uniswap V3 swap: Gold is sold on GOLD/WETH pool → ETH to player (when swapRouter configured)
 *      2. Fallback: Gold burned from supply, ETH from pre-funded treasury (when swapRouter == address(0))
 *
 *      Also provides chargeGasGold() for the self-hosted relayer to charge embedded wallet players.
 *
 *      Namespaced (non-root) system — address(this) is the system contract address.
 *      ETH treasury lives at this system's address (for fallback mode and received WETH unwraps).
 */
contract GasStationSystem is System {
    bool private _locked;
    modifier nonReentrant() {
        require(!_locked, "ReentrancyGuard: reentrant call");
        _locked = true;
        _;
        _locked = false;
    }

    /**
     * @notice Swap gold for ETH. Uses Uniswap V3 if configured, otherwise falls back to burn+treasury.
     * @param characterId The player's character ID
     * @param goldAmount Amount of gold to swap (in 1e18 units)
     */
    function buyGas(bytes32 characterId, uint256 goldAmount, uint256 minEthOutput) public nonReentrant {
        PauseLib.requireNotPaused();

        // Check gas station is enabled
        if (!GasStationConfig.getEnabled()) revert GasStationDisabled();

        // Must provide a nonzero amount
        if (goldAmount == 0) revert GasStationZeroAmount();

        // Verify character ownership
        address caller = _msgSender();
        CharacterOwnerData memory ownerData = CharacterOwner.get(caller);
        require(ownerData.characterId == characterId, "Not character owner");

        // Check level >= 3
        uint256 level = Stats.getLevel(characterId);
        if (level < GAS_STATION_MIN_LEVEL) revert GasStationBelowMinLevel();

        // Check cooldown
        uint256 lastSwap = GasStationCooldown.getLastSwap(caller);
        uint256 cooldown = GasStationConfig.getCooldownSeconds();
        if (block.timestamp < lastSwap + cooldown) revert GasStationCooldownActive();

        // Check max swap
        uint256 maxGold = GasStationConfig.getMaxGoldPerSwap();
        if (goldAmount > maxGold) revert GasStationMaxSwapExceeded();

        // Check player has sufficient gold (wallet + escrow fallback)
        ResourceId balancesTableId = _goldBalancesTableId(GOLD_NAMESPACE);
        uint256 currentGold = ERC20Balances.get(balancesTableId, caller);

        // If wallet balance insufficient, promote escrow gold to ERC20 balance
        if (currentGold < goldAmount) {
            uint256 shortfall = goldAmount - currentGold;
            uint256 escrowBalance = AdventureEscrow.get(characterId);
            if (currentGold + escrowBalance < goldAmount) revert InsufficientBalance();

            // Move escrow → ERC20 (mint into supply since escrow is virtual)
            AdventureEscrow.set(characterId, escrowBalance - shortfall);
            currentGold += shortfall;
            ERC20Balances.set(balancesTableId, caller, currentGold);

            ResourceId totalSupplyTableId = _goldTotalSupplyTableId(GOLD_NAMESPACE);
            uint256 currentSupply = ERC20TotalSupply.get(totalSupplyTableId);
            ERC20TotalSupply.set(totalSupplyTableId, currentSupply + shortfall);
        }

        // Update cooldown
        GasStationCooldown.setLastSwap(caller, block.timestamp);

        // Route to Uniswap swap or fallback
        address swapRouter = GasStationSwapConfig.getSwapRouter();
        if (swapRouter != address(0)) {
            _buyGasViaUniswap(caller, goldAmount, currentGold, balancesTableId, swapRouter, minEthOutput);
        } else {
            _buyGasViaTreasury(caller, goldAmount, currentGold, balancesTableId);
        }
    }

    /**
     * @dev Uniswap V3 path: transfer gold to system, swap on DEX, unwrap WETH, send ETH to player.
     *      Gold is NOT burned — total supply unchanged. Gold re-enters circulation via DEX buyers.
     */
    function _buyGasViaUniswap(
        address caller,
        uint256 goldAmount,
        uint256 currentGold,
        ResourceId balancesTableId,
        address swapRouter,
        uint256 minEthOutput
    ) internal {
        // 1. Deduct gold from player
        ERC20Balances.set(balancesTableId, caller, currentGold - goldAmount);

        // 2. Credit gold to system address (transfer, NOT burn — total supply unchanged)
        uint256 systemGold = ERC20Balances.get(balancesTableId, address(this));
        ERC20Balances.set(balancesTableId, address(this), systemGold + goldAmount);

        // 3. Approve Uniswap router to spend gold from system address
        address goldTokenAddr = UltimateDominionConfig.getGoldToken();
        IERC20Mintable(goldTokenAddr).approve(swapRouter, goldAmount);

        // 4. Swap gold → WETH via Uniswap V3
        address weth = GasStationSwapConfig.getWeth();
        uint24 poolFee = GasStationSwapConfig.getPoolFee();

        uint256 wethAmount = ISwapRouter(swapRouter).exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: goldTokenAddr,
                tokenOut: weth,
                fee: poolFee,
                recipient: address(this),
                amountIn: goldAmount,
                amountOutMinimum: minEthOutput,
                sqrtPriceLimitX96: 0
            })
        );

        if (wethAmount == 0) revert GasStationSwapFailed();

        // 5. Unwrap WETH to ETH
        IWETH(weth).withdraw(wethAmount);

        // 6. Send ETH to player
        (bool success,) = caller.call{value: wethAmount}("");
        if (!success) revert GasStationTransferFailed();
    }

    /**
     * @dev Fallback path: burn gold from supply, send ETH from pre-funded treasury.
     *      Used when Uniswap swap is not configured (swapRouter == address(0)).
     */
    function _buyGasViaTreasury(
        address caller,
        uint256 goldAmount,
        uint256 currentGold,
        ResourceId balancesTableId
    ) internal {
        // Calculate ETH output at fixed rate
        uint256 ethPerGold = GasStationConfig.getEthPerGold();
        uint256 ethOutput = (goldAmount * ethPerGold) / 1e18;

        // Check treasury has sufficient ETH
        if (address(this).balance < ethOutput) revert GasStationInsufficientTreasury();

        // Burn gold (deduct balance + reduce total supply)
        ResourceId totalSupplyTableId = _goldTotalSupplyTableId(GOLD_NAMESPACE);
        ERC20Balances.set(balancesTableId, caller, currentGold - goldAmount);
        uint256 currentSupply = ERC20TotalSupply.get(totalSupplyTableId);
        ERC20TotalSupply.set(totalSupplyTableId, currentSupply - goldAmount);

        // Send ETH to caller
        (bool success,) = caller.call{value: ethOutput}("");
        if (!success) revert GasStationTransferFailed();
    }

    // ==================== Relayer Gas Charging ====================

    /**
     * @notice Charge gold from an embedded wallet player on behalf of the relayer.
     * @dev Only callable by the configured relayer address.
     *      Transfers gold from player → relayer (direct table writes, total supply unchanged).
     * @param player The player's wallet address
     * @param characterId The player's character ID
     */
    function chargeGasGold(address player, bytes32 characterId) public {
        address relayer = GasStationSwapConfig.getRelayerAddress();
        if (_msgSender() != relayer) revert GasStationNotRelayer();

        _chargeGasGoldSingle(player, characterId, relayer);
    }

    /**
     * @notice Batch charge gold from multiple embedded wallet players.
     * @dev Single tx — amortizes gas across N players.
     * @param players Array of player wallet addresses
     * @param characterIds Array of corresponding character IDs
     */
    function batchChargeGasGold(address[] calldata players, bytes32[] calldata characterIds) public {
        if (players.length != characterIds.length) revert GasStationArrayMismatch();

        address relayer = GasStationSwapConfig.getRelayerAddress();
        if (_msgSender() != relayer) revert GasStationNotRelayer();

        for (uint256 i = 0; i < players.length; i++) {
            _chargeGasGoldSingle(players[i], characterIds[i], relayer);
        }
    }

    /**
     * @dev Internal: charge gold from a single player → relayer.
     */
    function _chargeGasGoldSingle(address player, bytes32 characterId, address relayer) internal {
        // Verify ownership
        CharacterOwnerData memory ownerData = CharacterOwner.get(player);
        require(ownerData.characterId == characterId, "Not character owner");

        // Check level >= 3
        uint256 level = Stats.getLevel(characterId);
        if (level < GAS_STATION_MIN_LEVEL) revert GasStationBelowMinLevel();

        // Get charge amount
        uint256 chargeAmount = GasStationSwapConfig.getGoldPerGasCharge();

        ResourceId balancesTableId = _goldBalancesTableId(GOLD_NAMESPACE);
        uint256 playerGold = ERC20Balances.get(balancesTableId, player);

        if (playerGold >= chargeAmount) {
            // Wallet covers full charge — transfer (no supply change)
            ERC20Balances.set(balancesTableId, player, playerGold - chargeAmount);
            uint256 relayerGold = ERC20Balances.get(balancesTableId, relayer);
            ERC20Balances.set(balancesTableId, relayer, relayerGold + chargeAmount);
        } else {
            // Wallet insufficient — take what's there, pull remainder from escrow
            uint256 shortfall = chargeAmount - playerGold;
            uint256 escrowBalance = AdventureEscrow.get(characterId);
            if (escrowBalance < shortfall) revert InsufficientBalance();

            // Deduct wallet
            if (playerGold > 0) {
                ERC20Balances.set(balancesTableId, player, 0);
            }

            // Deduct escrow
            AdventureEscrow.set(characterId, escrowBalance - shortfall);

            // Credit relayer full charge amount
            uint256 relayerGold = ERC20Balances.get(balancesTableId, relayer);
            ERC20Balances.set(balancesTableId, relayer, relayerGold + chargeAmount);

            // Escrow gold was burned on deposit — mint the shortfall back into supply
            ResourceId totalSupplyTableId = _goldTotalSupplyTableId(GOLD_NAMESPACE);
            uint256 currentSupply = ERC20TotalSupply.get(totalSupplyTableId);
            ERC20TotalSupply.set(totalSupplyTableId, currentSupply + shortfall);
        }
    }

    /**
     * @notice Fault-tolerant batch charge: skips ineligible players, supports per-player tx counts.
     * @dev Accumulates relayer credit in memory, writes once at end (gas efficient).
     * @param players Array of player wallet addresses
     * @param characterIds Array of corresponding character IDs
     * @param counts Array of tx counts per player (each tx = goldPerGasCharge)
     * @return charged Actual gold amounts charged per player (0 if skipped)
     */
    function batchChargeGasGoldWithCounts(
        address[] calldata players,
        bytes32[] calldata characterIds,
        uint256[] calldata counts
    ) public returns (uint256[] memory charged) {
        if (players.length != characterIds.length || players.length != counts.length) {
            revert GasStationArrayMismatch();
        }

        address relayer = GasStationSwapConfig.getRelayerAddress();
        if (_msgSender() != relayer) revert GasStationNotRelayer();

        uint256 chargePerTx = GasStationSwapConfig.getGoldPerGasCharge();
        ResourceId balancesTableId = _goldBalancesTableId(GOLD_NAMESPACE);

        charged = new uint256[](players.length);
        uint256 totalRelayerCredit;
        uint256 totalMinted;

        for (uint256 i = 0; i < players.length; i++) {
            // Skip: no character or wrong characterId
            CharacterOwnerData memory ownerData = CharacterOwner.get(players[i]);
            if (ownerData.characterId != characterIds[i] || ownerData.characterId == bytes32(0)) {
                continue;
            }

            // Skip: below level 3
            uint256 level = Stats.getLevel(characterIds[i]);
            if (level < GAS_STATION_MIN_LEVEL) continue;

            // Calculate max charge for this player
            uint256 fullCharge = counts[i] * chargePerTx;
            uint256 playerGold = ERC20Balances.get(balancesTableId, players[i]);

            uint256 fromWallet;
            uint256 fromEscrow;

            if (playerGold >= fullCharge) {
                fromWallet = fullCharge;
            } else {
                fromWallet = playerGold;
                uint256 shortfall = fullCharge - playerGold;
                uint256 escrowBal = AdventureEscrow.get(characterIds[i]);
                fromEscrow = escrowBal < shortfall ? escrowBal : shortfall;
                if (fromEscrow > 0) {
                    AdventureEscrow.set(characterIds[i], escrowBal - fromEscrow);
                }
            }

            uint256 actual = fromWallet + fromEscrow;
            if (actual == 0) continue;

            // Deduct wallet
            if (fromWallet > 0) {
                ERC20Balances.set(balancesTableId, players[i], playerGold - fromWallet);
            }

            charged[i] = actual;
            totalRelayerCredit += actual;
            totalMinted += fromEscrow;
        }

        // Single relayer balance write
        if (totalRelayerCredit > 0) {
            uint256 relayerGold = ERC20Balances.get(balancesTableId, relayer);
            ERC20Balances.set(balancesTableId, relayer, relayerGold + totalRelayerCredit);
        }

        // Mint for escrow-sourced gold (increase total supply)
        if (totalMinted > 0) {
            ResourceId totalSupplyTableId = _goldTotalSupplyTableId(GOLD_NAMESPACE);
            uint256 currentSupply = ERC20TotalSupply.get(totalSupplyTableId);
            ERC20TotalSupply.set(totalSupplyTableId, currentSupply + totalMinted);
        }
    }

    // ==================== Admin Functions ====================

    /**
     * @notice Update gas station configuration. Admin only.
     */
    function setGasStationConfig(
        uint256 ethPerGold,
        uint256 maxGoldPerSwap,
        uint256 cooldownSeconds,
        bool enabled
    ) public {
        _requireOwner(address(this), _msgSender());
        GasStationConfig.set(ethPerGold, maxGoldPerSwap, cooldownSeconds, enabled);
    }

    /**
     * @notice Update swap configuration (Uniswap V3 + relayer). Admin only.
     */
    function setGasStationSwapConfig(
        address swapRouter,
        address weth,
        uint24 poolFee,
        address relayerAddress,
        uint256 goldPerGasCharge
    ) public {
        _requireOwner(address(this), _msgSender());
        GasStationSwapConfig.set(swapRouter, weth, poolFee, relayerAddress, goldPerGasCharge);
    }

    /**
     * @notice Fund the gas treasury with ETH. Admin only.
     * @dev MUD credits msg.value to the UD namespace balance. We then
     *      call transferBalanceToAddress to move it to the system's own address.
     */
    function fundGasTreasury() public payable {
        _requireOwner(address(this), _msgSender());
        uint256 amount = _msgValue();
        ResourceId udNamespaceId = WorldResourceIdLib.encodeNamespace(WORLD_NAMESPACE);
        IWorld(_world()).transferBalanceToAddress(udNamespaceId, address(this), amount);
    }

    /**
     * @notice Withdraw ETH from the gas treasury. Admin only.
     */
    function withdrawGasTreasury(uint256 amount) public {
        _requireOwner(address(this), _msgSender());
        require(address(this).balance >= amount, "Insufficient treasury");
        (bool success,) = _msgSender().call{value: amount}("");
        if (!success) revert GasStationTransferFailed();
    }

    /**
     * @notice View the current treasury balance.
     */
    function gasTreasuryBalance() public view returns (uint256) {
        return address(this).balance;
    }

    // Allow the system to receive ETH (from WETH unwrap and treasury funding)
    receive() external payable {}
}
