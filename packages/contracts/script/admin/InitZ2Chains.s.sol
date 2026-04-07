// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

interface IWorldChains {
    function UD__initializeCharacterChain(bytes32 characterId, uint8 fragmentType, uint256 totalSteps) external;
    function UD__tryAdvanceChain(bytes32 entityId, uint8 fragmentType, uint8 triggerType, bytes memory triggerData) external;
}

/**
 * @title InitZ2Chains
 * @notice Initialize Z2 fragment chains for a character that entered Windy Peaks
 *         before chains were deployed. Replicates ZoneTransitionSystem._initializeZ2Chains().
 *
 *   Usage:
 *     FOUNDRY_PROFILE=script forge script \
 *       script/admin/InitZ2Chains.s.sol \
 *       --sig "run(address,bytes32)" <worldAddress> <characterId> \
 *       --broadcast --rpc-url $RPC_URL
 */
contract InitZ2Chains is Script {
    function run(address _worldAddress, bytes32 _characterId) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        IWorldChains world = IWorldChains(_worldAddress);

        // Fragment type -> total steps (mirrors ZoneTransitionSystem._initializeZ2Chains)
        uint8[8] memory fragTypes = [uint8(9), 10, 11, 12, 13, 14, 15, 16];
        uint256[8] memory stepCounts = [uint256(1), 2, 2, 3, 3, 2, 3, 3];

        console.log("=== Init Z2 Chains ===");
        console.log("World:", _worldAddress);
        console.logBytes32(_characterId);

        vm.startBroadcast(deployerPrivateKey);

        for (uint256 i; i < 8; i++) {
            world.UD__initializeCharacterChain(_characterId, fragTypes[i], stepCounts[i]);
            console.log("  Initialized fragment %d (%d steps)", fragTypes[i], stepCounts[i]);
        }

        // Auto-trigger Fragment IX (TileVisit at spawn 0,0)
        world.UD__tryAdvanceChain(
            _characterId,
            9,  // Fragment IX
            0,  // TileVisit
            abi.encode(uint16(0), uint16(0))
        );
        console.log("  Fragment IX auto-advanced (TileVisit 0,0)");

        vm.stopBroadcast();
        console.log("=== Done ===");
    }
}
