// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";

import {IWorld} from "@world/IWorld.sol";
import {UltimateDominionConfig, Counters, Mobs, MobsByLevel} from "@codegen/index.sol";
import {MobType} from "@codegen/common.sol";
import {MonsterStats, MonsterTemplateDetails} from "@interfaces/Structs.sol";
import {_mobSystemId} from "../../src/utils.sol";
import {WORLD_NAMESPACE} from "../../constants.sol";

import "forge-std/StdJson.sol";

/**
 * @title DeployMonsters (Tier 2)
 * @notice Deploys all monster templates
 * @dev Feature script for the 3-tier deployment system
 *
 * Prerequisites:
 * - MinimalPostDeploy must be run first
 *
 * Usage:
 *   forge script DeployMonsters --broadcast --sig "run(address)" <WORLD_ADDRESS>
 *
 * Batch deployment:
 *   forge script DeployMonsters --broadcast --sig "runBatch(address,uint256,uint256)" <WORLD_ADDRESS> 0 10
 */
contract DeployMonsters is Script {
    using stdJson for string;

    IWorld public world;
    address public mobCounterAddress;

    function run(address _worldAddress) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        world = IWorld(_worldAddress);
        StoreSwitch.setStoreAddress(_worldAddress);

        console.log("=== Tier 2: DeployMonsters ===");

        _checkPrerequisites();
        _createAllMonsters();

        vm.stopBroadcast();

        console.log("=== DeployMonsters Complete ===");
    }

    /**
     * @notice Run without broadcast management (for orchestration)
     */
    function runInternal(address _worldAddress) external {
        world = IWorld(_worldAddress);
        StoreSwitch.setStoreAddress(_worldAddress);

        console.log("=== Tier 2: DeployMonsters (Internal) ===");

        _checkPrerequisites();
        _createAllMonsters();

        console.log("=== DeployMonsters Complete ===");
    }

    /**
     * @notice Deploy monsters in batches (for large datasets)
     * @param startIndex Starting index in monsters.json
     * @param count Number of monsters to deploy
     */
    function runBatch(address _worldAddress, uint256 startIndex, uint256 count) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        world = IWorld(_worldAddress);
        StoreSwitch.setStoreAddress(_worldAddress);

        console.log("=== Tier 2: DeployMonsters (Batch) ===");
        console.log("  Start index:", startIndex);
        console.log("  Count:", count);

        _checkPrerequisites();

        string memory json = vm.readFile("monsters.json");
        bytes memory monsterStatsData = vm.parseJson(json, ".monsters");
        MonsterTemplateDetails[] memory allMonsters = abi.decode(monsterStatsData, (MonsterTemplateDetails[]));

        uint256 endIndex = startIndex + count;
        if (endIndex > allMonsters.length) {
            endIndex = allMonsters.length;
        }

        for (uint256 i = startIndex; i < endIndex; i++) {
            _createMonster(allMonsters[i]);
        }

        vm.stopBroadcast();

        console.log("=== DeployMonsters Batch Complete ===");
        console.log("  Deployed:", endIndex - startIndex);
    }

    /**
     * @notice Deploy monsters for a specific level
     * @param level The level to deploy monsters for
     */
    function runByLevel(address _worldAddress, uint8 level) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        world = IWorld(_worldAddress);
        StoreSwitch.setStoreAddress(_worldAddress);

        console.log("=== Tier 2: DeployMonsters (Level) ===");
        console.log("  Level:", level);

        _checkPrerequisites();

        string memory json = vm.readFile("monsters.json");
        bytes memory monsterStatsData = vm.parseJson(json, ".monsters");
        MonsterTemplateDetails[] memory allMonsters = abi.decode(monsterStatsData, (MonsterTemplateDetails[]));

        uint256 deployed = 0;
        for (uint256 i = 0; i < allMonsters.length; i++) {
            if (allMonsters[i].stats.level == level) {
                _createMonster(allMonsters[i]);
                deployed++;
            }
        }

        vm.stopBroadcast();

        console.log("=== DeployMonsters Level Complete ===");
        console.log("  Level:", level);
        console.log("  Deployed:", deployed);
    }

    function _checkPrerequisites() internal {
        require(
            UltimateDominionConfig.getGoldToken() != address(0),
            "DeployMonsters: MinimalPostDeploy not run - Gold token missing"
        );

        mobCounterAddress = Systems.getSystem(_mobSystemId(WORLD_NAMESPACE));
        require(mobCounterAddress != address(0), "DeployMonsters: MobSystem not found");

        console.log("  Prerequisites verified");
        console.log("  MobSystem:", mobCounterAddress);
    }

    function _createAllMonsters() internal {
        string memory json = vm.readFile("monsters.json");
        bytes memory monsterStatsData = vm.parseJson(json, ".monsters");
        MonsterTemplateDetails[] memory monsterTemplateDetails =
            abi.decode(monsterStatsData, (MonsterTemplateDetails[]));

        console.log("Creating monsters...");

        for (uint256 i = 0; i < monsterTemplateDetails.length; i++) {
            _createMonster(monsterTemplateDetails[i]);
        }

        console.log("Monsters deployment complete:");
        console.log("  Total monsters:", monsterTemplateDetails.length);
    }

    function _createMonster(MonsterTemplateDetails memory monsterTemplate) internal {
        MonsterStats memory newMonster = MonsterStats({
            agility: monsterTemplate.stats.agility,
            armor: monsterTemplate.stats.armor,
            class: monsterTemplate.stats.class,
            experience: monsterTemplate.stats.experience,
            hitPoints: monsterTemplate.stats.hitPoints,
            level: monsterTemplate.stats.level,
            intelligence: monsterTemplate.stats.intelligence,
            inventory: monsterTemplate.stats.inventory,
            strength: monsterTemplate.stats.strength
        });

        uint256 mobId = _incrementMobId();

        // Write to Mobs table
        Mobs.set(mobId, MobType.Monster, abi.encode(newMonster), monsterTemplate.metadataUri);

        // Add to MobsByLevel for spawning
        MobsByLevel.pushMobIds(newMonster.level, mobId);

        console.log("  Monster created:", monsterTemplate.name, "id:", mobId);
    }

    function _incrementMobId() internal returns (uint256) {
        uint256 mobId = Counters.getCounter(mobCounterAddress, 0) + 1;
        Counters.setCounter(mobCounterAddress, 0, mobId);
        return mobId;
    }

    /**
     * @notice Verify monsters deployment
     */
    function verify(address _worldAddress) external returns (bool) {
        StoreSwitch.setStoreAddress(_worldAddress);

        address mobSystem = Systems.getSystem(_mobSystemId(WORLD_NAMESPACE));
        uint256 mobCount = Counters.getCounter(mobSystem, 0);
        return mobCount > 0;
    }

    /**
     * @notice Get current monster count
     */
    function getMonsterCount(address _worldAddress) external returns (uint256) {
        StoreSwitch.setStoreAddress(_worldAddress);
        address mobSystem = Systems.getSystem(_mobSystemId(WORLD_NAMESPACE));
        return Counters.getCounter(mobSystem, 0);
    }
}
