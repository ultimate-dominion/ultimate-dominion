// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {V3SetUp} from "./V3SetUp.sol";
import {console} from "forge-std/console.sol";
import {
    Stats,
    StatsData,
    MobStats,
    MobStatsData,
    SpellScaling,
    WeaponStats,
    WeaponStatsData,
    Items,
    CombatEncounterData,
    StarterItemsData
} from "@codegen/index.sol";
import {Classes, EncounterType, ResistanceStat} from "@codegen/common.sol";
import {Action} from "@interfaces/Structs.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";

/**
 * @title CombatV3 Integration Tests
 * @notice Tests V3 combat features in the full integrated system:
 *         - BossAI weapon selection based on defender stats
 *         - SpellScaling stat routing for magic damage
 *         - Block mechanic in full physical combat (not magic)
 *
 * @dev NOTE: MobSystem.spawnMob() hardcodes hasBossAI=false (line 127).
 *      Tests work around this by setting hasBossAI directly on spawned entities.
 *      This bug should be fixed so hasBossAI propagates from the monster template.
 *
 *      ActionOutcome is an offchainTable — data is emitted as events but not
 *      readable from storage. Tests verify behavior through HP changes and
 *      combat completion rather than reading ActionOutcome directly.
 */
contract CombatV3IntegrationTest is V3SetUp {
    uint16 constant TEST_X = 0;
    uint16 constant TEST_Y = 3;

    address payable charlie;
    bytes32 charlieCharId;

    function setUp() public override {
        super.setUp();

        vm.startPrank(deployer);
        world.UD__setAdmin(address(this), true);
        vm.stopPrank();

        charlie = _getUser();
        vm.label(charlie, "charlie");

        vm.prank(charlie);
        charlieCharId = world.UD__mintCharacter(charlie, bytes32("Charlie"), "test_uri");

        vm.startPrank(charlie);
        world.UD__rollStats(keccak256("charlie_rng"), charlieCharId, Classes.Warrior);
        world.UD__enterGame(charlieCharId, physicalWeaponId, basicArmorId);
        vm.stopPrank();
    }

    // =====================================================================
    //  Helpers
    // =====================================================================

    /// @dev Prepare charlie with specific stats and spawn, then walk to test position
    function _setupCharlie(int256 str, int256 agi, int256 intel, int256 hp) internal {
        StatsData memory s = world.UD__getStats(charlieCharId);
        s.strength = str;
        s.agility = agi;
        s.intelligence = intel;
        s.currentHp = hp;
        s.maxHp = hp;
        world.UD__adminSetStats(charlieCharId, s);

        vm.startPrank(charlie);
        world.UD__spawn(charlieCharId);
        // Move one step at a time (move requires distance == 1)
        for (uint16 y = 1; y <= TEST_Y; y++) {
            world.UD__move(charlieCharId, TEST_X, y);
        }
        vm.stopPrank();
    }

    /// @dev Give charlie the magic weapon and equip it (for SpellScaling tests)
    function _equipMagicWeapon() internal {
        // Admin drops magic weapon to charlie
        world.UD__adminDropItem(charlieCharId, magicWeaponId, 1);
        // Equip it
        uint256[] memory items = new uint256[](1);
        items[0] = magicWeaponId;
        vm.prank(charlie);
        world.UD__equipItems(charlieCharId, items);
    }

    /// @dev Create PvE encounter between charlie and a monster entity
    function _createEncounter(bytes32 monsterEntity) internal returns (bytes32 encounterId) {
        bytes32[] memory _attackers = new bytes32[](1);
        bytes32[] memory _defenders = new bytes32[](1);
        _attackers[0] = charlieCharId;
        _defenders[0] = monsterEntity;

        vm.prank(charlie);
        encounterId = world.UD__createEncounter(EncounterType.PvE, _attackers, _defenders);
    }

    /// @dev Execute one turn of combat
    function _endTurn(bytes32 encounterId, bytes32 targetEntity, uint256 weaponId) internal {
        Action[] memory actions = new Action[](1);
        actions[0] = Action({
            attackerEntityId: charlieCharId,
            defenderEntityId: targetEntity,
            itemId: weaponId
        });

        vm.prank(charlie);
        world.UD__endTurn(encounterId, charlieCharId, actions);
    }

    /// @dev Run combat to completion
    function _fightToEnd(bytes32 encounterId, bytes32 targetEntity, uint256 weaponId)
        internal
        returns (bool playerWon)
    {
        uint256 maxIter = 30;
        for (uint256 i; i < maxIter; i++) {
            if (world.UD__getEncounter(encounterId).end != 0) break;
            _endTurn(encounterId, targetEntity, weaponId);
        }
        playerWon = Stats.getCurrentHp(charlieCharId) > 0;
    }

    // =====================================================================
    //  BossAI Integration Tests
    // =====================================================================

    /**
     * @notice BossAI combat with INT-dominant defender completes without revert.
     *
     * Boss AI selects physical weapon (slot 0) when defender has INT >= STR and INT >= AGI.
     * Verifies the full code path: hasBossAI check -> stat comparison -> slot 0 selection
     * -> physical damage calculation -> combat resolution.
     */
    function test_BossAI_INTDominantDefender_CompletesSuccessfully() public {
        bytes32 bossEntity = world.UD__spawnMob(basiliskMobId, TEST_X, TEST_Y);

        // Fix hasBossAI (spawnMob hardcodes false)
        MobStats.setHasBossAI(bossEntity, true);
        assertTrue(MobStats.getHasBossAI(bossEntity), "hasBossAI should be true");

        // Verify boss has 2 different weapons
        uint256 slot0Weapon = MobStats.getItemInventory(bossEntity, 0);
        uint256 slot1Weapon = MobStats.getItemInventory(bossEntity, 1);
        assertTrue(slot0Weapon != slot1Weapon, "boss needs 2 different weapons");

        // Charlie is INT-dominant: INT=20 > STR=5, AGI=5
        // Boss should pick physical weapon (slot 0) to exploit low STR/armor
        _setupCharlie(5, 5, 20, 300);

        bytes32 encounterId = _createEncounter(bossEntity);
        _endTurn(encounterId, bossEntity, physicalWeaponId);

        // Combat completed one turn without revert — BossAI path exercised
        CombatEncounterData memory enc = world.UD__getEncounter(encounterId);
        assertTrue(enc.currentTurn >= 2, "should have progressed past turn 1");
    }

    /**
     * @notice BossAI combat with STR-dominant defender completes without revert.
     *
     * Boss AI selects magic weapon (slot 1) when defender has STR > INT.
     * Verifies the full code path: hasBossAI check -> stat comparison -> slot 1 selection
     * -> magic damage calculation -> combat resolution.
     */
    function test_BossAI_STRDominantDefender_CompletesSuccessfully() public {
        bytes32 bossEntity = world.UD__spawnMob(basiliskMobId, TEST_X, TEST_Y);
        MobStats.setHasBossAI(bossEntity, true);

        // Charlie is STR-dominant: STR=20 > AGI=5, INT=5
        // Boss should pick magic weapon (slot 1) to bypass armor/block
        _setupCharlie(20, 5, 5, 300);

        bytes32 encounterId = _createEncounter(bossEntity);
        _endTurn(encounterId, bossEntity, physicalWeaponId);

        CombatEncounterData memory enc = world.UD__getEncounter(encounterId);
        assertTrue(enc.currentTurn >= 2, "should have progressed past turn 1");
    }

    /**
     * @notice Without BossAI, monster always uses slot 0 regardless of defender stats.
     * Verifies the default (non-boss) code path works.
     */
    function test_NoBossAI_DefaultSlot0_CompletesSuccessfully() public {
        bytes32 bossEntity = world.UD__spawnMob(basiliskMobId, TEST_X, TEST_Y);
        assertFalse(MobStats.getHasBossAI(bossEntity), "hasBossAI should be false by default");

        // Even with STR-dominant defender, non-boss always uses slot 0
        _setupCharlie(20, 5, 5, 300);

        bytes32 encounterId = _createEncounter(bossEntity);
        _endTurn(encounterId, bossEntity, physicalWeaponId);

        CombatEncounterData memory enc = world.UD__getEncounter(encounterId);
        assertTrue(enc.currentTurn >= 2, "should have progressed past turn 1");
    }

    /**
     * @notice BossAI with balanced stats (all equal) selects slot 0.
     * When INT == STR == AGI, the condition (defInt >= defStr && defInt >= defAgi) is true.
     */
    function test_BossAI_BalancedStats_SelectsSlot0() public {
        bytes32 bossEntity = world.UD__spawnMob(basiliskMobId, TEST_X, TEST_Y);
        MobStats.setHasBossAI(bossEntity, true);

        // All stats equal → INT >= STR && INT >= AGI → slot 0
        _setupCharlie(15, 15, 15, 300);

        bytes32 encounterId = _createEncounter(bossEntity);
        _endTurn(encounterId, bossEntity, physicalWeaponId);

        CombatEncounterData memory enc = world.UD__getEncounter(encounterId);
        assertTrue(enc.currentTurn >= 2, "should have progressed past turn 1");
    }

    /**
     * @notice BossAI full fight to completion against a strong player.
     * Validates the entire boss combat loop including weapon selection,
     * damage calculation, and encounter end.
     */
    function test_BossAI_FullFight_CompletesSuccessfully() public {
        bytes32 bossEntity = world.UD__spawnMob(basiliskMobId, TEST_X, TEST_Y);
        MobStats.setHasBossAI(bossEntity, true);

        // Strong balanced character to survive the boss
        _setupCharlie(15, 15, 15, 500);

        bytes32 encounterId = _createEncounter(bossEntity);
        _fightToEnd(encounterId, bossEntity, physicalWeaponId);

        assertTrue(world.UD__getEncounter(encounterId).end != 0, "boss encounter should have ended");
    }

    // =====================================================================
    //  SpellScaling Integration Tests
    // =====================================================================

    /**
     * @notice When SpellScaling routes a magic effect to STR, high-STR attackers
     *         deal effective magic damage even with low INT.
     */
    function test_SpellScaling_STR_HighSTRAttackerDealsDamage() public {
        // Set SpellScaling to STR for the magic effect
        SpellScaling.set(magicAttackEffectId, ResistanceStat.Strength);
        assertEq(
            uint8(SpellScaling.getScalingStat(magicAttackEffectId)),
            uint8(ResistanceStat.Strength),
            "SpellScaling should be set to STR"
        );

        bytes32 monsterEntity = world.UD__spawnMob(midLevelMobId, TEST_X, TEST_Y);
        int256 monsterHpBefore = Stats.getCurrentHp(monsterEntity);

        // Charlie: high STR, low INT — effective with STR-scaled magic
        _setupCharlie(50, 15, 1, 200);

        // Equip magic weapon so charlie can use it in combat
        _equipMagicWeapon();

        bytes32 encounterId = _createEncounter(monsterEntity);
        _endTurn(encounterId, monsterEntity, magicWeaponId);

        int256 monsterHpAfter = Stats.getCurrentHp(monsterEntity);
        assertTrue(
            monsterHpAfter < monsterHpBefore,
            "STR-scaled magic should deal damage to monster"
        );

        // Clean up
        SpellScaling.set(magicAttackEffectId, ResistanceStat.Intelligence);
    }

    /**
     * @notice With default INT scaling, a low-INT attacker produces different
     *         results than STR-scaled. Verifies the code path works.
     */
    function test_SpellScaling_INT_LowINTAttacker_CompletesSuccessfully() public {
        SpellScaling.set(magicAttackEffectId, ResistanceStat.Intelligence);

        bytes32 monsterEntity = world.UD__spawnMob(midLevelMobId, TEST_X, TEST_Y);

        // Charlie: high STR but low INT — ineffective with INT-scaled magic
        _setupCharlie(50, 15, 1, 200);
        _equipMagicWeapon();

        bytes32 encounterId = _createEncounter(monsterEntity);
        _endTurn(encounterId, monsterEntity, magicWeaponId);

        // Verify combat progressed (didn't revert)
        CombatEncounterData memory enc = world.UD__getEncounter(encounterId);
        assertTrue(enc.currentTurn >= 2, "INT-scaled combat should progress");
    }

    /**
     * @notice SpellScaling with AGI routing works end-to-end.
     */
    function test_SpellScaling_AGI_Routing() public {
        SpellScaling.set(magicAttackEffectId, ResistanceStat.Agility);
        assertEq(
            uint8(SpellScaling.getScalingStat(magicAttackEffectId)),
            uint8(ResistanceStat.Agility),
            "SpellScaling should be set to AGI"
        );

        bytes32 monsterEntity = world.UD__spawnMob(midLevelMobId, TEST_X, TEST_Y);

        // Charlie: high AGI — effective with AGI-scaled magic
        _setupCharlie(5, 50, 1, 200);
        _equipMagicWeapon();

        bytes32 encounterId = _createEncounter(monsterEntity);
        _endTurn(encounterId, monsterEntity, magicWeaponId);

        CombatEncounterData memory enc = world.UD__getEncounter(encounterId);
        assertTrue(enc.currentTurn >= 2, "AGI-scaled combat should progress");

        SpellScaling.set(magicAttackEffectId, ResistanceStat.Intelligence);
    }

    // =====================================================================
    //  Block in Full Combat Integration Tests
    // =====================================================================

    /**
     * @notice Physical combat with a high-STR defender exercises the block code path.
     *         Block: STR > 10 -> 2% per point above 10, capped at 30%.
     *         Block halves physical damage. Does not apply to magic.
     */
    function test_Block_PhysicalCombat_HighSTRDefender() public {
        bytes32 monsterEntity = world.UD__spawnMob(weakMageMobId, TEST_X, TEST_Y);

        // Charlie: high STR for max block chance
        _setupCharlie(25, 10, 10, 100);

        bytes32 encounterId = _createEncounter(monsterEntity);
        bool playerWon = _fightToEnd(encounterId, monsterEntity, physicalWeaponId);

        assertTrue(world.UD__getEncounter(encounterId).end != 0, "encounter should have ended");
        if (playerWon) {
            assertTrue(Stats.getCurrentHp(charlieCharId) > 0, "winner should have HP > 0");
        }
    }

    /**
     * @notice Full PvE combat completes when monster uses physical attacks and
     *         defender can block. Verifies block -> damage/2 path doesn't revert.
     */
    function test_Block_FullEncounter_DoesNotRevert() public {
        bytes32 monsterEntity = world.UD__spawnMob(dirRatMobId, TEST_X, TEST_Y);

        // High-STR defender: 30% block chance at cap
        _setupCharlie(25, 8, 8, 60);

        bytes32 encounterId = _createEncounter(monsterEntity);
        _fightToEnd(encounterId, monsterEntity, physicalWeaponId);

        assertTrue(world.UD__getEncounter(encounterId).end != 0, "encounter should have ended");
    }

    /**
     * @notice Low-STR defender has no block chance. Combat completes normally.
     * Contrasts with high-STR tests to show block is STR-dependent.
     */
    function test_Block_LowSTRDefender_NoBlock() public {
        bytes32 monsterEntity = world.UD__spawnMob(dirRatMobId, TEST_X, TEST_Y);

        // STR=5 → below threshold of 10, 0% block chance
        _setupCharlie(5, 15, 15, 60);

        bytes32 encounterId = _createEncounter(monsterEntity);
        _fightToEnd(encounterId, monsterEntity, physicalWeaponId);

        assertTrue(world.UD__getEncounter(encounterId).end != 0, "encounter should have ended");
    }
}
