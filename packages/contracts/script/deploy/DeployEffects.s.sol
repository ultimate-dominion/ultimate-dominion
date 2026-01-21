// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";

import {IWorld} from "@world/IWorld.sol";
import {UltimateDominionConfig} from "@codegen/index.sol";
import {
    Effects,
    PhysicalDamageStats,
    MagicDamageStats,
    StatusEffectStats,
    StatusEffectStatsData,
    StatusEffectValidity,
    StatusEffectValidityData
} from "@codegen/index.sol";
import {EffectType} from "@codegen/common.sol";
import {StarterEffects} from "@interfaces/Structs.sol";

import "forge-std/StdJson.sol";

/**
 * @title DeployEffects (Tier 2)
 * @notice Deploys all game effects (physical damage, magic damage, status effects)
 * @dev Feature script for the 3-tier deployment system
 *
 * Prerequisites:
 * - MinimalPostDeploy must be run first
 *
 * Usage:
 *   forge script DeployEffects --broadcast --sig "run(address)" <WORLD_ADDRESS>
 */
contract DeployEffects is Script {
    using stdJson for string;

    IWorld public world;

    function run(address _worldAddress) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        world = IWorld(_worldAddress);
        StoreSwitch.setStoreAddress(_worldAddress);

        console.log("=== Tier 2: DeployEffects ===");

        // Check prerequisites
        _checkPrerequisites();

        // Deploy effects
        _createEffects();

        vm.stopBroadcast();

        console.log("=== DeployEffects Complete ===");
    }

    /**
     * @notice Run without broadcast management (for orchestration)
     */
    function runInternal(address _worldAddress) external {
        world = IWorld(_worldAddress);
        StoreSwitch.setStoreAddress(_worldAddress);

        console.log("=== Tier 2: DeployEffects (Internal) ===");

        _checkPrerequisites();
        _createEffects();

        console.log("=== DeployEffects Complete ===");
    }

    function _checkPrerequisites() internal view {
        require(
            UltimateDominionConfig.getGoldToken() != address(0),
            "DeployEffects: MinimalPostDeploy not run - Gold token missing"
        );
        console.log("  Prerequisites verified");
    }

    function _createEffects() internal {
        string memory json = vm.readFile("effects.json");
        bytes memory data = vm.parseJson(json);

        StarterEffects memory effectsData = abi.decode(data, (StarterEffects));

        // Create Physical Damage effects
        console.log("Creating Physical Damage effects...");
        for (uint256 i; i < effectsData.PhysicalDamages.length; i++) {
            bytes32 effectId = bytes32(bytes8(keccak256(abi.encode(effectsData.PhysicalDamages[i].name))));

            PhysicalDamageStats.set(effectId, effectsData.PhysicalDamages[i].stats);
            Effects.set(effectId, EffectType.PhysicalDamage, true);

            console.log("  Physical effect created:", i + 1);
            require(effectId == effectsData.PhysicalDamages[i].effectId, "Physical effect Id mismatch");
        }

        // Create Magic Damage effects
        console.log("Creating Magic Damage effects...");
        for (uint256 i; i < effectsData.MagicDamages.length; i++) {
            bytes32 effectId = bytes32(bytes8(keccak256(abi.encode(effectsData.MagicDamages[i].name))));

            MagicDamageStats.set(effectId, effectsData.MagicDamages[i].stats);
            Effects.set(effectId, EffectType.MagicDamage, true);

            console.log("  Magic effect created:", i + 1);
            require(effectId == effectsData.MagicDamages[i].effectId, "Magic effect Id mismatch");
        }

        // Create Status effects
        console.log("Creating Status effects...");
        for (uint256 i; i < effectsData.statusEffects.length; i++) {
            bytes32 effectId = bytes32(bytes8(keccak256(abi.encode(effectsData.statusEffects[i].name))));

            // Validate status effect
            StatusEffectValidityData memory validityData = effectsData.statusEffects[i].validity;
            if (validityData.validTime != 0) {
                require(validityData.validTurns == 0, "INVALID EFFECT: TIME");
                require(effectsData.statusEffects[i].stats.damagePerTick == 0, "INVALID EFFECT: WORLD EFFECT DAMAGE");
            } else if (validityData.validTime == 0) {
                require(validityData.validTurns != 0, "INVALID EFFECT: TURNS");
            }

            StatusEffectStats.set(effectId, effectsData.statusEffects[i].stats);
            StatusEffectValidity.set(effectId, validityData);
            Effects.set(effectId, EffectType.StatusEffect, true);

            console.log("  Status effect created:", i + 1);
            require(effectId == effectsData.statusEffects[i].effectId, "Status effect Id mismatch");
        }

        console.log("Effects deployment complete:");
        console.log("  Physical effects:", effectsData.PhysicalDamages.length);
        console.log("  Magic effects:", effectsData.MagicDamages.length);
        console.log("  Status effects:", effectsData.statusEffects.length);
    }

    /**
     * @notice Deploy effects from a specific JSON file (for batch/custom deployments)
     */
    function runFromFile(address _worldAddress, string memory jsonPath) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        world = IWorld(_worldAddress);
        StoreSwitch.setStoreAddress(_worldAddress);

        string memory json = vm.readFile(jsonPath);
        bytes memory data = vm.parseJson(json);
        StarterEffects memory effectsData = abi.decode(data, (StarterEffects));

        _deployEffectsFromData(effectsData);

        vm.stopBroadcast();
    }

    function _deployEffectsFromData(StarterEffects memory effectsData) internal {
        for (uint256 i; i < effectsData.PhysicalDamages.length; i++) {
            bytes32 effectId = bytes32(bytes8(keccak256(abi.encode(effectsData.PhysicalDamages[i].name))));
            PhysicalDamageStats.set(effectId, effectsData.PhysicalDamages[i].stats);
            Effects.set(effectId, EffectType.PhysicalDamage, true);
        }

        for (uint256 i; i < effectsData.MagicDamages.length; i++) {
            bytes32 effectId = bytes32(bytes8(keccak256(abi.encode(effectsData.MagicDamages[i].name))));
            MagicDamageStats.set(effectId, effectsData.MagicDamages[i].stats);
            Effects.set(effectId, EffectType.MagicDamage, true);
        }

        for (uint256 i; i < effectsData.statusEffects.length; i++) {
            bytes32 effectId = bytes32(bytes8(keccak256(abi.encode(effectsData.statusEffects[i].name))));
            StatusEffectStats.set(effectId, effectsData.statusEffects[i].stats);
            StatusEffectValidity.set(effectId, effectsData.statusEffects[i].validity);
            Effects.set(effectId, EffectType.StatusEffect, true);
        }
    }

    /**
     * @notice Verify effects deployment
     */
    function verify(address _worldAddress) external returns (bool) {
        StoreSwitch.setStoreAddress(_worldAddress);

        // Check a known effect exists
        bytes32 basicAttackId = bytes32(bytes8(keccak256(abi.encode("basic weapon attack"))));
        return Effects.getEffectExists(basicAttackId);
    }
}
