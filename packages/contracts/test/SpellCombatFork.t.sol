// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

/**
 * @title SpellCombatForkTest
 * @notice Integration tests for the spell system running against beta (fork).
 *         Verifies end-to-end flow: SpellConfig exists, compute mods, spell damage,
 *         heal, enchant, use tracking, cleanup — all via IWorld calls on live state.
 *
 * Usage:
 *   source .env.testnet && WORLD_ADDRESS=$WORLD_ADDRESS forge test \
 *     --fork-url $RPC_URL --match-contract "SpellCombatForkTest" --skip script -vv
 */

import "forge-std/Test.sol";
import "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {IWorld} from "@codegen/world/IWorld.sol";
import {
    SpellConfig,
    SpellConfigData,
    ComputedEffectMods,
    ComputedEffectModsData,
    WeaponEnchant,
    WeaponEnchantData,
    SpellUsesTracking,
    Stats,
    StatusEffectStats,
    StatusEffectStatsData,
    StatusEffectValidity,
    StatusEffectValidityData,
    StatusEffectTargeting,
    Effects
} from "@codegen/index.sol";
import {ResistanceStat, EffectType} from "@codegen/common.sol";
import {AdjustedCombatStats} from "@interfaces/Structs.sol";

contract SpellCombatForkTest is Test {
    IWorld public world;
    address public worldAddress;

    // Effect IDs
    bytes32 battleCryId;
    bytes32 divineShieldId;
    bytes32 entangleId;
    bytes32 exposeWeaknessId;
    bytes32 arcaneInfusionId;
    bytes32 blessingId;
    bytes32 soulDrainCurseId;

    // Fake entity IDs for testing (not real characters — just storage keys)
    bytes32 constant ENTITY_A = keccak256("spell_test_entity_a");
    bytes32 constant ENTITY_B = keccak256("spell_test_entity_b");

    function setUp() public {
        worldAddress = vm.envAddress("WORLD_ADDRESS");
        require(worldAddress != address(0), "WORLD_ADDRESS env var not set");
        world = IWorld(worldAddress);
        StoreSwitch.setStoreAddress(worldAddress);

        battleCryId = _effectId("battle_cry");
        divineShieldId = _effectId("divine_shield");
        entangleId = _effectId("entangle");
        exposeWeaknessId = _effectId("expose_weakness");
        arcaneInfusionId = _effectId("arcane_infusion");
        blessingId = _effectId("blessing");
        soulDrainCurseId = _effectId("soul_drain_curse");
    }

    function _effectId(string memory name) internal pure returns (bytes32) {
        return bytes32(bytes8(keccak256(abi.encode(name))));
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Verify SpellConfig was deployed correctly
    // ═══════════════════════════════════════════════════════════════════════

    function test_spellConfig_battleCry_exists() public {
        assertTrue(world.UD__hasSpellConfig(battleCryId), "battle_cry SpellConfig missing");
        SpellConfigData memory cfg = SpellConfig.get(battleCryId);
        assertEq(cfg.strPct, 2500, "strPct");
        assertEq(cfg.hpPct, 1000, "hpPct");
        assertEq(cfg.armorFlat, 800, "armorFlat");
        assertEq(cfg.spellMinDamage, 5, "spellMinDamage");
        assertEq(cfg.spellMaxDamage, 10, "spellMaxDamage");
        assertEq(cfg.dmgPerStat, 500, "dmgPerStat");
        assertTrue(cfg.dmgIsPhysical, "dmgIsPhysical");
        assertEq(cfg.maxUses, 2, "maxUses");
        assertFalse(cfg.isWeaponEnchant, "isWeaponEnchant");
    }

    function test_spellConfig_divineShield_exists() public {
        assertTrue(world.UD__hasSpellConfig(divineShieldId), "divine_shield SpellConfig missing");
        SpellConfigData memory cfg = SpellConfig.get(divineShieldId);
        assertEq(cfg.strPct, 1500);
        assertEq(cfg.hpPct, 1500);
        assertEq(cfg.armorFlat, 1000);
        assertEq(cfg.maxUses, 2);
    }

    function test_spellConfig_entangle_exists() public {
        assertTrue(world.UD__hasSpellConfig(entangleId), "entangle SpellConfig missing");
        SpellConfigData memory cfg = SpellConfig.get(entangleId);
        assertEq(cfg.strPct, -1500);
        assertEq(cfg.agiPct, -2500);
        assertEq(cfg.armorFlat, -300);
        assertFalse(cfg.dmgIsPhysical);
        assertEq(cfg.maxUses, 1);
    }

    function test_spellConfig_arcaneInfusion_isEnchant() public {
        assertTrue(world.UD__hasSpellConfig(arcaneInfusionId), "arcane_infusion SpellConfig missing");
        SpellConfigData memory cfg = SpellConfig.get(arcaneInfusionId);
        assertTrue(cfg.isWeaponEnchant, "should be weapon enchant");
        assertEq(cfg.dmgPerStat, 250);
        assertEq(cfg.maxUses, 1);
    }

    function test_spellConfig_blessing_exists() public {
        assertTrue(world.UD__hasSpellConfig(blessingId), "blessing SpellConfig missing");
        SpellConfigData memory cfg = SpellConfig.get(blessingId);
        assertEq(cfg.intPct, 1200);
        assertEq(cfg.hpPct, 1500);
        assertEq(cfg.armorFlat, 700);
    }

    function test_spellConfig_noConfigForBasicAttack() public {
        bytes32 basicAttack = bytes32(bytes8(keccak256(abi.encode("basic weapon attack"))));
        assertFalse(world.UD__hasSpellConfig(basicAttack), "basic attack should NOT have SpellConfig");
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Compute and store modifiers (via IWorld)
    // ═══════════════════════════════════════════════════════════════════════

    function test_computeModifiers_battleCry() public {
        AdjustedCombatStats memory stats = AdjustedCombatStats({
            strength: 20, agility: 12, intelligence: 8, armor: 5, maxHp: 50, currentHp: 50
        });
        world.UD__computeAndStoreModifiers(ENTITY_A, battleCryId, stats);

        ComputedEffectModsData memory c = ComputedEffectMods.get(ENTITY_A, battleCryId);
        assertTrue(c.exists);
        assertEq(c.strModifier, 5, "+5 STR (25% of 20)");
        assertEq(c.hpModifier, 5, "+5 HP (10% of 50)");
        assertEq(c.armorModifier, 800, "+800 armor (flat)");
        assertEq(c.agiModifier, 0);
        assertEq(c.intModifier, 0);
    }

    function test_computeModifiers_entangle_debuff() public {
        AdjustedCombatStats memory targetStats = AdjustedCombatStats({
            strength: 14, agility: 16, intelligence: 10, armor: 8, maxHp: 40, currentHp: 40
        });
        world.UD__computeAndStoreModifiers(ENTITY_A, entangleId, targetStats);

        ComputedEffectModsData memory c = ComputedEffectMods.get(ENTITY_A, entangleId);
        assertTrue(c.exists);
        assertEq(c.strModifier, -2, "-2 STR (-15% of 14)");
        assertEq(c.agiModifier, -4, "-4 AGI (-25% of 16)");
        assertEq(c.armorModifier, -300, "-300 armor (flat)");
    }

    function test_computeModifiers_pvpSameClass_independent() public {
        AdjustedCombatStats memory statsA = AdjustedCombatStats({
            strength: 20, agility: 10, intelligence: 10, armor: 5, maxHp: 50, currentHp: 50
        });
        AdjustedCombatStats memory statsB = AdjustedCombatStats({
            strength: 14, agility: 10, intelligence: 10, armor: 5, maxHp: 40, currentHp: 40
        });
        world.UD__computeAndStoreModifiers(ENTITY_A, battleCryId, statsA);
        world.UD__computeAndStoreModifiers(ENTITY_B, battleCryId, statsB);

        assertEq(ComputedEffectMods.getStrModifier(ENTITY_A, battleCryId), 5, "A: +5");
        assertEq(ComputedEffectMods.getStrModifier(ENTITY_B, battleCryId), 3, "B: +3");
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Spell damage (via IWorld)
    // ═══════════════════════════════════════════════════════════════════════

    function test_spellDamage_battleCry_physical() public {
        AdjustedCombatStats memory attacker = AdjustedCombatStats({
            strength: 20, agility: 10, intelligence: 10, armor: 5, maxHp: 100, currentHp: 100
        });
        AdjustedCombatStats memory defender = AdjustedCombatStats({
            strength: 10, agility: 10, intelligence: 10, armor: 3, maxHp: 40, currentHp: 40
        });
        // Use ENTITY_A as attackerId — ClassMultipliers will be 0, defaulting to 1000 (100%)
        int256 dmg = world.UD__calculateSpellDamage(battleCryId, ENTITY_A, attacker, defender, 12345);
        assertGt(dmg, 0, "physical spell damage > 0");
        console.log("Battle Cry damage:", uint256(dmg));
    }

    function test_spellDamage_entangle_magic() public {
        AdjustedCombatStats memory attacker = AdjustedCombatStats({
            strength: 10, agility: 10, intelligence: 18, armor: 5, maxHp: 50, currentHp: 50
        });
        AdjustedCombatStats memory defender = AdjustedCombatStats({
            strength: 10, agility: 10, intelligence: 8, armor: 3, maxHp: 40, currentHp: 40
        });
        int256 dmg = world.UD__calculateSpellDamage(entangleId, ENTITY_A, attacker, defender, 67890);
        assertGt(dmg, 0, "magic spell damage > 0");
        console.log("Entangle damage:", uint256(dmg));
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Spell use tracking (via IWorld)
    // ═══════════════════════════════════════════════════════════════════════

    function test_useTracking_battleCry_twoUses() public {
        bytes32 encId = keccak256("fork_test_enc_1");

        bool cast1 = world.UD__consumeSpellUse(encId, ENTITY_A, battleCryId);
        assertTrue(cast1, "first cast OK");

        bool cast2 = world.UD__consumeSpellUse(encId, ENTITY_A, battleCryId);
        assertTrue(cast2, "second cast OK");

        bool cast3 = world.UD__consumeSpellUse(encId, ENTITY_A, battleCryId);
        assertFalse(cast3, "third cast should fail");
    }

    function test_useTracking_entangle_singleUse() public {
        bytes32 encId = keccak256("fork_test_enc_2");

        assertTrue(world.UD__consumeSpellUse(encId, ENTITY_A, entangleId), "first cast OK");
        assertFalse(world.UD__consumeSpellUse(encId, ENTITY_A, entangleId), "second cast should fail");
    }

    function test_useTracking_perEncounter_resets() public {
        bytes32 enc1 = keccak256("fork_test_enc_3a");
        bytes32 enc2 = keccak256("fork_test_enc_3b");

        world.UD__consumeSpellUse(enc1, ENTITY_A, entangleId);
        assertFalse(world.UD__consumeSpellUse(enc1, ENTITY_A, entangleId), "exhausted in enc1");
        assertTrue(world.UD__consumeSpellUse(enc2, ENTITY_A, entangleId), "fresh in enc2");
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Heal (via IWorld)
    // ═══════════════════════════════════════════════════════════════════════

    function test_heal_divineShield() public {
        // Set up fake entity HP
        Stats.setCurrentHp(ENTITY_A, 40);
        Stats.setMaxHp(ENTITY_A, 60);

        world.UD__applySpellHeal(ENTITY_A, 1500, 60); // 15% of 60 = 9

        assertEq(Stats.getCurrentHp(ENTITY_A), 49, "40 + 9 = 49");
    }

    function test_heal_cappedAtMaxHp() public {
        Stats.setCurrentHp(ENTITY_A, 48);
        Stats.setMaxHp(ENTITY_A, 50);

        world.UD__applySpellHeal(ENTITY_A, 1500, 50); // 15% of 50 = 7, 48+7=55 > 50

        assertEq(Stats.getCurrentHp(ENTITY_A), 50, "capped at maxHp");
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Weapon enchant (via IWorld)
    // ═══════════════════════════════════════════════════════════════════════

    function test_weaponEnchant_store() public {
        world.UD__applyWeaponEnchant(ENTITY_A, arcaneInfusionId, 2);

        WeaponEnchantData memory e = WeaponEnchant.get(ENTITY_A);
        assertEq(e.effectId, arcaneInfusionId);
        assertEq(e.bonusDmgMin, 3);
        assertEq(e.bonusDmgMax, 6);
        assertEq(e.dmgPerInt, 250);
        assertEq(e.turnApplied, 2);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Cleanup (via IWorld)
    // ═══════════════════════════════════════════════════════════════════════

    function test_cleanup_removesState() public {
        // Create state
        AdjustedCombatStats memory stats = AdjustedCombatStats({
            strength: 20, agility: 10, intelligence: 10, armor: 5, maxHp: 50, currentHp: 50
        });
        world.UD__computeAndStoreModifiers(ENTITY_A, battleCryId, stats);
        world.UD__applyWeaponEnchant(ENTITY_A, arcaneInfusionId, 1);

        assertTrue(ComputedEffectMods.getExists(ENTITY_A, battleCryId), "pre-cleanup: exists");

        bytes32[] memory effects = new bytes32[](1);
        effects[0] = battleCryId;
        world.UD__cleanupEntitySpellState(ENTITY_A, effects);

        assertFalse(ComputedEffectMods.getExists(ENTITY_A, battleCryId), "post-cleanup: gone");
        assertEq(WeaponEnchant.getEffectId(ENTITY_A), bytes32(0), "enchant gone");
    }
}
