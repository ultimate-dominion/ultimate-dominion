// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {_ownersTableId} from "@erc1155/utils.sol";
import {_balancesTableId} from "@latticexyz/world-modules/src/modules/erc20-puppet/utils.sol";
import {ESCROW_ADDRESS} from "../../constants.sol";

bytes14 constant ITEMS_NAMESPACE = "Items";
bytes14 constant GOLD_NAMESPACE = "Gold";

interface IStore {
    function getStaticField(
        bytes32 tableId,
        bytes32[] calldata keyTuple,
        uint8 fieldIndex,
        bytes32 fieldLayout
    ) external view returns (bytes32);

    function setStaticField(
        bytes32 tableId,
        bytes32[] calldata keyTuple,
        uint8 fieldIndex,
        bytes memory data,
        bytes32 fieldLayout
    ) external;
}

/**
 * @title MigrateLootManagerItems
 * @notice Final migration: consolidates all item and gold balances from historical
 *         LootManagerSystem addresses into the stable ESCROW_ADDRESS.
 *
 *         After this migration + deploy, escrow uses a deterministic address that
 *         never changes across system upgrades. No future migrations needed.
 *
 * Environment variables:
 *   WORLD         — World contract address
 *
 * All 7 historical LootManagerSystem addresses are hardcoded below
 * (discovered via Store_SetRecord events on the world.Systems table).
 *
 * Pre-requisites:
 *   1. grantAccess(tb:Items:Owners, deployer)
 *   2. grantAccess(tb:Gold:Balances, deployer)
 *
 * Usage:
 *   cd packages/contracts && source .env.mainnet && \
 *     forge script script/admin/MigrateLootManagerItems.s.sol \
 *     --rpc-url $RPC_URL --broadcast --private-key $PRIVATE_KEY
 *
 * Post-migration:
 *   1. revokeAccess(tb:Items:Owners, deployer)
 *   2. revokeAccess(tb:Gold:Balances, deployer)
 */
contract MigrateLootManagerItems is Script {
    // ERC1155 Owners: single uint256 field (balance)
    bytes32 constant ITEMS_FIELD_LAYOUT = 0x0020010020000000000000000000000000000000000000000000000000000000;
    // ERC20 Balances: single uint256 field (balance)
    bytes32 constant GOLD_FIELD_LAYOUT = 0x0020010020000000000000000000000000000000000000000000000000000000;

    function run() external {
        address worldAddr = vm.envAddress("WORLD");

        // All 7 historical LootManagerSystem addresses (chronological by deploy block).
        // #4 and #5 are empty but included for completeness — they'll no-op.
        address[7] memory oldAddrs = [
            address(0x69c99B2A3982D0C3e62fEC2979189828717A0b7B), // #1 block 43183055 — holds entire item supply
            address(0x51afe3e83E129F6F3Aa255eb361472B6989d796f), // #2 block 43271780 — gold only
            address(0x6788f5969e5A27d24a61658fb6257200e71AFEd4), // #3 block 43594822 — small items
            address(0x15089EB41a5e2391f917A6d18d53e1E1511B03d6), // #4 block 43742990 — empty
            address(0x53787dA89C06C45146edd2380428d929BFD717f0), // #5 block 43743987 — empty
            address(0x722039D517119191932d55bBf3DEE917D95cCBBb), // #6 block 43746083 — items + gold
            address(0x532115a56a84141D631FE13302678D37732Eacd5)  // #7 block 43796101 — current, items + gold
        ];

        bytes32 itemsTableId = ResourceId.unwrap(_ownersTableId(ITEMS_NAMESPACE));
        bytes32 goldTableId = ResourceId.unwrap(_balancesTableId(GOLD_NAMESPACE));
        IStore world = IStore(worldAddr);

        console.log("=== Migrating to stable ESCROW_ADDRESS ===");
        console.log("  Target:", ESCROW_ADDRESS);
        console.log("  World:", worldAddr);

        vm.startBroadcast();

        // --- Migrate Items (scan IDs 1-100) ---
        uint256 totalItemsMoved = 0;
        for (uint256 a = 0; a < oldAddrs.length; a++) {
            address src = oldAddrs[a];
            if (src == address(0)) continue;
            uint256 srcMoved = 0;

            for (uint256 itemId = 1; itemId <= 100; itemId++) {
                bytes32[] memory srcKey = new bytes32[](2);
                srcKey[0] = bytes32(uint256(uint160(src)));
                srcKey[1] = bytes32(itemId);

                bytes32 rawBal = world.getStaticField(itemsTableId, srcKey, 0, ITEMS_FIELD_LAYOUT);
                uint256 bal = uint256(rawBal);
                if (bal == 0) continue;

                // Zero source
                world.setStaticField(itemsTableId, srcKey, 0, abi.encodePacked(uint256(0)), ITEMS_FIELD_LAYOUT);

                // Add to escrow
                bytes32[] memory dstKey = new bytes32[](2);
                dstKey[0] = bytes32(uint256(uint160(ESCROW_ADDRESS)));
                dstKey[1] = bytes32(itemId);

                bytes32 rawDst = world.getStaticField(itemsTableId, dstKey, 0, ITEMS_FIELD_LAYOUT);
                uint256 newBal = uint256(rawDst) + bal;
                world.setStaticField(itemsTableId, dstKey, 0, abi.encodePacked(newBal), ITEMS_FIELD_LAYOUT);

                console.log("  [ITEM] src #%d id=%d amount=%d", a, itemId, bal);
                srcMoved += bal;
            }

            if (srcMoved > 0) {
                console.log("  Source #%d: %d item units moved", a, srcMoved);
            }
            totalItemsMoved += srcMoved;
        }

        // --- Migrate Gold ---
        uint256 totalGoldMoved = 0;
        for (uint256 a = 0; a < oldAddrs.length; a++) {
            address src = oldAddrs[a];
            if (src == address(0)) continue;

            bytes32[] memory srcKey = new bytes32[](1);
            srcKey[0] = bytes32(uint256(uint160(src)));

            bytes32 rawBal = world.getStaticField(goldTableId, srcKey, 0, GOLD_FIELD_LAYOUT);
            uint256 bal = uint256(rawBal);
            if (bal == 0) continue;

            // Zero source
            world.setStaticField(goldTableId, srcKey, 0, abi.encodePacked(uint256(0)), GOLD_FIELD_LAYOUT);

            // Add to escrow
            bytes32[] memory dstKey = new bytes32[](1);
            dstKey[0] = bytes32(uint256(uint160(ESCROW_ADDRESS)));

            bytes32 rawDst = world.getStaticField(goldTableId, dstKey, 0, GOLD_FIELD_LAYOUT);
            uint256 newBal = uint256(rawDst) + bal;
            world.setStaticField(goldTableId, dstKey, 0, abi.encodePacked(newBal), GOLD_FIELD_LAYOUT);

            console.log("  [GOLD] src #%d: %d wei moved", a, bal);
            totalGoldMoved += bal;
        }

        vm.stopBroadcast();

        console.log("=== Migration complete ===");
        console.log("  Total item units moved: %d", totalItemsMoved);
        console.log("  Total gold moved: %d", totalGoldMoved);
    }
}
