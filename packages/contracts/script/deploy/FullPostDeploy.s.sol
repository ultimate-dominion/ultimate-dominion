// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";

import {IWorld} from "@world/IWorld.sol";
import {UltimateDominionConfig, Counters} from "@codegen/index.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";
import {_mobSystemId} from "../../src/utils.sol";
import {WORLD_NAMESPACE} from "../../constants.sol";

import {MinimalPostDeploy} from "./MinimalPostDeploy.s.sol";
import {DeployEffects} from "./DeployEffects.s.sol";
import {DeployItems} from "./DeployItems.s.sol";
import {DeployMonsters} from "./DeployMonsters.s.sol";
import {DeployEconomy} from "./DeployEconomy.s.sol";

/**
 * @title FullPostDeploy (Tier 3)
 * @notice Orchestrates complete game deployment using all tier scripts
 * @dev This is the production deployment script that ensures complete game state
 *
 * Deployment Order:
 * 1. MinimalPostDeploy (Tier 1) - Core infrastructure
 * 2. DeployEffects (Tier 2) - Effects (must be before items)
 * 3. DeployItems (Tier 2) - Items (references effects)
 * 4. DeployMonsters (Tier 2) - Monsters
 * 5. DeployEconomy (Tier 2) - Shops
 *
 * Usage:
 *   forge script FullPostDeploy --broadcast --sig "run(address)" <WORLD_ADDRESS>
 */
contract FullPostDeploy is Script {
    IWorld public world;
    address public deployer;

    // Tier scripts
    MinimalPostDeploy public minimalPostDeploy;
    DeployEffects public deployEffects;
    DeployItems public deployItems;
    DeployMonsters public deployMonsters;
    DeployEconomy public deployEconomy;

    function run(address _worldAddress) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        world = IWorld(_worldAddress);
        StoreSwitch.setStoreAddress(_worldAddress);

        console.log("=============================================");
        console.log("   FULL POST DEPLOY - Complete Game State   ");
        console.log("=============================================");
        console.log("World address:", _worldAddress);
        console.log("Deployer:", deployer);
        console.log("");

        // Deploy tier scripts
        minimalPostDeploy = new MinimalPostDeploy();
        deployEffects = new DeployEffects();
        deployItems = new DeployItems();
        deployMonsters = new DeployMonsters();
        deployEconomy = new DeployEconomy();

        // Execute in order
        _executeTier1(_worldAddress);
        _executeTier2(_worldAddress);
        _verifyDeployment(_worldAddress);

        vm.stopBroadcast();

        console.log("");
        console.log("=============================================");
        console.log("   FULL DEPLOYMENT COMPLETE                 ");
        console.log("=============================================");
    }

    function _executeTier1(address _worldAddress) internal {
        console.log("");
        console.log(">>> Executing Tier 1: Core Infrastructure <<<");
        console.log("");

        minimalPostDeploy.runInternal(_worldAddress, deployer);
    }

    function _executeTier2(address _worldAddress) internal {
        console.log("");
        console.log(">>> Executing Tier 2: Feature Scripts <<<");
        console.log("");

        // Effects first (items reference them)
        deployEffects.runInternal(_worldAddress);

        // Items (references effects)
        deployItems.runInternal(_worldAddress);

        // Monsters
        deployMonsters.runInternal(_worldAddress);

        // Economy (shops, references items)
        deployEconomy.runInternal(_worldAddress);
    }

    function _verifyDeployment(address _worldAddress) internal {
        console.log("");
        console.log(">>> Verifying Complete Deployment <<<");
        console.log("");

        StoreSwitch.setStoreAddress(_worldAddress);

        // Verify Tier 1
        bool hasGold = UltimateDominionConfig.getGoldToken() != address(0);
        bool hasCharacter = UltimateDominionConfig.getCharacterToken() != address(0);
        bool hasItems = UltimateDominionConfig.getItems() != address(0);

        console.log("Tier 1 Verification:");
        console.log("  Gold token:", hasGold ? "OK" : "MISSING");
        console.log("  Character token:", hasCharacter ? "OK" : "MISSING");
        console.log("  Items token:", hasItems ? "OK" : "MISSING");

        require(hasGold, "Verification failed: Gold token missing");
        require(hasCharacter, "Verification failed: Character token missing");
        require(hasItems, "Verification failed: Items token missing");

        // Verify Tier 2 - Items
        address itemsContract = UltimateDominionConfig.getItems();
        uint256 itemCount = Counters.getCounter(itemsContract, 0);

        console.log("Tier 2 Verification:");
        console.log("  Items deployed:", itemCount);

        require(itemCount > 0, "Verification failed: No items deployed");

        // Verify Tier 2 - Monsters
        address mobSystem = Systems.getSystem(_mobSystemId(WORLD_NAMESPACE));
        uint256 mobCount = Counters.getCounter(mobSystem, 0);

        console.log("  Mobs deployed:", mobCount);

        require(mobCount > 0, "Verification failed: No mobs deployed");

        console.log("");
        console.log("All verifications passed!");
    }

    /**
     * @notice Run only specific tiers (for partial deployments)
     * @param tiers Bitmask: 1=Tier1, 2=Tier2Effects, 4=Tier2Items, 8=Tier2Monsters, 16=Tier2Economy
     */
    function runPartial(address _worldAddress, uint8 tiers) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        world = IWorld(_worldAddress);
        StoreSwitch.setStoreAddress(_worldAddress);

        console.log("=== Partial Deployment ===");
        console.log("Tiers bitmask:", tiers);

        // Deploy needed scripts
        if (tiers & 1 != 0) {
            minimalPostDeploy = new MinimalPostDeploy();
            minimalPostDeploy.runInternal(_worldAddress, deployer);
        }

        if (tiers & 2 != 0) {
            deployEffects = new DeployEffects();
            deployEffects.runInternal(_worldAddress);
        }

        if (tiers & 4 != 0) {
            deployItems = new DeployItems();
            deployItems.runInternal(_worldAddress);
        }

        if (tiers & 8 != 0) {
            deployMonsters = new DeployMonsters();
            deployMonsters.runInternal(_worldAddress);
        }

        if (tiers & 16 != 0) {
            deployEconomy = new DeployEconomy();
            deployEconomy.runInternal(_worldAddress);
        }

        vm.stopBroadcast();

        console.log("=== Partial Deployment Complete ===");
    }

    /**
     * @notice Get deployment status
     */
    function getDeploymentStatus(address _worldAddress)
        external
        returns (
            bool hasGold,
            bool hasCharacter,
            bool hasItems,
            uint256 itemCount,
            uint256 mobCount
        )
    {
        StoreSwitch.setStoreAddress(_worldAddress);

        hasGold = UltimateDominionConfig.getGoldToken() != address(0);
        hasCharacter = UltimateDominionConfig.getCharacterToken() != address(0);
        hasItems = UltimateDominionConfig.getItems() != address(0);

        if (hasItems) {
            address itemsContract = UltimateDominionConfig.getItems();
            itemCount = Counters.getCounter(itemsContract, 0);
        }

        address mobSystem = Systems.getSystem(_mobSystemId(WORLD_NAMESPACE));
        if (mobSystem != address(0)) {
            mobCount = Counters.getCounter(mobSystem, 0);
        }
    }
}
