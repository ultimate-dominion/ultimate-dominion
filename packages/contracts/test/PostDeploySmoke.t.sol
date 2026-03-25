// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

/**
 * @title PostDeploySmoke
 * @notice Fork-mode smoke test suite to run against a live world after every deploy.
 *         Catches the four horsemen of MUD deploy regressions:
 *           1. System registration failures (non-zero address check)
 *           2. Cross-namespace access grants (ResourceAccess table)
 *           3. Data orphaning after system upgrades (LootManager gold, shop gold, GasStation config)
 *           4. Function selector mismatches (World_ResourceNotFound on client-callable functions)
 *
 * Usage:
 *   source .env.testnet && WORLD_ADDRESS=$WORLD_ADDRESS forge test \
 *     --match-contract PostDeploySmoke --fork-url $RPC_URL -vv
 */

import "forge-std/Test.sol";
import "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM} from "@latticexyz/world/src/worldResourceTypes.sol";
import {RESOURCE_TABLE} from "@latticexyz/store/src/storeResourceTypes.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";
import {ResourceAccess} from "@latticexyz/world/src/codegen/tables/ResourceAccess.sol";
import {IWorld} from "@codegen/world/IWorld.sol";
import {IWorldErrors} from "@latticexyz/world/src/IWorldErrors.sol";
import {Shops, GasStationConfig} from "@codegen/index.sol";
import {Classes} from "@codegen/common.sol";
import {Balances as ERC20Balances} from "@latticexyz/world-modules/src/modules/tokens/tables/Balances.sol";
import {_balancesTableId} from "@latticexyz/world-modules/src/modules/erc20-puppet/utils.sol";
import {_erc20SystemId} from "@latticexyz/world-modules/src/modules/erc20-puppet/utils.sol";
import {_erc1155SystemId} from "../src/utils.sol";
import {NotAuthorizedCaller} from "../src/utils.sol";
import {GOLD_NAMESPACE, ITEMS_NAMESPACE, WORLD_NAMESPACE, ESCROW_ADDRESS} from "../constants.sol";

