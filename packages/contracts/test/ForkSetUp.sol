// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

/**
 * @title ForkSetUp
 * @notice Base contract for fork-mode integration tests that run against a live world.
 *         Unlike MudTest/SetUp.sol (which deploy a fresh world to localhost), this reads
 *         WORLD_ADDRESS from env and connects via StoreSwitch. Tests read real on-chain
 *         state (items, mobs, shops) instead of creating them.
 *
 * Usage:
 *   source .env.testnet && WORLD_ADDRESS=$WORLD_ADDRESS forge test \
 *     --fork-url $RPC_URL --match-contract "ForkTest" --skip script -vv
 *
 * Convention: fork-mode test files use `.fork.t.sol` suffix,
 *             contract names end with `ForkTest`.
 */

import "forge-std/Test.sol";
import "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM} from "@latticexyz/world/src/worldResourceTypes.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";
import {IWorld} from "@codegen/world/IWorld.sol";
import {Shops} from "@codegen/index.sol";
import {Classes} from "@codegen/common.sol";
import {WORLD_NAMESPACE} from "../constants.sol";

abstract contract ForkSetUp is Test {
    IWorld public world;
    address public worldAddress;

    // Main shop entity ID (Tal's Shop at 9,9 in Dark Cave)
    bytes32 constant MAIN_SHOP_ID = 0x0000000b00000000000000000000000000000000000000000000000100090009;

    function setUp() public virtual {
        worldAddress = vm.envAddress("WORLD_ADDRESS");
        require(worldAddress != address(0), "WORLD_ADDRESS env var not set");
        world = IWorld(worldAddress);
        StoreSwitch.setStoreAddress(worldAddress);
        vm.label(worldAddress, "World");
    }

    // ================================================================
    //  Helpers
    // ================================================================

    /// @dev Build a system ResourceId in the UD namespace
    function _sysId(bytes16 name) internal pure returns (ResourceId) {
        return WorldResourceIdLib.encode(RESOURCE_SYSTEM, WORLD_NAMESPACE, name);
    }

    /// @dev Look up the deployed address for a system name
    function _sysAddr(bytes16 name) internal view returns (address) {
        return Systems.getSystem(_sysId(name));
    }

    /// @dev Create a test player with ETH, ready for fork-local transactions
    function _createTestPlayer(uint256 seed) internal returns (address player) {
        player = address(uint160(uint256(keccak256(abi.encode("test-player", seed)))));
        vm.deal(player, 1 ether);
        vm.label(player, string.concat("TestPlayer", vm.toString(seed)));
    }

    /// @dev Mint a character and enter the game as a test player.
    ///      Returns the characterId. Caller must vm.startPrank(player) before calling.
    function _mintAndEnterGame(
        address player,
        bytes32 name,
        uint256 starterWeaponId,
        uint256 starterArmorId
    ) internal returns (bytes32 characterId) {
        characterId = world.UD__mintCharacter(player, name, "ipfs://test");

        // Roll stats (may revert if entropy fee needed — catch and continue)
        try world.UD__rollStats{value: 0}(
            keccak256(abi.encode(player, block.timestamp)),
            characterId,
            Classes.Warrior
        ) {} catch {}

        world.UD__enterGame(characterId, starterWeaponId, starterArmorId);
    }

    /// @dev Check if the main shop has gold (economy is healthy)
    function _shopHasGold() internal view returns (bool) {
        return Shops.getGold(MAIN_SHOP_ID) > 0;
    }
}
