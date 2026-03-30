// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IStore} from "@latticexyz/store/src/IStore.sol";
import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {FieldLayout} from "@latticexyz/store/src/FieldLayout.sol";
import {FragChainReward} from "@codegen/index.sol";

/**
 * @title SetQuestRewards
 * @notice Set FragChainReward for Z2 quest items (Sealed Letter + Last Sermon).
 *
 *   Usage:
 *     PRIVATE_KEY=0x... FOUNDRY_PROFILE=script forge script \
 *       script/admin/SetQuestRewards.s.sol \
 *       --sig "run(address,uint256,uint256)" <worldAddress> <sealedLetterId> <lastSermonId> \
 *       --broadcast --rpc-url $RPC_URL
 */
contract SetQuestRewards is Script {
    function run(address _worldAddress, uint256 _sealedLetterId, uint256 _lastSermonId) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        IStore store = IStore(_worldAddress);

        console.log("=== Set Quest Rewards ===");
        console.log("World:", _worldAddress);

        ResourceId tableId = FragChainReward._tableId;
        FieldLayout fieldLayout = FragChainReward._fieldLayout;

        vm.startBroadcast(deployerPrivateKey);

        // Fragment 11, step 0 -> Sealed Letter (kill Covenant Tracker)
        bytes32[] memory key11 = new bytes32[](2);
        key11[0] = bytes32(uint256(11)); // fragmentType
        key11[1] = bytes32(uint256(0));  // stepIndex
        store.setStaticField(tableId, key11, 0, abi.encodePacked(uint256(_sealedLetterId)), fieldLayout);
        console.log("  FragChainReward(11, 0) set");

        // Fragment 15, step 1 -> Last Sermon (kill Ossuary Guardian)
        bytes32[] memory key15 = new bytes32[](2);
        key15[0] = bytes32(uint256(15)); // fragmentType
        key15[1] = bytes32(uint256(1));  // stepIndex
        store.setStaticField(tableId, key15, 0, abi.encodePacked(uint256(_lastSermonId)), fieldLayout);
        console.log("  FragChainReward(15, 1) set");

        vm.stopBroadcast();

        console.log("=== Done ===");
    }
}
