// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IStore} from "@latticexyz/store/src/IStore.sol";
import {FieldLayout} from "@latticexyz/store/src/FieldLayout.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM, RESOURCE_TABLE} from "@latticexyz/world/src/worldResourceTypes.sol";

import {UltimateDominionConfig} from "@codegen/index.sol";
import {WORLD_NAMESPACE} from "../../constants.sol";

/**
 * @title UpdateConfigAddresses
 * @notice Reads current system addresses from the MUD Systems table and writes
 *         them to UltimateDominionConfig. Required after every upgrade deploy
 *         because system contract addresses change but PostDeploy doesn't run.
 *
 *         Fields updated: marketplace (5), lootManager (6), shop (7)
 *
 *         Usage:
 *           source .env.testnet  # or .env.mainnet
 *           FOUNDRY_PROFILE=script forge script \
 *             script/admin/UpdateConfigAddresses.s.sol \
 *             --sig "run(address)" $WORLD_ADDRESS \
 *             --broadcast --rpc-url $RPC_URL
 */
contract UpdateConfigAddresses is Script {
    // MUD world:Systems table — namespace "world", name "Systems"
    ResourceId constant SYSTEMS_TABLE_ID = ResourceId.wrap(0x7462776f726c6400000000000000000053797374656d73000000000000000000);

    function _getSystemAddress(IStore store, bytes16 name) internal view returns (address) {
        ResourceId systemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, WORLD_NAMESPACE, name);
        bytes32[] memory keyTuple = new bytes32[](1);
        keyTuple[0] = ResourceId.unwrap(systemId);

        (bytes memory staticData,,) = store.getRecord(SYSTEMS_TABLE_ID, keyTuple);
        if (staticData.length < 21) return address(0);
        // Systems table schema: (address system, bool publicAccess)
        return address(bytes20(staticData));
    }

    function run(address _worldAddress) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        IStore store = IStore(_worldAddress);

        address lootManager = _getSystemAddress(store, "LootManagerSyste");
        address marketplace = _getSystemAddress(store, "MarketplaceSys");
        address shop = _getSystemAddress(store, "ShopSystem");

        console.log("=== Update Config Addresses ===");
        console.log("World:", _worldAddress);
        console.log("LootManager:", lootManager);
        console.log("Marketplace:", marketplace);
        console.log("Shop:", shop);

        require(lootManager != address(0), "LootManager not found in Systems table");
        require(marketplace != address(0), "Marketplace not found in Systems table");
        require(shop != address(0), "Shop not found in Systems table");

        ResourceId tableId = UltimateDominionConfig._tableId;
        FieldLayout fieldLayout = UltimateDominionConfig._fieldLayout;
        bytes32[] memory emptyKey = new bytes32[](0);

        vm.startBroadcast(deployerPrivateKey);

        // Field indices from codegen: 5=marketplace, 6=lootManager, 7=shop
        store.setStaticField(tableId, emptyKey, 5, abi.encodePacked(marketplace), fieldLayout);
        store.setStaticField(tableId, emptyKey, 6, abi.encodePacked(lootManager), fieldLayout);
        store.setStaticField(tableId, emptyKey, 7, abi.encodePacked(shop), fieldLayout);

        vm.stopBroadcast();

        console.log("=== Done ===");
    }
}