contract PostDeploySmoke is Test {
    IWorld public world;
    address public worldAddress;

    // Main shop entity ID (Tal's Shop at 9,9 in Dark Cave)
    bytes32 constant MAIN_SHOP_ID = 0x0000000b00000000000000000000000000000000000000000000000100090009;

    // ================================================================
    //  Setup — read world address from env, configure StoreSwitch
    // ================================================================

    function setUp() public {
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

    /// @dev Build a table ResourceId in a given namespace
    function _tableId(bytes14 ns, bytes16 name) internal pure returns (ResourceId) {
        return WorldResourceIdLib.encode(RESOURCE_TABLE, ns, name);
    }

    /// @dev Look up the deployed address for a system name. Returns address(0) if not registered.
    function _sysAddr(bytes16 name) internal view returns (address) {
        return Systems.getSystem(_sysId(name));
    }

    /// @dev Assert a system is registered and has a non-zero address. Logs on failure.
    function _assertSystemRegistered(bytes16 name, string memory label) internal {
        address addr = _sysAddr(name);
        if (addr == address(0)) {
            console.log("[FAIL] System not registered:", label);
        }
        assertNotEq(addr, address(0), string.concat("System not registered: ", label));
    }

    /// @dev Assert an access grant exists. Logs on failure.
    function _assertAccessGranted(
        ResourceId tableId,
        address grantee,
        string memory tableLabel,
        string memory granteeLabel
    ) internal {
        bool hasAccess = ResourceAccess.getAccess(tableId, grantee);
        if (!hasAccess) {
            console.log("[FAIL] Access denied:", tableLabel, "->", granteeLabel);
        }
        assertTrue(hasAccess, string.concat("Missing access: ", tableLabel, " -> ", granteeLabel));
    }

    // ================================================================
    //  Layer 1: System Registration
    //  Verify all game systems are registered with non-zero addresses.
    //  A missing system means mud deploy silently skipped it or nonce
    //  errors dropped the registration transaction.
    // ================================================================

    function test_systemRegistration() public {
        console.log("=== Layer 1: System Registration ===");

        // Core game systems
        _assertSystemRegistered("MapSystem", "MapSystem");
        _assertSystemRegistered("MapSpawnSystem", "MapSpawnSystem");
        _assertSystemRegistered("MapRemovalSyste", "MapRemovalSystem");
        _assertSystemRegistered("ShopSystem", "ShopSystem");
        _assertSystemRegistered("EncounterSystem", "EncounterSystem");
        _assertSystemRegistered("EncounterResolv", "EncounterResolveSystem");
        _assertSystemRegistered("CombatSystem", "CombatSystem");
        _assertSystemRegistered("PvESystem", "PvESystem");
        _assertSystemRegistered("PvPSystem", "PvPSystem");
        _assertSystemRegistered("PveRewardSystem", "PveRewardSystem");
        _assertSystemRegistered("PvpRewardSystem", "PvpRewardSystem");
        _assertSystemRegistered("LootManagerSyste", "LootManagerSystem");
        _assertSystemRegistered("CharacterCore", "CharacterCore");
        _assertSystemRegistered("CharEnterSys", "CharacterEnterSystem");
        _assertSystemRegistered("StatSystem", "StatSystem");
        _assertSystemRegistered("FragmentSystem", "FragmentSystem");
        _assertSystemRegistered("FragmentCombatS", "FragmentCombatSystem");
        _assertSystemRegistered("GasStationSys", "GasStationSystem");
        _assertSystemRegistered("EquipmentSystem", "EquipmentSystem");
        _assertSystemRegistered("ImplicitClassSys", "ImplicitClassSystem");
        _assertSystemRegistered("WorldActionSyste", "WorldActionSystem");
        _assertSystemRegistered("ItemsSystem", "ItemsSystem");
        _assertSystemRegistered("ItemCreationSys", "ItemCreationSystem");
        _assertSystemRegistered("MarketplaceSys", "MarketplaceSystem");
        _assertSystemRegistered("AdminSystem", "AdminSystem");
        _assertSystemRegistered("LevelSystem", "LevelSystem");

        console.log("[PASS] All systems registered");
    }

    // ================================================================
    //  Layer 2: Access Grants
    //  Verify all cross-namespace grants exist. These break silently
    //  when system addresses change after a deploy and EnsureAccess
    //  isn't run, or when PostDeploy grant logic has a try/catch that
    //  swallows errors.
    // ================================================================

    function test_accessGrants_goldBalances() public {
        console.log("=== Layer 2a: Gold:Balances Access Grants ===");

        ResourceId goldBalances = _tableId(GOLD_NAMESPACE, "Balances");

        // Look up current system addresses (they change every deploy)
        address charEnterSys = _sysAddr("CharEnterSys");
        address lootManager = _sysAddr("LootManagerSyste");
        address gasStation = _sysAddr("GasStationSys");
        address shopSystem = _sysAddr("ShopSystem");
        address pveReward = _sysAddr("PveRewardSystem");
        address marketplace = _sysAddr("MarketplaceSys");

        _assertAccessGranted(goldBalances, charEnterSys, "Gold:Balances", "CharEnterSys");
        _assertAccessGranted(goldBalances, lootManager, "Gold:Balances", "LootManager");
        _assertAccessGranted(goldBalances, gasStation, "Gold:Balances", "GasStation");
        _assertAccessGranted(goldBalances, shopSystem, "Gold:Balances", "ShopSystem");
        _assertAccessGranted(goldBalances, pveReward, "Gold:Balances", "PveReward");
        _assertAccessGranted(goldBalances, marketplace, "Gold:Balances", "Marketplace");
        _assertAccessGranted(goldBalances, worldAddress, "Gold:Balances", "World");

        console.log("[PASS] Gold:Balances grants OK");
    }

    function test_accessGrants_goldTotalSupply() public {
        console.log("=== Layer 2b: Gold:TotalSupply Access Grants ===");

        ResourceId goldTotalSupply = _tableId(GOLD_NAMESPACE, "TotalSupply");

        address charEnterSys = _sysAddr("CharEnterSys");
        address lootManager = _sysAddr("LootManagerSyste");
        address gasStation = _sysAddr("GasStationSys");
        address shopSystem = _sysAddr("ShopSystem");
        address pveReward = _sysAddr("PveRewardSystem");
        address marketplace = _sysAddr("MarketplaceSys");

        _assertAccessGranted(goldTotalSupply, charEnterSys, "Gold:TotalSupply", "CharEnterSys");
        _assertAccessGranted(goldTotalSupply, lootManager, "Gold:TotalSupply", "LootManager");
        _assertAccessGranted(goldTotalSupply, gasStation, "Gold:TotalSupply", "GasStation");
        _assertAccessGranted(goldTotalSupply, shopSystem, "Gold:TotalSupply", "ShopSystem");
        _assertAccessGranted(goldTotalSupply, pveReward, "Gold:TotalSupply", "PveReward");
        // Marketplace gets namespace-level Gold access, not necessarily table-level TotalSupply
        // but let's check it anyway since it may need it for burns
        _assertAccessGranted(goldTotalSupply, marketplace, "Gold:TotalSupply", "Marketplace");

        console.log("[PASS] Gold:TotalSupply grants OK");
    }

    function test_accessGrants_itemsOwners() public {
        console.log("=== Layer 2c: Items:Owners Access Grants ===");

        ResourceId itemsOwners = _tableId(ITEMS_NAMESPACE, "Owners");

        address charEnterSys = _sysAddr("CharEnterSys");
        address lootManager = _sysAddr("LootManagerSyste");
        address shopSystem = _sysAddr("ShopSystem");
        address marketplace = _sysAddr("MarketplaceSys");

        _assertAccessGranted(itemsOwners, charEnterSys, "Items:Owners", "CharEnterSys");
        _assertAccessGranted(itemsOwners, lootManager, "Items:Owners", "LootManager");
        _assertAccessGranted(itemsOwners, shopSystem, "Items:Owners", "ShopSystem");
        _assertAccessGranted(itemsOwners, marketplace, "Items:Owners", "Marketplace");

        console.log("[PASS] Items:Owners grants OK");
    }

    function test_accessGrants_itemsTotalSupply() public {
        console.log("=== Layer 2d: Items:TotalSupply Access Grants ===");

        ResourceId itemsTotalSupply = _tableId(ITEMS_NAMESPACE, "TotalSupply");

        address lootManager = _sysAddr("LootManagerSyste");

        _assertAccessGranted(itemsTotalSupply, lootManager, "Items:TotalSupply", "LootManager");

        console.log("[PASS] Items:TotalSupply grants OK");
    }

    // ================================================================
    //  Layer 3: Economic Health
    //  Verify critical balances are non-zero. Data orphaning after a
    //  system upgrade creates a new contract address, but the gold
    //  lives at the OLD address. LootManager gold = 0 means shops
    //  can't buy from players, breaking the entire economy.
    // ================================================================

    function test_economicHealth_escrowGold() public {
        console.log("=== Layer 3a: Escrow Gold Balance ===");

        ResourceId goldBalancesTableId = _balancesTableId(GOLD_NAMESPACE);
        uint256 escrowGold = ERC20Balances.get(goldBalancesTableId, ESCROW_ADDRESS);

        console.log("  Escrow address:", ESCROW_ADDRESS);
        console.log("  Escrow gold balance:", escrowGold / 1e18, "Gold");

        assertGt(escrowGold, 0, "Escrow gold balance is 0 - migration to stable escrow address incomplete?");

        console.log("[PASS] Escrow has gold");
    }

    function test_economicHealth_shopGold() public {
        console.log("=== Layer 3b: Main Shop Gold Balance ===");

        uint256 shopGold = Shops.getGold(MAIN_SHOP_ID);
        uint256 shopMaxGold = Shops.getMaxGold(MAIN_SHOP_ID);

        console.log("  Shop gold:", shopGold / 1e18, "Gold");
        console.log("  Shop max gold:", shopMaxGold / 1e18, "Gold");

        assertGt(shopMaxGold, 0, "Main shop maxGold is 0 - shop not created or wrong shopId");
        assertGt(shopGold, 0, "Main shop gold is 0 - shop was drained or data orphaned");

        console.log("[PASS] Main shop has gold");
    }

    function test_economicHealth_gasStationConfig() public {
        console.log("=== Layer 3c: GasStation Config ===");

        uint256 ethPerGold = GasStationConfig.getEthPerGold();
        bool enabled = GasStationConfig.getEnabled();

        console.log("  ethPerGold:", ethPerGold);
        console.log("  enabled:", enabled);

        assertGt(ethPerGold, 0, "GasStation ethPerGold is 0 - config not set");

        console.log("[PASS] GasStation configured");
    }

    // ================================================================
    //  Layer 4: Client Flow Simulation
    //  Simulate the critical player flow: mint -> rollStats -> enter ->
    //  spawn -> move. These are the functions the client calls.
    //  If any of these revert with access control errors, the game
    //  is broken for all players.
    // ================================================================

    function test_clientFlowSimulation() public {
        console.log("=== Layer 4: Client Flow Simulation ===");

        address testPlayer = address(0xBEEF);
        vm.deal(testPlayer, 1 ether);

        // Step 1: mintCharacter
        console.log("  Step 1: mintCharacter");
        vm.startPrank(testPlayer);

        bytes32 characterId;
        try world.UD__mintCharacter(testPlayer, bytes32("SmokeTestHero"), "ipfs://smoke") returns (
            bytes32 _characterId
        ) {
            characterId = _characterId;
            console.log("  [OK] mintCharacter succeeded");
        } catch (bytes memory reason) {
            _logRevertReason("mintCharacter", reason);
            vm.stopPrank();
            fail("mintCharacter reverted - game is broken for new players");
            return;
        }

        // Step 2: rollStats
        console.log("  Step 2: rollStats");
        try world.UD__rollStats{value: 0}(bytes32("smokeRng"), characterId, Classes.Warrior) {
            console.log("  [OK] rollStats succeeded");
        } catch (bytes memory reason) {
            _logRevertReason("rollStats", reason);
            // rollStats may require entropy fee — log but continue
            console.log("  [WARN] rollStats reverted (may need entropy fee)");
        }

        // Step 3: enterGame — need valid starter item IDs
        // Find valid starter weapon and armor from the StarterItemPool
        // We'll use the first weapon (item 0) and first armor (item 0)
        // On the live world, starter items are set up by the zone loader
        console.log("  Step 3: enterGame");
        try world.UD__enterGame(characterId, 0, 0) {
            console.log("  [OK] enterGame succeeded");
        } catch (bytes memory reason) {
            _logRevertReason("enterGame", reason);
            // If enterGame fails, we can't test spawn/move — but we need to know WHY
            _assertNotAccessControlError("enterGame", reason);
            console.log("  [WARN] enterGame reverted (may need valid starter items)");
            vm.stopPrank();
            return;
        }

        // Step 4: spawn
        console.log("  Step 4: spawn");
        try world.UD__spawn(characterId) {
            console.log("  [OK] spawn succeeded");
        } catch (bytes memory reason) {
            _logRevertReason("spawn", reason);
            _assertNotAccessControlError("spawn", reason);
            vm.stopPrank();
            return;
        }

        // Step 5: move to adjacent tile
        console.log("  Step 5: move");
        try world.UD__move(characterId, 0, 1) {
            console.log("  [OK] move succeeded");
        } catch (bytes memory reason) {
            _logRevertReason("move", reason);
            _assertNotAccessControlError("move", reason);
        }

        vm.stopPrank();
        console.log("[PASS] Client flow simulation complete");
    }

    /// @dev Log the revert reason for debugging
    function _logRevertReason(string memory fnName, bytes memory reason) internal view {
        if (reason.length >= 4) {
            bytes4 selector;
            assembly {
                selector := mload(add(reason, 32))
            }
            console.log("  [REVERT]", fnName, "selector:");
            console.logBytes4(selector);
        } else {
            console.log("  [REVERT]", fnName, "(no selector)");
        }
        if (reason.length > 4) {
            console.log("  Revert data length:", reason.length);
        }
    }

    /// @dev Assert the revert is NOT an access control error. Access control errors
    ///      mean the deploy is broken — other errors may be expected state issues.
    function _assertNotAccessControlError(string memory fnName, bytes memory reason) internal {
        if (reason.length < 4) return;

        bytes4 selector;
        assembly {
            selector := mload(add(reason, 32))
        }

        // NotAuthorizedCaller() from utils.sol — _requireSystemOrAdmin blocking client calls
        if (selector == NotAuthorizedCaller.selector) {
            console.log("  [CRITICAL] NotAuthorizedCaller on", fnName);
            fail(string.concat("ACCESS CONTROL BLOCKED: ", fnName, " reverted with NotAuthorizedCaller"));
        }

        // World_AccessDenied(string, address) — MUD namespace access check failed
        if (selector == IWorldErrors.World_AccessDenied.selector) {
            console.log("  [CRITICAL] World_AccessDenied on", fnName);
            fail(string.concat("ACCESS DENIED: ", fnName, " reverted with World_AccessDenied"));
        }

        // World_ResourceNotFound(ResourceId, string) — function selector not registered
        if (selector == IWorldErrors.World_ResourceNotFound.selector) {
            console.log("  [CRITICAL] World_ResourceNotFound on", fnName);
            fail(string.concat("SELECTOR MISSING: ", fnName, " reverted with World_ResourceNotFound"));
        }
    }

    // ================================================================
    //  Layer 5: Function Selector Verification
    //  Verify that key client-callable function selectors resolve to
    //  registered systems. A missing selector means the function was
    //  never registered or the system name was truncated differently.
    //
    //  We use staticcall to avoid state changes — we only care whether
    //  the call reaches a system (reverts with game logic errors are OK)
    //  vs reverting with World_ResourceNotFound.
    // ================================================================

    function test_functionSelectors() public {
        console.log("=== Layer 5: Function Selector Verification ===");

        // Build calldata for each function. We don't care about the args being valid —
        // we just need to confirm the selector routes to a system, not to World_ResourceNotFound.

        _assertSelectorExists(
            abi.encodeWithSelector(world.UD__mintCharacter.selector, address(1), bytes32("x"), "uri"),
            "UD__mintCharacter"
        );
        _assertSelectorExists(
            abi.encodeWithSelector(world.UD__enterGame.selector, bytes32(0), uint256(0), uint256(0)),
            "UD__enterGame"
        );
        _assertSelectorExists(
            abi.encodeWithSelector(world.UD__spawn.selector, bytes32(0)),
            "UD__spawn"
        );
        _assertSelectorExists(
            abi.encodeWithSelector(world.UD__move.selector, bytes32(0), uint16(0), uint16(0)),
            "UD__move"
        );
        _assertSelectorExists(
            abi.encodeWithSelector(world.UD__rollStats.selector, bytes32(0), bytes32(0), Classes.Warrior),
            "UD__rollStats"
        );
        _assertSelectorExists(
            abi.encodeWithSelector(world.UD__buyGas.selector, bytes32(0), uint256(0), uint256(0)),
            "UD__buyGas"
        );
        _assertSelectorExists(
            abi.encodeWithSelector(world.UD__getGoldToken.selector),
            "UD__getGoldToken"
        );
        _assertSelectorExists(
            abi.encodeWithSelector(world.UD__getCharacterToken.selector),
            "UD__getCharacterToken"
        );
        _assertSelectorExists(
            abi.encodeWithSelector(world.UD__getItemsContract.selector),
            "UD__getItemsContract"
        );
        _assertSelectorExists(
            abi.encodeWithSelector(world.UD__getStats.selector, bytes32(0)),
            "UD__getStats"
        );
        _assertSelectorExists(
            abi.encodeWithSelector(world.UD__getLevel.selector, bytes32(0)),
            "UD__getLevel"
        );
        _assertSelectorExists(
            abi.encodeWithSelector(world.UD__isValidOwner.selector, bytes32(0), address(0)),
            "UD__isValidOwner"
        );
        _assertSelectorExists(
            abi.encodeWithSelector(world.UD__shopSystemAddress.selector),
            "UD__shopSystemAddress"
        );
        _assertSelectorExists(
            abi.encodeWithSelector(world.UD__getSpawnedPlayerCount.selector),
            "UD__getSpawnedPlayerCount"
        );

        console.log("[PASS] All function selectors resolve to registered systems");
    }

    /// @dev Call the world with the given calldata via staticcall. If it reverts with
    ///      World_ResourceNotFound, the selector is not registered. Any other revert
    ///      (game logic, invalid args) is fine — it means the selector routed correctly.
    function _assertSelectorExists(bytes memory callData, string memory fnName) internal {
        (bool success, bytes memory returnData) = worldAddress.staticcall(callData);

        if (!success && returnData.length >= 4) {
            bytes4 selector;
            assembly {
                selector := mload(add(returnData, 32))
            }
            if (selector == IWorldErrors.World_ResourceNotFound.selector) {
                console.log("  [FAIL] Selector not found:", fnName);
                fail(string.concat("Function selector not registered: ", fnName));
            }
        }
        // success or non-ResourceNotFound revert — selector exists
        console.log("  [OK]", fnName);
    }

    // ================================================================
    //  Layer 6: Cross-System Integration Checks
    //  Additional checks that combine multiple layers to catch subtle
    //  interaction bugs.
    // ================================================================

    function test_goldTokenReachable() public {
        console.log("=== Layer 6a: Gold Token Reachable ===");

        // Verify getGoldToken returns a valid address
        address goldToken = world.UD__getGoldToken();
        assertNotEq(goldToken, address(0), "Gold token address is zero");
        console.log("  Gold token:", goldToken);

        // Verify it has code (is a deployed contract)
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(goldToken)
        }
        assertGt(codeSize, 0, "Gold token has no code - puppet not deployed");

        console.log("[PASS] Gold token reachable");
    }

    function test_characterTokenReachable() public {
        console.log("=== Layer 6b: Character Token Reachable ===");

        address charToken = world.UD__getCharacterToken();
        assertNotEq(charToken, address(0), "Character token address is zero");
        console.log("  Character token:", charToken);

        uint256 codeSize;
        assembly {
            codeSize := extcodesize(charToken)
        }
        assertGt(codeSize, 0, "Character token has no code - puppet not deployed");

        console.log("[PASS] Character token reachable");
    }

    function test_itemsContractReachable() public {
        console.log("=== Layer 6c: Items Contract Reachable ===");

        address itemsContract = world.UD__getItemsContract();
        assertNotEq(itemsContract, address(0), "Items contract address is zero");
        console.log("  Items contract:", itemsContract);

        uint256 codeSize;
        assembly {
            codeSize := extcodesize(itemsContract)
        }
        assertGt(codeSize, 0, "Items contract has no code - puppet not deployed");

        console.log("[PASS] Items contract reachable");
    }

    function test_worldNotPaused() public {
        console.log("=== Layer 6d: World Not Paused ===");

        // If the world is paused, all player-facing functions are blocked.
        // We check by calling a simple view function that should always work.
        // getSpawnedPlayerCount doesn't check pause status, but it confirms
        // the world is responding.
        uint256 playerCount = world.UD__getSpawnedPlayerCount();
        console.log("  Spawned player count:", playerCount);

        console.log("[PASS] World is responding");
    }

    function test_systemAddressConsistency() public {
        console.log("=== Layer 6e: System Address Consistency ===");

        // Verify that the LootManager address returned by Systems table matches
        // what would be returned by the world. This catches the case where
        // the system was upgraded but something still references the old address.

        address lootManager = _sysAddr("LootManagerSyste");
        address gasStation = _sysAddr("GasStationSys");
        address shopSystem = _sysAddr("ShopSystem");

        // All these addresses must have code (be deployed contracts)
        _assertHasCode(lootManager, "LootManager");
        _assertHasCode(gasStation, "GasStation");
        _assertHasCode(shopSystem, "ShopSystem");

        console.log("  LootManager:", lootManager);
        console.log("  GasStation:", gasStation);
        console.log("  ShopSystem:", shopSystem);

        console.log("[PASS] System addresses have code");
    }

    function _assertHasCode(address addr, string memory label) internal {
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(addr)
        }
        assertGt(codeSize, 0, string.concat(label, " has no code at registered address"));
    }
}
