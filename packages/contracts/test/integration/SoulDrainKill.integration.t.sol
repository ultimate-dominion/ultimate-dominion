// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {V3SetUp} from "./V3SetUp.sol";
import {console} from "forge-std/console.sol";
import {
    Stats,
    StatsData,
    MobStats,
    SpellConfig,
    SpellConfigData,
    StatusEffectStats,
    StatusEffectStatsData,
    StatusEffectValidity,
    StatusEffectValidityData,
    StatusEffectTargeting,
    WeaponStatsData,
    StatRestrictionsData,
    EncounterEntity,
    CombatEncounterData
} from "@codegen/index.sol";
import {Classes, EncounterType, ItemType, EffectType, ResistanceStat, ArmorType, MobType} from "@codegen/common.sol";
import {Action, MonsterStats} from "@interfaces/Structs.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";

/**
 * @title SoulDrainKill Regression Test
 * @notice Regression test for the bug where upfront spell damage from
 *         damage_debuff spells (Soul Drain, Entangle, Marked Shot, etc.)
 *         could bring enemies to 0 HP without triggering the death flag.
 *
 *         Root cause: CombatSystem._calculateStatusEffect applied upfront
 *         spell damage but the StatusEffect branch never checked for death,
 *         unlike the PhysicalDamage and MagicDamage branches.
 */
contract SoulDrainKillTest is V3SetUp {
    uint16 constant TEST_X = 0;
    uint16 constant TEST_Y = 3;

    address payable warlock;
    bytes32 warlockCharId;

    bytes32 soulDrainEffectId;
    uint256 soulDrainWeaponId;
    uint256 tinyMobId;

    function setUp() public override {
        super.setUp();

        vm.startPrank(deployer);
        world.UD__setAdmin(address(this), true);
        vm.stopPrank();

        // Create Soul Drain status effect
        StatusEffectStatsData memory seStats = StatusEffectStatsData({
            agiModifier: 0, armorModifier: 0, damagePerTick: 0,
            hpModifier: 0, intModifier: -3,
            resistanceStat: ResistanceStat.Intelligence,
            strModifier: -3
        });
        StatusEffectValidityData memory seValidity = StatusEffectValidityData({
            cooldown: 0, maxStacks: 1, validTime: 0, validTurns: 5
        });
        soulDrainEffectId = world.UD__createEffect(
            EffectType.StatusEffect,
            "soul_drain_curse",
            abi.encode(seStats, seValidity, false) // targetsSelf = false
        );

        // Set SpellConfig for Soul Drain (damage_debuff: 4-8 magic, 0.4/INT, 2 uses)
        SpellConfig.set(soulDrainEffectId, SpellConfigData({
            strPct: -1200, agiPct: 0, intPct: -1200, hpPct: 0,
            armorFlat: 0, spellMinDamage: 4, spellMaxDamage: 8,
            dmgPerStat: 400, dmgScalingStat: ResistanceStat.Intelligence,
            dmgIsPhysical: false, maxUses: 2, isWeaponEnchant: false
        }));

        // Create weapon with Soul Drain effect
        StatRestrictionsData memory noRestrictions = StatRestrictionsData({
            minStrength: 0, minIntelligence: 0, minAgility: 0
        });
        bytes32[] memory effects = new bytes32[](1);
        effects[0] = soulDrainEffectId;
        WeaponStatsData memory wep = WeaponStatsData({
            agiModifier: 0, intModifier: 0, hpModifier: 0,
            maxDamage: 0, minDamage: 0, minLevel: 0, strModifier: 0,
            effects: effects
        });
        soulDrainWeaponId = world.UD__createItem(
            ItemType.Weapon, 1e18, 1000, 10 ether, 1,
            abi.encode(wep, noRestrictions), "test_soul_drain_weapon"
        );
        world.UD__setStarterItemPool(soulDrainWeaponId, true);

        // Create a very weak mob (1 HP) so spell damage guarantees a kill
        uint256[] memory mobWeapons = new uint256[](1);
        mobWeapons[0] = physicalWeaponId;
        tinyMobId = world.UD__createMob(
            MobType.Monster,
            abi.encode(MonsterStats({
                agility: 1, armor: 0, class: Classes.Warrior,
                experience: 100, hasBossAI: false, hitPoints: 1,
                intelligence: 1, inventory: mobWeapons, level: 1, strength: 1
            })),
            "monster:1hp_dummy"
        );

        // Create warlock character
        warlock = _getUser();
        vm.label(warlock, "warlock");

        vm.prank(warlock);
        warlockCharId = world.UD__mintCharacter(warlock, bytes32("Warlock"), "test_uri_warlock");

        vm.startPrank(warlock);
        world.UD__rollStats(keccak256("warlock_rng"), warlockCharId, Classes.Mage);
        world.UD__enterGame(warlockCharId, soulDrainWeaponId, basicArmorId);
        vm.stopPrank();
    }

    function _setupWarlock(int256 str, int256 agi, int256 intel, int256 hp) internal {
        StatsData memory s = world.UD__getStats(warlockCharId);
        s.strength = str;
        s.agility = agi;
        s.intelligence = intel;
        s.currentHp = hp;
        s.maxHp = hp;
        world.UD__adminSetStats(warlockCharId, s);

        vm.startPrank(warlock);
        world.UD__spawn(warlockCharId);
        for (uint16 y = 1; y <= TEST_Y; y++) {
            world.UD__move(warlockCharId, TEST_X, y);
        }
        vm.stopPrank();
    }

    /**
     * @notice REGRESSION: Soul Drain upfront spell damage must kill enemies at 0 HP.
     *
     *         Before fix: StatusEffect branch in CombatSystem applied upfront spell
     *         damage but never set defenderDied, leaving enemies alive at 0 HP forever.
     */
    function test_soulDrain_upfrontDamage_killsEnemy() public {
        // High INT warlock with lots of HP (survives mob counter-attack)
        _setupWarlock(5, 20, 30, 500);

        // Spawn a 1 HP mob
        bytes32 mobEntity = world.UD__spawnMob(tinyMobId, TEST_X, TEST_Y);

        // Verify mob is alive
        assertEq(Stats.getCurrentHp(mobEntity), 1, "mob should start at 1 HP");
        assertFalse(EncounterEntity.getDied(mobEntity), "mob should not be dead yet");

        // Create encounter
        bytes32[] memory _attackers = new bytes32[](1);
        bytes32[] memory _defenders = new bytes32[](1);
        _attackers[0] = warlockCharId;
        _defenders[0] = mobEntity;

        vm.prank(warlock);
        bytes32 encounterId = world.UD__createEncounter(EncounterType.PvE, _attackers, _defenders);

        // Cast Soul Drain
        Action[] memory actions = new Action[](1);
        actions[0] = Action({
            attackerEntityId: warlockCharId,
            defenderEntityId: mobEntity,
            itemId: soulDrainWeaponId
        });

        vm.prank(warlock);
        world.UD__endTurn(encounterId, warlockCharId, actions);

        // Mob must be dead — this was the bug: 0 HP but getDied() was false
        assertEq(Stats.getCurrentHp(mobEntity), 0, "mob HP should be 0");
        assertTrue(EncounterEntity.getDied(mobEntity), "mob must be marked as dead after Soul Drain kills it");

        // Encounter should have ended
        CombatEncounterData memory enc = world.UD__getEncounter(encounterId);
        assertTrue(enc.end != 0, "encounter should have ended");
    }
}
