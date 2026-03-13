// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import {CombatMath} from "../src/libraries/CombatMath.sol";
import {PhysicalDamageStatsData, WeaponStatsData} from "@codegen/index.sol";
import {
    ATTACK_MODIFIER,
    AGI_ATTACK_MODIFIER,
    CLASS_MULTIPLIER_BASE,
    EVASION_CAP,
    DOUBLE_STRIKE_CAP
} from "../constants.sol";

/**
 * @title CombatBalanceTest
 * @notice Comprehensive combat balance tests - all 9 classes x 8 weapons, physical + magic paths.
 * @dev No world deployment needed. Pure-math simulation.
 *      Physical weapons: planned weighted stat scaling, armor, evasion, double strike.
 *      Magic weapons: INT vs INT, magic resistance, no evasion/double strike.
 *      Run: forge test --match-contract CombatBalance -vvv
 */
contract CombatBalanceTest is Test {
    uint256 constant WAD = 1 ether;
    uint256 constant TRIANGLE_PER_STAT = WAD / 50; // 2% per stat point
    uint256 constant TRIANGLE_MAX = WAD * 12 / 100; // 12% cap

    // =====================================================================
    // Structs
    // =====================================================================

    struct ClassBuild {
        string name;
        int256 baseStr;   // stats WITHOUT weapon modifiers
        int256 baseAgi;
        int256 baseInt;
        int256 armor;
        int256 hp;
        uint256 physMult;  // 1000 = 100%
        uint256 spellMult;
        uint256 critMult;
        uint256 healMult;
    }

    struct Weapon {
        string name;
        int256 strMod;
        int256 agiMod;
        int256 intMod;
        int256 minDmg;
        int256 maxDmg;
        bool isMagic; // true = magic path (INT vs INT)
    }

    struct Monster {
        string name;
        int256 str;
        int256 agi;
        int256 int_;
        int256 armor;
        int256 hp;
    }

    struct CombatResult {
        int256 avgDmgPerHit;
        uint256 hitPct;
        uint256 evasionPct;
        uint256 doubleStrikePct;
        uint256 critPct;
        uint256 effectiveDPT; // scaled x100
        uint256 turnsToKill;
        bool isMagic;
    }

    // =====================================================================
    // Data - Class builds (base stats WITHOUT weapon mods)
    // Stats = base roll + race + armor type + leveling + advanced class
    // =====================================================================

    function _allClasses() internal pure returns (ClassBuild[9] memory) {
        return [
            // Warrior: Dwarf/Plate. Base STR=20 (total 24 - Giant's Club +4)
            ClassBuild("Warrior",  20,  6,  5, 5, 45, 1100, 1000, 1000, 1000),
            // Paladin: Human/Plate. Base STR=18 (total 21 - Warhammer +3)
            ClassBuild("Paladin",  18,  7,  7, 5, 55, 1050, 1000, 1000, 1050),
            // Ranger: Elf/Leather. Base AGI=20, STR=7 (totals 25,9 - Bow +5,+2)
            ClassBuild("Ranger",    7, 20,  6, 1, 32, 1100, 1000, 1000, 1000),
            // Rogue: Elf/Leather. Base AGI=19, STR=7 (totals 24,9 - Bow +5,+2)
            ClassBuild("Rogue",     7, 19, 10, 1, 32, 1000, 1000, 1150, 1000),
            // Druid: Human/Leather. Base AGI=13, STR=12 (totals 18,14 - Bow +5,+2)
            ClassBuild("Druid",    12, 13,  7, 2, 38, 1050, 1050, 1000, 1000),
            // Warlock: Elf/Cloth. Base INT=16, AGI=12 (totals 21,14 - Rod +5,+2)
            ClassBuild("Warlock",   5, 12, 16, 0, 30, 1000, 1200, 1000, 1000),
            // Wizard: Human/Cloth. Base INT=20, AGI=8 (totals 25,10 - Rod +5,+2)
            ClassBuild("Wizard",    5,  8, 20, 0, 28, 1000, 1250, 1000, 1000),
            // Cleric: Human/Cloth. Base INT=19 (total 22 - Mage Staff +3)
            ClassBuild("Cleric",    6,  8, 19, 0, 45, 1000, 1000, 1000, 1100),
            // Sorcerer: Human/Cloth. Base INT=18, STR=13 (totals 20,14 - Crystal Blade +2,+1)
            ClassBuild("Sorcerer", 13,  8, 18, 0, 37, 1000, 1150, 1000, 1000)
        ];
    }

    // =====================================================================
    // Data - All weapons. [P]=physical path, [M]=magic path
    // =====================================================================

    function _allWeapons() internal pure returns (Weapon[8] memory) {
        return [
            Weapon("Giants Club",    4, 0, 0, 5, 7, false), // 0 [P] Pure STR
            Weapon("Warhammer",      3, 0, 0, 4, 7, false), // 1 [P] Pure STR
            Weapon("Darkwood Bow",   2, 5, 0, 6, 9, false), // 2 [P] AGI dominant
            Weapon("Crystal Blade",  1, 0, 2, 6, 9, false), // 3 [P] INT/STR hybrid
            Weapon("Etched Blade",   1, 0, 1, 5, 7, false), // 4 [P] STR/INT balanced
            Weapon("Longbow",        1, 2, 0, 3, 5, false), // 5 [P] AGI dominant, weak
            Weapon("Smoldering Rod", 0, 2, 5, 5, 8, true),  // 6 [M] INT dominant
            Weapon("Bone Staff",     0, 0, 3, 3, 5, true)   // 7 [M] Pure INT
        ];
    }

    // Default weapon index per class
    function _defaultWeapon(uint256 c) internal pure returns (uint256) {
        if (c == 0) return 0; // Warrior  -> Giants Club
        if (c == 1) return 1; // Paladin  -> Warhammer
        if (c == 2) return 2; // Ranger   -> Darkwood Bow
        if (c == 3) return 2; // Rogue    -> Darkwood Bow
        if (c == 4) return 2; // Druid    -> Darkwood Bow
        if (c == 5) return 6; // Warlock  -> Smoldering Rod
        if (c == 6) return 6; // Wizard   -> Smoldering Rod
        if (c == 7) return 7; // Cleric   -> Bone Staff
        return 3;             // Sorcerer -> Crystal Blade
    }

    // =====================================================================
    // Data - Dark Cave monsters
    // =====================================================================

    function _allMonsters() internal pure returns (Monster[10] memory) {
        return [
            Monster("Cave Rat",         4,  7,  3, 0, 12),
            Monster("Fungal Shaman",    4,  5,  9, 0, 14),
            Monster("Cavern Brute",    11,  5,  4, 1, 22),
            Monster("Crystal Elem",     5,  6, 12, 1, 20),
            Monster("Cave Troll",      14,  8,  6, 3, 32),
            Monster("Phase Spider",    10, 15,  7, 0, 28),
            Monster("Lich Acolyte",     8,  9, 17, 0, 32),
            Monster("Stone Giant",     18, 10,  9, 4, 48),
            Monster("Shadow Stalker",  14, 20, 10, 0, 42),
            Monster("Shadow Dragon",   18, 18, 20, 3, 70)
        ];
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    function _effectiveStats(ClassBuild memory b, Weapon memory w)
        internal pure returns (int256 s, int256 a, int256 i)
    {
        s = b.baseStr + w.strMod;
        a = b.baseAgi + w.agiMod;
        i = b.baseInt + w.intMod;
    }

    function _weightedStat(int256 str, int256 agi, int256 int_, Weapon memory w)
        internal pure returns (int256)
    {
        int256 total = w.strMod + w.agiMod + w.intMod;
        if (total == 0) {
            int256 m = str > agi ? str : agi;
            return m > int_ ? m : int_;
        }
        return (w.strMod * str + w.agiMod * agi + w.intMod * int_) / total;
    }

    function _scalingMod(Weapon memory w) internal pure returns (uint256) {
        return (w.agiMod > w.strMod && w.agiMod > w.intMod)
            ? AGI_ATTACK_MODIFIER
            : ATTACK_MODIFIER;
    }

    function _isAgiDominant(Weapon memory w) internal pure returns (bool) {
        return w.agiMod > w.strMod && w.agiMod > w.intMod;
    }

    function _dominant(int256 str, int256 agi, int256 int_)
        internal pure returns (uint8 dom, int256 val)
    {
        if (str >= agi && str >= int_) return (0, str);
        if (agi > str && agi >= int_) return (1, agi);
        return (2, int_);
    }

    function _triangleBonus(
        int256 aS, int256 aA, int256 aI,
        int256 dS, int256 dA, int256 dI,
        int256 dmg
    ) internal pure returns (int256) {
        (uint8 ad, int256 av) = _dominant(aS, aA, aI);
        (uint8 dd, int256 dv) = _dominant(dS, dA, dI);
        bool adv = (ad == 0 && dd == 1) || (ad == 1 && dd == 2) || (ad == 2 && dd == 0);
        if (adv) {
            int256 diff = av > dv ? av - dv : int256(0);
            uint256 bonus = uint256(diff) * TRIANGLE_PER_STAT;
            if (bonus > TRIANGLE_MAX) bonus = TRIANGLE_MAX;
            return (dmg * int256(WAD + bonus)) / int256(WAD);
        }
        return dmg;
    }

    function _hitProb(int256 atkStat, int256 defStat) internal pure returns (uint256) {
        uint256 damp = atkStat > defStat ? uint256(95) : uint256(30);
        uint256 absDiff = atkStat >= defStat
            ? uint256(atkStat - defStat)
            : uint256(defStat - atkStat);
        int256 p = 90 + ((atkStat - defStat) * 1000) / int256((absDiff + damp) * 10);
        if (p < 5) p = 5;
        if (p > 98) p = 98;
        return uint256(p);
    }

    function _critFactor(int256 agi, uint256 critMult) internal pure returns (uint256 pct, uint256 factor) {
        int256 a = agi > 0 ? agi : int256(0);
        pct = 4 + uint256(a) / 4;
        uint256 ccm = critMult > CLASS_MULTIPLIER_BASE ? critMult : CLASS_MULTIPLIER_BASE;
        factor = (100 - pct) * 10 + pct * 20 * ccm / 1000;
    }

    // =====================================================================
    // Physical damage simulation (planned weighted stat system)
    // =====================================================================

    function _simulatePhysical(
        ClassBuild memory atk, Weapon memory weapon,
        int256 dS, int256 dA, int256 dI, int256 dArm, int256 dHp
    ) internal pure returns (CombatResult memory r) {
        (int256 aS, int256 aA, int256 aI) = _effectiveStats(atk, weapon);
        int256 atkW = _weightedStat(aS, aA, aI, weapon);
        int256 defW = _weightedStat(dS, dA, dI, weapon);
        uint256 mod = _scalingMod(weapon);

        r.hitPct = _hitProb(atkW, defW);

        // Average damage
        int256 dmgLow = CombatMath.addStatBonus(atkW, defW, weapon.minDmg * int256(mod), mod);
        int256 dmgHigh = CombatMath.addStatBonus(atkW, defW, weapon.maxDmg * int256(mod), mod);
        int256 dmg = (dmgLow + dmgHigh) / 2;

        // Armor
        int256 armRed = CombatMath.calculateArmorModifier(dArm, 0, dmg);
        dmg -= armRed;
        if (dmg < 1) dmg = 1;

        // Class phys mult
        if (atk.physMult != CLASS_MULTIPLIER_BASE) {
            dmg = (dmg * int256(atk.physMult)) / int256(CLASS_MULTIPLIER_BASE);
        }

        // Triangle
        dmg = _triangleBonus(aS, aA, aI, dS, dA, dI, dmg);
        r.avgDmgPerHit = dmg;

        // Crit
        (r.critPct, ) = _critFactor(aA, atk.critMult);
        {
            (, uint256 cf) = _critFactor(aA, atk.critMult);
            r.avgDmgPerHit = (r.avgDmgPerHit * int256(cf)) / 1000;
        }

        // Block (STR-based, 55% reduction)
        {
            uint256 blockPct;
            if (dS > 10) {
                blockPct = uint256(dS - 10) * 2;
                if (blockPct > 35) blockPct = 35;
            }
            if (blockPct > 0) {
                // weighted average: (1-blockPct)*damage + blockPct*(damage*45/100)
                r.avgDmgPerHit = (r.avgDmgPerHit * int256(100 - blockPct) + r.avgDmgPerHit * int256(blockPct) * 45 / 100) / 100;
            }
        }

        // Evasion (with STR reduction)
        if (dA > aA) {
            uint256 ch = uint256(dA - aA) * 2;
            // STR reduction
            if (aS > dS) {
                uint256 strRed = uint256(aS - dS);
                if (strRed > 15) strRed = 15;
                if (strRed >= ch) ch = 0;
                else ch -= strRed;
            }
            if (ch > EVASION_CAP) ch = EVASION_CAP;
            r.evasionPct = ch;
        }

        // Double strike (AGI weapons only, *3 multiplier)
        if (_isAgiDominant(weapon) && aA > dA) {
            uint256 ch = uint256(aA - dA) * 3;
            if (ch > DOUBLE_STRIKE_CAP) ch = DOUBLE_STRIKE_CAP;
            r.doubleStrikePct = ch;
        }

        // Effective DPT (x100)
        {
            uint256 d100 = uint256(r.avgDmgPerHit) * 100;
            uint256 dsF = 200 + r.doubleStrikePct;
            r.effectiveDPT = d100 * r.hitPct * (100 - r.evasionPct) * dsF / (100 * 100 * 200);
        }

        r.turnsToKill = r.effectiveDPT > 0
            ? (uint256(dHp) * 100 + r.effectiveDPT - 1) / r.effectiveDPT
            : 999;
    }

    // =====================================================================
    // Magic damage simulation (INT vs INT, no evasion/double strike)
    // =====================================================================

    function _simulateMagic(
        ClassBuild memory atk, Weapon memory weapon,
        int256 dS, int256 dA, int256 dI, int256 /*dArm*/, int256 dHp
    ) internal pure returns (CombatResult memory r) {
        r.isMagic = true;
        (int256 aS, int256 aA, int256 aI) = _effectiveStats(atk, weapon);

        // Hit: INT vs INT
        r.hitPct = _hitProb(aI, dI);

        // Damage: INT vs INT, always ATTACK_MODIFIER
        int256 dmgLow = CombatMath.addStatBonus(aI, dI, weapon.minDmg * int256(ATTACK_MODIFIER), ATTACK_MODIFIER);
        int256 dmgHigh = CombatMath.addStatBonus(aI, dI, weapon.maxDmg * int256(ATTACK_MODIFIER), ATTACK_MODIFIER);
        int256 dmg = (dmgLow + dmgHigh) / 2;
        if (dmg < 1) dmg = 1;

        // Magic resistance (2% per INT, cap 40%)
        int256 resist = CombatMath.calculateMagicResistance(dI, dmg);
        dmg -= resist;
        if (dmg < 1) dmg = 1;

        // Class spell mult
        if (atk.spellMult != CLASS_MULTIPLIER_BASE) {
            dmg = (dmg * int256(atk.spellMult)) / int256(CLASS_MULTIPLIER_BASE);
        }

        // Triangle (based on CHARACTER dominant stat)
        dmg = _triangleBonus(aS, aA, aI, dS, dA, dI, dmg);
        r.avgDmgPerHit = dmg;

        // Crit
        (r.critPct, ) = _critFactor(aA, atk.critMult);
        {
            (, uint256 cf) = _critFactor(aA, atk.critMult);
            r.avgDmgPerHit = (r.avgDmgPerHit * int256(cf)) / 1000;
        }

        // Magic block (STR-based, 30% reduction)
        {
            uint256 blockPct;
            if (dS > 10) {
                blockPct = uint256(dS - 10) * 2;
                if (blockPct > 35) blockPct = 35;
            }
            if (blockPct > 0) {
                r.avgDmgPerHit = (r.avgDmgPerHit * int256(100 - blockPct) + r.avgDmgPerHit * int256(blockPct) * 70 / 100) / 100;
            }
        }

        // No evasion, no double strike
        r.effectiveDPT = uint256(r.avgDmgPerHit) * r.hitPct;

        r.turnsToKill = r.effectiveDPT > 0
            ? (uint256(dHp) * 100 + r.effectiveDPT - 1) / r.effectiveDPT
            : 999;
    }

    // =====================================================================
    // Dispatcher
    // =====================================================================

    function _simulate(
        ClassBuild memory atk, Weapon memory weapon,
        int256 dS, int256 dA, int256 dI, int256 dArm, int256 dHp
    ) internal pure returns (CombatResult memory) {
        if (weapon.isMagic) return _simulateMagic(atk, weapon, dS, dA, dI, dArm, dHp);
        return _simulatePhysical(atk, weapon, dS, dA, dI, dArm, dHp);
    }

    // =====================================================================
    // Logging
    // =====================================================================

    function _logResult(string memory label, CombatResult memory r) internal view {
        console.log(
            string.concat("  vs ", label),
            string.concat(
                " | hit:", vm.toString(r.hitPct),
                " dmg:", vm.toString(uint256(r.avgDmgPerHit)),
                " crit:", vm.toString(r.critPct), "%"
            )
        );
        console.log(
            string.concat(
                "     evd:", vm.toString(r.evasionPct),
                " ds:", vm.toString(r.doubleStrikePct),
                " dpt:", vm.toString(r.effectiveDPT),
                " ttk:", vm.toString(r.turnsToKill),
                r.isMagic ? " [SPELL]" : " [PHYS]"
            )
        );
    }

    // =====================================================================
    // TEST 1: PvE - each class with default weapon vs all monsters
    // =====================================================================

    function test_PvE_DamageTable() public {
        ClassBuild[9] memory cls = _allClasses();
        Weapon[8] memory wpns = _allWeapons();
        Monster[10] memory mons = _allMonsters();

        console.log("============================================");
        console.log("  PVE ENDGAME DAMAGE TABLE");
        console.log("  Physical: weighted stat scaling (planned)");
        console.log("  Magic: INT vs INT");
        console.log("============================================");

        for (uint256 i = 0; i < 9; i++) {
            Weapon memory w = wpns[_defaultWeapon(i)];
            (int256 s, int256 a, int256 ii) = _effectiveStats(cls[i], w);
            console.log(string.concat(
                "--- ", cls[i].name, " (", w.name, w.isMagic ? " [M]" : " [P]", ") ---"
            ));
            console.log(string.concat(
                "  STR:", vm.toString(uint256(s)),
                " AGI:", vm.toString(uint256(a)),
                " INT:", vm.toString(uint256(ii)),
                " ARM:", vm.toString(uint256(cls[i].armor)),
                " HP:", vm.toString(uint256(cls[i].hp))
            ));
            for (uint256 j = 0; j < 10; j++) {
                CombatResult memory r = _simulate(
                    cls[i], w,
                    mons[j].str, mons[j].agi, mons[j].int_,
                    mons[j].armor, mons[j].hp
                );
                _logResult(mons[j].name, r);
            }
            console.log("");
        }
    }

    // =====================================================================
    // TEST 2: PvP win matrix with default weapons
    // =====================================================================

    function test_PvP_WinMatrix() public {
        ClassBuild[9] memory cls = _allClasses();
        Weapon[8] memory wpns = _allWeapons();

        console.log("============================================");
        console.log("  PVP WIN MATRIX (lower TTK wins)");
        console.log("  W=attacker wins, L=defender wins, D=draw");
        console.log("============================================");

        uint256[9] memory wins;
        uint256[9] memory losses;

        for (uint256 i = 0; i < 9; i++) {
            Weapon memory wi = wpns[_defaultWeapon(i)];
            string memory row = string.concat(cls[i].name, ": ");
            for (uint256 j = 0; j < 9; j++) {
                if (i == j) { row = string.concat(row, "- "); continue; }
                Weapon memory wj = wpns[_defaultWeapon(j)];
                (int256 djS, int256 djA, int256 djI) = _effectiveStats(cls[j], wj);
                (int256 diS, int256 diA, int256 diI) = _effectiveStats(cls[i], wi);
                CombatResult memory rAtk = _simulate(cls[i], wi, djS, djA, djI, cls[j].armor, cls[j].hp);
                CombatResult memory rDef = _simulate(cls[j], wj, diS, diA, diI, cls[i].armor, cls[i].hp);
                if (rAtk.turnsToKill < rDef.turnsToKill) {
                    row = string.concat(row, "W ");
                    wins[i]++;
                    losses[j]++;
                } else if (rAtk.turnsToKill > rDef.turnsToKill) {
                    row = string.concat(row, "L ");
                } else {
                    row = string.concat(row, "D ");
                }
            }
            console.log(row);
        }

        console.log("");
        console.log("Win/Loss tally:");
        for (uint256 i = 0; i < 9; i++) {
            console.log(string.concat(
                "  ", cls[i].name, ": ",
                vm.toString(wins[i]), "W / ", vm.toString(losses[i]), "L"
            ));
        }
    }

    // =====================================================================
    // TEST 3: Cross-weapon DPT - every class x every weapon vs neutral
    // THE KEY TEST: surfaces which weapons work for which classes
    // =====================================================================

    function test_CrossWeapon_DPT() public {
        ClassBuild[9] memory cls = _allClasses();
        Weapon[8] memory wpns = _allWeapons();

        // Neutral target: balanced stats
        int256 nS = 12; int256 nA = 12; int256 nI = 12;
        int256 nArm = 2; int256 nHp = 40;

        console.log("============================================");
        console.log("  CROSS-WEAPON DPT TABLE");
        console.log("  vs neutral target (12/12/12, 2arm, 40hp)");
        console.log("  DPT scaled x100. [M]=magic, [P]=physical");
        console.log("============================================");

        for (uint256 c = 0; c < 9; c++) {
            console.log(string.concat(
                "--- ", cls[c].name,
                " (base STR:", vm.toString(uint256(cls[c].baseStr)),
                " AGI:", vm.toString(uint256(cls[c].baseAgi)),
                " INT:", vm.toString(uint256(cls[c].baseInt)), ") ---"
            ));

            uint256 bestDPT;
            string memory bestName;

            for (uint256 w = 0; w < 8; w++) {
                CombatResult memory r = _simulate(cls[c], wpns[w], nS, nA, nI, nArm, nHp);

                string memory tag = wpns[w].isMagic ? " [M]" : " [P]";
                string memory flag = "";
                if (r.effectiveDPT > bestDPT) {
                    bestDPT = r.effectiveDPT;
                    bestName = wpns[w].name;
                }

                console.log(string.concat(
                    "  ", wpns[w].name, tag,
                    ": DPT=", vm.toString(r.effectiveDPT),
                    " hit=", vm.toString(r.hitPct),
                    "% ttk=", vm.toString(r.turnsToKill),
                    flag
                ));
            }
            console.log(string.concat("  >> BEST: ", bestName, " DPT=", vm.toString(bestDPT)));
            console.log("");
        }
    }

    // =====================================================================
    // TEST 4: Magic vs Physical comparison for dual-path classes
    // =====================================================================

    function test_MagicVsPhysical_Comparison() public {
        ClassBuild[9] memory cls = _allClasses();
        Weapon[8] memory wpns = _allWeapons();

        int256 nS = 12; int256 nA = 12; int256 nI = 12;
        int256 nArm = 2; int256 nHp = 40;

        console.log("============================================");
        console.log("  MAGIC vs PHYSICAL BEST WEAPON PER CLASS");
        console.log("  vs neutral target (12/12/12)");
        console.log("============================================");

        for (uint256 c = 0; c < 9; c++) {
            uint256 bestPhysDPT; string memory bestPhysName;
            uint256 bestMagicDPT; string memory bestMagicName;

            for (uint256 w = 0; w < 8; w++) {
                CombatResult memory r = _simulate(cls[c], wpns[w], nS, nA, nI, nArm, nHp);
                if (wpns[w].isMagic) {
                    if (r.effectiveDPT > bestMagicDPT) {
                        bestMagicDPT = r.effectiveDPT;
                        bestMagicName = wpns[w].name;
                    }
                } else {
                    if (r.effectiveDPT > bestPhysDPT) {
                        bestPhysDPT = r.effectiveDPT;
                        bestPhysName = wpns[w].name;
                    }
                }
            }

            string memory winner = bestPhysDPT > bestMagicDPT ? "PHYS" : "MAGIC";
            uint256 ratio = bestPhysDPT > 0
                ? bestMagicDPT * 100 / bestPhysDPT
                : 0;

            console.log(string.concat(
                "  ", cls[c].name,
                " | Phys: ", bestPhysName, "=", vm.toString(bestPhysDPT),
                " | Magic: ", bestMagicName, "=", vm.toString(bestMagicDPT),
                " | ", winner, " (ratio:", vm.toString(ratio), "%)"
            ));
        }
    }

    // =====================================================================
    // ASSERTION TESTS
    // =====================================================================

    // No class does 0 damage with default weapon vs any monster
    function test_assert_NoBuild_DoesZeroDamage() public {
        ClassBuild[9] memory cls = _allClasses();
        Weapon[8] memory wpns = _allWeapons();
        Monster[10] memory mons = _allMonsters();

        for (uint256 i = 0; i < 9; i++) {
            Weapon memory w = wpns[_defaultWeapon(i)];
            for (uint256 j = 0; j < 10; j++) {
                CombatResult memory r = _simulate(
                    cls[i], w,
                    mons[j].str, mons[j].agi, mons[j].int_,
                    mons[j].armor, mons[j].hp
                );
                assertGt(r.avgDmgPerHit, 0,
                    string.concat(cls[i].name, " does 0 dmg vs ", mons[j].name));
                assertGt(r.effectiveDPT, 0,
                    string.concat(cls[i].name, " has 0 DPT vs ", mons[j].name));
            }
        }
    }

    // No class one-shots Shadow Dragon
    function test_assert_NoOneShot_Boss() public {
        ClassBuild[9] memory cls = _allClasses();
        Weapon[8] memory wpns = _allWeapons();

        for (uint256 i = 0; i < 9; i++) {
            Weapon memory w = wpns[_defaultWeapon(i)];
            CombatResult memory r = _simulate(cls[i], w, 18, 18, 20, 3, 70);
            assertLt(r.avgDmgPerHit, int256(70),
                string.concat(cls[i].name, " one-shots Shadow Dragon"));
            assertGt(r.turnsToKill, uint256(3),
                string.concat(cls[i].name, " kills Shadow Dragon in 3 or fewer turns"));
        }
    }

    // PvP TTK in reasonable range
    function test_assert_PvP_TTK_Bounds() public {
        ClassBuild[9] memory cls = _allClasses();
        Weapon[8] memory wpns = _allWeapons();

        for (uint256 i = 0; i < 9; i++) {
            Weapon memory wi = wpns[_defaultWeapon(i)];
            for (uint256 j = 0; j < 9; j++) {
                Weapon memory wj = wpns[_defaultWeapon(j)];
                (int256 djS, int256 djA, int256 djI) = _effectiveStats(cls[j], wj);
                CombatResult memory r = _simulate(cls[i], wi, djS, djA, djI, cls[j].armor, cls[j].hp);
                assertGt(r.turnsToKill, uint256(1),
                    string.concat(cls[i].name, " one-shots ", cls[j].name));
                assertLt(r.turnsToKill, uint256(60),
                    string.concat(cls[i].name, " vs ", cls[j].name, " stalemate"));
            }
        }
    }

    // INT casters >= 50% of best physical DPT
    function test_assert_INT_DPS_Parity() public {
        ClassBuild[9] memory cls = _allClasses();
        Weapon[8] memory wpns = _allWeapons();

        int256 nS = 12; int256 nA = 12; int256 nI = 12;

        uint256[9] memory dpts;
        for (uint256 i = 0; i < 9; i++) {
            CombatResult memory r = _simulate(
                cls[i], wpns[_defaultWeapon(i)], nS, nA, nI, 2, 40
            );
            dpts[i] = r.effectiveDPT;
        }

        uint256 bestPhys = dpts[0] > dpts[2] ? dpts[0] : dpts[2];

        console.log("=== INT DPS PARITY (vs neutral) ===");
        for (uint256 i = 0; i < 9; i++) {
            console.log(string.concat(
                "  ", cls[i].name, " DPT(x100): ", vm.toString(dpts[i])
            ));
        }

        // INT casters: Warlock(5), Wizard(6), Cleric(7), Sorcerer(8)
        assertGt(dpts[5], bestPhys / 2, "Warlock DPT < 50% of best phys");
        assertGt(dpts[6], bestPhys / 2, "Wizard DPT < 50% of best phys");
        assertGt(dpts[7], bestPhys / 2, "Cleric DPT < 50% of best phys");
        assertGt(dpts[8], bestPhys / 2, "Sorcerer DPT < 50% of best phys");
    }

    // Combat triangle gives measurable advantage
    function test_assert_CombatTriangle_Advantage() public {
        ClassBuild[9] memory cls = _allClasses();
        Weapon[8] memory wpns = _allWeapons();

        // Warrior(STR) vs Ranger(AGI) - advantage
        Weapon memory ww = wpns[0];
        (int256 rS, int256 rA, int256 rI) = _effectiveStats(cls[2], wpns[2]);
        CombatResult memory warVsRan = _simulate(cls[0], ww, rS, rA, rI, cls[2].armor, cls[2].hp);

        // Warrior(STR) vs Paladin(STR) - neutral
        (int256 pS, int256 pA, int256 pI) = _effectiveStats(cls[1], wpns[1]);
        CombatResult memory warVsPal = _simulate(cls[0], ww, pS, pA, pI, cls[1].armor, cls[1].hp);

        assertGt(uint256(warVsRan.avgDmgPerHit), uint256(warVsPal.avgDmgPerHit),
            "Combat triangle gave no damage advantage");

        // Ranger(AGI) vs Wizard(INT) - advantage
        Weapon memory wr = wpns[2];
        (int256 wS, int256 wA, int256 wI) = _effectiveStats(cls[6], wpns[6]);
        CombatResult memory ranVsWiz = _simulate(cls[2], wr, wS, wA, wI, cls[6].armor, cls[6].hp);
        assertGt(ranVsWiz.avgDmgPerHit, int256(0), "Ranger does 0 vs Wizard");

        // Wizard(INT) vs Warrior(STR) - advantage
        Weapon memory wz = wpns[6];
        (int256 waS, int256 waA, int256 waI) = _effectiveStats(cls[0], wpns[0]);
        CombatResult memory wizVsWar = _simulate(cls[6], wz, waS, waA, waI, cls[0].armor, cls[0].hp);
        assertGt(wizVsWar.avgDmgPerHit, int256(0), "Wizard does 0 vs Warrior");
    }

    // Every class can deal damage and has >10% hit in PvP
    function test_assert_PvP_EveryClassHasAChance() public {
        ClassBuild[9] memory cls = _allClasses();
        Weapon[8] memory wpns = _allWeapons();

        for (uint256 i = 0; i < 9; i++) {
            Weapon memory wi = wpns[_defaultWeapon(i)];
            for (uint256 j = 0; j < 9; j++) {
                if (i == j) continue;
                Weapon memory wj = wpns[_defaultWeapon(j)];
                (int256 djS, int256 djA, int256 djI) = _effectiveStats(cls[j], wj);
                CombatResult memory r = _simulate(cls[i], wi, djS, djA, djI, cls[j].armor, cls[j].hp);
                assertGt(r.avgDmgPerHit, int256(0),
                    string.concat(cls[i].name, " does 0 damage to ", cls[j].name));
                assertGt(r.hitPct, uint256(10),
                    string.concat(cls[i].name, " has <10% hit vs ", cls[j].name));
            }
        }
    }

    // All classes solo Cave Rat in <= 5 turns
    function test_assert_AllClasses_CanSolo_CaveRat() public {
        ClassBuild[9] memory cls = _allClasses();
        Weapon[8] memory wpns = _allWeapons();

        for (uint256 i = 0; i < 9; i++) {
            CombatResult memory r = _simulate(
                cls[i], wpns[_defaultWeapon(i)], 4, 7, 3, 0, 12
            );
            assertLe(r.turnsToKill, uint256(5),
                string.concat(cls[i].name, " can't kill Cave Rat in 5 turns"));
        }
    }

    // Weakest build >= 25% of strongest (default weapons vs neutral)
    function test_assert_Hybrid_Builds_Viable() public {
        ClassBuild[9] memory cls = _allClasses();
        Weapon[8] memory wpns = _allWeapons();

        uint256[9] memory dpts;
        uint256 minDPT = type(uint256).max;
        uint256 maxDPT;

        for (uint256 i = 0; i < 9; i++) {
            CombatResult memory r = _simulate(
                cls[i], wpns[_defaultWeapon(i)], 12, 12, 12, 2, 40
            );
            dpts[i] = r.effectiveDPT;
            if (dpts[i] < minDPT) minDPT = dpts[i];
            if (dpts[i] > maxDPT) maxDPT = dpts[i];
        }

        console.log("=== BUILD VIABILITY (vs neutral) ===");
        for (uint256 i = 0; i < 9; i++) {
            console.log(string.concat(
                "  ", cls[i].name, " DPT: ", vm.toString(dpts[i]),
                " (", vm.toString(dpts[i] * 100 / maxDPT), "% of best)"
            ));
        }

        assertGt(minDPT, maxDPT * 25 / 100, "Weakest build < 25% of strongest");
    }

    // Every class x every weapon deals > 0 DPT vs neutral
    function test_assert_CrossWeapon_Minimum_Viability() public {
        ClassBuild[9] memory cls = _allClasses();
        Weapon[8] memory wpns = _allWeapons();

        for (uint256 c = 0; c < 9; c++) {
            for (uint256 w = 0; w < 8; w++) {
                CombatResult memory r = _simulate(
                    cls[c], wpns[w], 12, 12, 12, 2, 40
                );
                assertGt(r.avgDmgPerHit, int256(0),
                    string.concat(cls[c].name, " does 0 dmg with ", wpns[w].name));
            }
        }
    }
}
