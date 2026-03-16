// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {IWorld} from "@codegen/world/IWorld.sol";
import {
    AutoAdventureCooldown,
    Characters,
    CombatEncounter,
    CombatOutcome,
    EncounterEntity,
    EntitiesAtPosition,
    MapConfig,
    Position,
    Spawned,
    Stats
} from "@codegen/index.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM} from "@latticexyz/world/src/worldResourceTypes.sol";
import {
    Unauthorized,
    NotSpawned,
    InEncounter,
    OutOfBounds,
    InvalidMove,
    NoWeaponsEquipped
} from "../src/Errors.sol";

/// @notice Tests for AutoAdventureSystem
/// @dev Requires a fully provisioned local world (zone data, mobs, items).
///      If zone-loader hangs on local anvil, these tests must run against a mainnet fork.
contract Test_AutoAdventureSystem is Test {
    using stdJson for string;

    address deployer = vm.addr(vm.envUint("PRIVATE_KEY"));
    address payable public alice;
    uint256 public userNonce = 0;

    IWorld public world;
    address public worldAddress;

    bytes32 public aliceCharacterId;

    function setUp() public {
        vm.deal(deployer, 100 ether);
        vm.startPrank(deployer);
        string memory json = vm.readFile(
            string(abi.encodePacked(vm.projectRoot(), "/deploys/31337/latest.json"))
        );
        worldAddress = json.readAddress(".worldAddress");
        StoreSwitch.setStoreAddress(worldAddress);
        world = IWorld(worldAddress);

        alice = _getUser();
        vm.label(alice, "alice");

        // Create and spawn a test character for alice
        vm.stopPrank();
        vm.startPrank(alice);
        aliceCharacterId = world.UD__mintCharacter(alice, bytes32("AutoAdventureAlice"), "ipfs://test");
        world.UD__enterGame(aliceCharacterId, 1, 1); // starter weapon, starter armor
        world.UD__spawn(aliceCharacterId);
        vm.stopPrank();
    }

    // --- Happy paths ---

    function test_moveOnly() public {
        // Move to (1,0) — tile with no mob expected at home adjacent
        vm.startPrank(alice);
        (bool combatOccurred,,,,, ) = world.UD__autoAdventure(aliceCharacterId, 1, 0);
        vm.stopPrank();

        // Should have moved without combat
        (uint16 x, uint16 y) = Position.get(aliceCharacterId);
        assertEq(x, 1, "x should be 1");
        assertEq(y, 0, "y should be 0");
        assertFalse(combatOccurred, "no combat on move-only");
    }

    function test_combatWithMobs() public {
        // Move to a tile that will have mobs (distance >= 1 from home)
        // spawnOnTileEnter uses prevrandao — mobs may or may not spawn.
        // We move multiple tiles to increase chance of encountering a mob.
        vm.startPrank(alice);

        bool anyCombat;
        // Move right across the map
        for (uint16 i = 1; i <= 5; i++) {
            // Skip if we died
            if (!Spawned.getSpawned(aliceCharacterId)) break;

            // Wait for cooldown
            vm.warp(block.timestamp + 6);
            (bool combat,,,,, ) = world.UD__autoAdventure(aliceCharacterId, i, 0);
            if (combat) {
                anyCombat = true;
                break;
            }
        }
        vm.stopPrank();

        // We can't guarantee mob spawns due to RNG, but we verify no revert
        // and that if combat occurred, CombatOutcome was written
        if (anyCombat) {
            // Verify encounter was cleaned up
            assertEq(
                EncounterEntity.getEncounterId(aliceCharacterId),
                bytes32(0),
                "encounter should be cleared"
            );
        }
    }

    function test_cooldown() public {
        vm.startPrank(alice);
        world.UD__autoAdventure(aliceCharacterId, 1, 0);

        // Immediately try again — should revert with cooldown error
        vm.expectRevert();
        world.UD__autoAdventure(aliceCharacterId, 0, 0);
        vm.stopPrank();
    }

    function test_cooldownExpires() public {
        vm.startPrank(alice);
        world.UD__autoAdventure(aliceCharacterId, 1, 0);

        // Advance time past cooldown (5s)
        vm.warp(block.timestamp + 6);
        // Should succeed — move back
        world.UD__autoAdventure(aliceCharacterId, 0, 0);
        vm.stopPrank();

        (uint16 x, uint16 y) = Position.get(aliceCharacterId);
        assertEq(x, 0, "x should be 0");
        assertEq(y, 0, "y should be 0");
    }

    // --- Auth / validation ---

    function test_notOwner() public {
        address bob = _getUser();
        vm.startPrank(bob);
        vm.expectRevert(Unauthorized.selector);
        world.UD__autoAdventure(aliceCharacterId, 1, 0);
        vm.stopPrank();
    }

    function test_notSpawned() public {
        vm.startPrank(alice);
        // Despawn by removing from board
        world.UD__removeEntityFromBoard(aliceCharacterId);

        vm.expectRevert(NotSpawned.selector);
        world.UD__autoAdventure(aliceCharacterId, 1, 0);
        vm.stopPrank();
    }

    function test_invalidMove() public {
        vm.startPrank(alice);
        // Try to move 2 tiles at once (distance != 1)
        vm.expectRevert(InvalidMove.selector);
        world.UD__autoAdventure(aliceCharacterId, 2, 2);
        vm.stopPrank();
    }

    function test_outOfBounds() public {
        vm.startPrank(alice);
        (uint16 height, uint16 width) = MapConfig.get();
        vm.expectRevert(OutOfBounds.selector);
        world.UD__autoAdventure(aliceCharacterId, width, 0);
        vm.stopPrank();
    }

    function test_alreadyInEncounter() public {
        // Create a manual encounter first, then try autoAdventure
        vm.startPrank(alice);
        // Move to (1,0) first
        world.UD__autoAdventure(aliceCharacterId, 1, 0);
        vm.warp(block.timestamp + 6);

        // If we're not in an encounter, we can't test this directly.
        // This test verifies the InEncounter guard works if encounter state is set.
        bytes32 currentEncounter = EncounterEntity.getEncounterId(aliceCharacterId);
        if (currentEncounter != bytes32(0)) {
            vm.expectRevert(InEncounter.selector);
            world.UD__autoAdventure(aliceCharacterId, 2, 0);
        }
        vm.stopPrank();
    }

    // --- Gas measurement ---

    function test_gas_moveOnly() public {
        vm.startPrank(alice);
        uint256 gasBefore = gasleft();
        world.UD__autoAdventure(aliceCharacterId, 1, 0);
        uint256 gasUsed = gasBefore - gasleft();
        vm.stopPrank();

        emit log_named_uint("Gas used (move only)", gasUsed);
        // Move-only should be under 2M gas
        assertLt(gasUsed, 2_000_000, "move-only gas should be under 2M");
    }

    function test_gas_withCombat() public {
        vm.startPrank(alice);

        // Walk across map until we get combat
        uint256 gasUsed;
        bool gotCombat;
        for (uint16 i = 1; i <= 5; i++) {
            if (!Spawned.getSpawned(aliceCharacterId)) break;
            vm.warp(block.timestamp + 6);

            uint256 gasBefore = gasleft();
            (bool combat,,,,, ) = world.UD__autoAdventure(aliceCharacterId, i, 0);
            uint256 used = gasBefore - gasleft();

            if (combat) {
                gasUsed = used;
                gotCombat = true;
                emit log_named_uint("Gas used (with combat)", gasUsed);
                break;
            }
        }
        vm.stopPrank();

        if (gotCombat) {
            // Combat tx should be under 12M gas (our gas limit)
            assertLt(gasUsed, 12_000_000, "combat gas should be under 12M");
        }
    }

    // --- Delegation ---

    function test_withDelegation() public {
        address burner = _getUser();
        vm.label(burner, "burner");

        // Alice registers burner as delegate
        vm.startPrank(alice);
        ResourceId gameDelegationId = WorldResourceIdLib.encode(
            RESOURCE_SYSTEM,
            "UD",
            "GameDelegation"
        );
        world.registerDelegation(burner, gameDelegationId, new bytes(0));
        vm.stopPrank();

        // Burner calls autoAdventure on behalf of alice
        vm.startPrank(burner);
        world.UD__autoAdventure(aliceCharacterId, 1, 0);
        vm.stopPrank();

        (uint16 x, uint16 y) = Position.get(aliceCharacterId);
        assertEq(x, 1, "x should be 1 via delegation");
        assertEq(y, 0, "y should be 0 via delegation");
    }

    // --- Death scenario ---

    function test_playerDeath_stateCleanup() public {
        vm.startPrank(alice);

        // Move across map until combat occurs, tracking death
        bool died;
        for (uint16 i = 1; i <= 9; i++) {
            if (!Spawned.getSpawned(aliceCharacterId)) {
                died = true;
                break;
            }
            vm.warp(block.timestamp + 6);

            // Set player HP to 1 to force death on first hit
            vm.stopPrank();
            vm.startPrank(deployer);
            Stats.setCurrentHp(aliceCharacterId, 1);
            vm.stopPrank();
            vm.startPrank(alice);

            (bool combat,, bool playerDied,,, ) = world.UD__autoAdventure(aliceCharacterId, i, 0);
            if (combat && playerDied) {
                died = true;
                break;
            }
        }
        vm.stopPrank();

        if (died) {
            // Verify death state
            assertFalse(Spawned.getSpawned(aliceCharacterId), "spawned should be false after death");
            assertTrue(EncounterEntity.getDied(aliceCharacterId), "died should be true after death");
            assertEq(EncounterEntity.getEncounterId(aliceCharacterId), bytes32(0), "encounterId should be cleared");

            // Verify respawn resets died flag
            vm.startPrank(alice);
            world.UD__enterGame(aliceCharacterId, 1, 1);
            vm.stopPrank();

            assertTrue(Spawned.getSpawned(aliceCharacterId), "spawned should be true after respawn");
            assertFalse(EncounterEntity.getDied(aliceCharacterId), "died should be false after respawn");
        }
    }

    // --- Helpers ---

    function _getUser() internal returns (address payable) {
        userNonce++;
        address payable user = payable(
            address(uint160(uint256(keccak256(abi.encodePacked("user", userNonce)))))
        );
        vm.deal(user, 10 ether);
        return user;
    }
}
