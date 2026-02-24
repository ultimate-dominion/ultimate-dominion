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
    Stats,
    CharacterOwner,
    CharacterOwnerData
} from "@codegen/index.sol";
import {Balances as ERC20Balances} from "@latticexyz/world-modules/src/modules/tokens/tables/Balances.sol";
import {TotalSupply as ERC20TotalSupply} from "@latticexyz/world-modules/src/modules/erc20-puppet/tables/TotalSupply.sol";
import {_balancesTableId as _goldBalancesTableId, _totalSupplyTableId as _goldTotalSupplyTableId} from "@latticexyz/world-modules/src/modules/erc20-puppet/utils.sol";
import {GOLD_NAMESPACE, GAS_STATION_MIN_LEVEL} from "../../constants.sol";
import {
    GasStationDisabled,
    GasStationCooldownActive,
    GasStationMaxSwapExceeded,
    GasStationInsufficientTreasury,
    GasStationBelowMinLevel,
    GasStationTransferFailed,
    GasStationZeroAmount,
    InsufficientBalance
} from "../Errors.sol";
import {PauseLib} from "../libraries/PauseLib.sol";
import {_requireOwner} from "../utils.sol";

/**
 * @title GasStationSystem
 * @notice Allows players (level 3+) to burn Gold in exchange for ETH to cover gas.
 * @dev Namespaced (non-root) system — address(this) is the system contract address.
 *      ETH treasury lives at this system's address.
 *      Gold is burned via direct table writes (same pattern as LootManagerSystem).
 */
contract GasStationSystem is System {
    /**
     * @notice Burn gold and receive ETH at the configured exchange rate.
     * @param characterId The player's character ID
     * @param goldAmount Amount of gold to burn (in 1e18 units)
     */
    function buyGas(bytes32 characterId, uint256 goldAmount) public {
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

        // Check player has sufficient gold
        ResourceId balancesTableId = _goldBalancesTableId(GOLD_NAMESPACE);
        uint256 currentGold = ERC20Balances.get(balancesTableId, caller);
        if (currentGold < goldAmount) revert InsufficientBalance();

        // Calculate ETH output
        uint256 ethPerGold = GasStationConfig.getEthPerGold();
        uint256 ethOutput = (goldAmount * ethPerGold) / 1e18;

        // Check treasury has sufficient ETH
        if (address(this).balance < ethOutput) revert GasStationInsufficientTreasury();

        // Burn gold (direct table writes — same pattern as LootManagerSystem._burnGoldDirect)
        ResourceId totalSupplyTableId = _goldTotalSupplyTableId(GOLD_NAMESPACE);
        ERC20Balances.set(balancesTableId, caller, currentGold - goldAmount);
        uint256 currentSupply = ERC20TotalSupply.get(totalSupplyTableId);
        ERC20TotalSupply.set(totalSupplyTableId, currentSupply - goldAmount);

        // Update cooldown
        GasStationCooldown.setLastSwap(caller, block.timestamp);

        // Send ETH to caller
        (bool success,) = caller.call{value: ethOutput}("");
        if (!success) revert GasStationTransferFailed();
    }

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

    // Allow the system to receive ETH
    receive() external payable {}
}
