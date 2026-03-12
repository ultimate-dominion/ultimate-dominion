// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Script.sol";
import {IWorld} from "@world/IWorld.sol";
import {NoTransferHook} from "../../src/NoTransferHook.sol";
import {_erc20SystemId} from "../../src/utils.sol";
import {GOLD_NAMESPACE} from "../../constants.sol";
import {BEFORE_CALL_SYSTEM} from "@latticexyz/world/src/systemHookTypes.sol";

/**
 * @title RegisterGoldTransferHook
 * @notice Registers a NoTransferHook on the Gold ERC20 system to prevent direct transfers.
 *         Gold can only be moved via game systems (shop, marketplace, escrow, gas station).
 *
 * Usage:
 *   source .env.testnet && forge script script/RegisterGoldTransferHook.s.sol --broadcast --rpc-url $RPC_URL
 */
contract RegisterGoldTransferHook is Script {
    function run() external {
        address worldAddress = vm.envAddress("WORLD_ADDRESS");
        IWorld world = IWorld(worldAddress);

        vm.startBroadcast();

        NoTransferHook goldHook = new NoTransferHook();
        world.registerSystemHook(_erc20SystemId(GOLD_NAMESPACE), goldHook, BEFORE_CALL_SYSTEM);
        console.log("Registered NoTransferHook on Gold ERC20 system");

        vm.stopBroadcast();
    }
}
