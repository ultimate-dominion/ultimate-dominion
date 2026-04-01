# Balance Goals

The design goals that every balance sim validates against. Numerical targets in COMBAT_BALANCE.md and test assertions in CombatBalance.t.sol derive from these goals. When running a sim, this is the document that tells you what you're checking and why.

---

## The Core Principle: Every Decision Must Be a Meaningful Tradeoff

This is the single most important design goal. If there's a "correct" answer to any decision a player faces, the system has failed. Every choice — stat allocation, loadout, engagement — should have a real cost and a real payoff.

**Loadout tradeoffs (4 equipment slots):**
- 1 weapon + 2 spells + 1 potion? (versatile caster)
- 2 weapons + 1 spell + 1 health potion? (sustained fighter)
- Equip the flee item because you don't want to PvP? (safety at the cost of a combat slot)
- All-in damage with no healing? (glass cannon — you better win fast)

Each slot you commit to one thing is a slot you can't use for another. The loadout decision should change based on where you're going, who you might fight, and what you're afraid of.

**Build tradeoffs:**
- Tank builds that always draw in PvP — but there must be builds that can outfight even the tankiest builds
- Glass cannons that dominate squishies but fold to sustained pressure
- Hybrid builds that sacrifice peak performance for flexibility
- No build should be safe everywhere. No build should be hopeless anywhere.

**Stat allocation tradeoffs:**
- Every level-up: "do I pump primary for raw power, or invest off-path to unlock a new weapon/spell?"
- Pure builds are cheap and strong in their niche. Hybrid builds are expensive and strong across niches.
- The player who invested 3 points into AGI as a Warrior should FEEL that in their combat options — not just see a slightly different number

**If a player never agonizes over a decision, we haven't given them enough interesting options.**

### Balance is a direction, not a destination

This is an infinite game. Level cap keeps rising. New zones, items, spells, and mechanics will keep shifting the meta. Perfect 50/50 balance at current max level with max gear is not the goal — and chasing it is a trap that kills development velocity.

What matters:
- **Every build can compete.** Not "every build wins exactly 50%." A 40/60 matchup is fine if the 40% side can close the gap with better decisions, better loadout, or better timing.
- **Smart decisions are rewarded.** The player who reads the matchup, picks the right consumables, and plays the fight well should beat the player who doesn't — regardless of class.
- **Imbalance is content.** When one build is slightly strong, players talk about it, theorycraft counters, and the meta evolves. When everything is perfectly flat, there's nothing to discover.
- **We're at level 20.** The balance picture at L20 with Dark Cave gear will look completely different at L40 with Windy Peaks gear. Don't over-tune for a snapshot that will shift.

The sim validates floors and ceilings (no build below 30%, no build above 75% win rate), not perfect parity. Spend time making content, not chasing the last 5% of balance precision.

---

## 1. No build is excluded from enjoying the game

Every class/race/stat-path combination must be able to progress through PvE content solo. A player who picks Cleric and dumps INT should not hit a wall where they can't kill anything. "Weaker" is fine. "Broken" is not.

**Numerical targets:**
- No build below 30% PvE win rate at any level with best available gear
- Every build can solo the zone boss with 2x Health Potion (30-60% win rate)
- Every build kills the weakest zone mob in <= 5 turns
- All classes deal > 0 damage to all monsters (minimum 1 damage floor)

**Test assertions:** `test_assert_NoBuild_DoesZeroDamage`, `test_assert_AllClasses_CanSolo_CaveRat`, `test_assert_Hybrid_Builds_Viable`

---

## 2. Every class can level up solo

PvE is the progression engine. If it's punishing, players leave. A player with no friends online should still be able to grind, level up, and feel like they're getting somewhere. This means survivability matters — fights can't be so swingy that you die to equal-level mobs regularly.

**Numerical targets:**
- Player defeats 3-5 equal-level mobs before needing heal
- Player defeats 2-3 mobs at +1 level
- Player defeats 1-2 mobs at +2 level
- No dead zones: every build has a meaningful gear upgrade every 2-3 levels

**Test assertions:** PvE damage table (visual inspection), per-build TTK bounds

---

## 3. Every class has a weakness in PvP

Rock-paper-scissors, not rock-rock-rock. If one build dominates all matchups, PvP is solved and boring. The combat triangle (STR > AGI > INT > STR) should mean that every build has matchups it fears. Even the strongest build should lose to something.

**Numerical targets:**
- No class wins > 6/8 PvP matchups (must lose at least 2)
- No class loses > 6/8 PvP matchups (must win at least 2)
- PvP TTK in 2-59 turns (no one-shots, no stalemates within the sim)
- Every class has > 10% hit chance against every other class
- Combat triangle gives measurable damage advantage in favored matchups

**Test assertions:** `test_PvP_WinMatrix`, `test_assert_PvP_TTK_Bounds`, `test_assert_PvP_EveryClassHasAChance`, `test_assert_CombatTriangle_Advantage`

---

## 4. Hybrid builds and unique items drive the economy

The Hearthstone model: basics are free, interesting builds cost money. Pure-path builds (full STR Warrior, full AGI Rogue) are the F2P floor — cheap, farmable, functional. Hybrid builds enabled by cross-stat weapons are the marketplace drivers — the fun builds, the ones people theorycraft about and share on Discord.

Every zone must have hybrid-specific items that enable builds you can't do with pure-path gear. These are the items that make players say "I need to respec" or "I need to buy that on the marketplace." They're the engine of the economy.

**The same principle applies to spells.** Spell loadout is a tradeoff decision — bringing a debuff spell means not bringing a heal. Spells that synergize with specific hybrid stat distributions create build identity beyond just "I'm a Warrior."

**Numerical targets:**
- R3+ items: each stat path has 2+ viable weapons with different effects/tradeoffs
- R4 epics: achievable with <= 4 off-path stat points for at least some builds
- Every zone must include hybrid-stat weapons that reward cross-path investment
- Hybrid builds should feel rewarding enough to justify the gear cost and respec gold
- Every class x every on-path weapon combo deals > 0 DPT (no dead weapon slots in the marketplace)

**Test assertions:** `test_CrossWeapon_DPT` (visual), `test_assert_CrossWeapon_Minimum_Viability`

---

## 5. Progression has no dead zones — common drops matter at every level

A player at level 18 with a level 12 green weapon shouldn't feel stuck waiting for a specific rare drop. Frequent drops (common/uncommon) should always have a chance of being a slight upgrade, even if the rare is the real prize.

This means **overlapping item power bands**: a level 18 common can be a slight upgrade over a level 12 uncommon. The common isn't junk — it's a stepping stone. The rare is aspirational, not mandatory.

**Why this matters for the economy:**
- Lower rare drop rates become acceptable because players aren't suffering between upgrades
- More items in circulation = more marketplace activity
- Players sell their "slight upgrade" commons when they finally get the rare — creates a healthy low-end market
- Reduces the "nothing good ever drops" feeling that kills retention

**Design targets:**
- At any level, a player should have a >5% chance per fight of finding something equippable that's an upgrade (even if marginal)
- Item power bands overlap by 2-3 levels across rarity tiers (e.g., R1 at level 16-18 overlaps R2 at level 12-14)
- No level gap > 3 where a build's best available weapon doesn't change
- Hybrid versions of common/uncommon weapons exist (not just rares/epics) — a STR/INT common sword at level 16 for the Paladin who's been waiting

---

## 6. The three stat paths feel mechanically distinct

STR, AGI, and INT shouldn't just be "damage with different numbers." Each path should have a different combat feel — how you deal damage, how you survive, what decisions you make in combat.

**Design intent:**
- **STR**: High per-hit damage, block defense, armor. Hits hard, tanks hits. Straightforward.
- **AGI**: Evasion, double strike, crit bonus. Dodge-and-burst. Higher variance, higher skill ceiling.
- **INT**: Magic damage (bypasses armor), magic resist. Consistent damage vs armored targets, vulnerable to burst.

**Numerical targets:**
- STR weapons deal more damage per hit than AGI weapons (ATTACK_MODIFIER > AGI_ATTACK_MODIFIER). AGI compensates with evasion + double strike + crit.
- INT casters >= 50% of best physical DPT (magic bypasses armor, so raw DPT can be lower)
- Weakest build >= 25% of strongest build's DPT (no path is unplayable)

**Test assertions:** `test_assert_INT_DPS_Parity`, `test_assert_Hybrid_Builds_Viable`, `test_MagicVsPhysical_Comparison`

---

## 7. PvP zones are risky, not suicidal — anti-grief by design

This is a crypto game with real stakes. PvP zones have quests worth doing, but players who enter them must have tools to survive encounters they didn't choose. The Darkfall lesson: full-loot forced PvP with no escape kills retention (1M players to 500). Our design: safe PvE areas + PvP zones with escape tools + tank builds that force draws.

**Design targets:**
- A player with a "survival loadout" (flee item + HP pots + defensive spell) can enter a PvP zone, complete a quest mob, survive 1 ambush, and leave alive >70% of the time
- Flee items (Smoke Bomb, Flashpowder) allow escape without gold penalty — but cost a loadout slot (tradeoff)
- Tank/draw builds exist and work — a STR tank can survive 15 turns against a ganker >60% of the time
- Counter-builds exist that can break through tanks — no stalemate meta
- Ganking has a cost: the attacker wastes time and consumables on failed ganks. Griefing is not free.
- PvP zone questing feels like a risk-reward tradeoff: not suicidal (>50% survival rate) but not trivial (real gold cost in consumables/flee items)

**Sim scenarios:** "Quest Runner" loadout, "Tank Runner" loadout, "Deterrent" loadout vs optimized PvP ganker

---

## 8. Bosses must feel difficult — consumables are the answer

Zone bosses (Basilisk, Warden, future bosses) and elite content must be hard enough that players NEED buffs, health potions, debuffs, and the right loadout to win reliably. If a player can walk into a boss fight naked and win 90%+ of the time, consumables become vendor trash and the economy dies.

This is the design rule that makes everything else work: items drive the economy (Goal 4), consumables create recurring demand (Goal 8b), and the loadout decision matters (Core Principle) — but ONLY if the content is hard enough to require preparation.

**Design targets:**
- Zone boss (Basilisk, Warden): 30-60% win rate with best loadout, < 20% with weapon-only
- Equal-level mobs: 60-85% win rate with loadout, consumables should swing by 10-20%
- +2 level mobs: 30-50% win rate, consumables should swing by 20-30%
- A player who brings Fortifying Stew + Greater Health Potion to a boss should FEEL the difference
- Bare weapon vs full loadout must have a measurable gap — if there's no gap, the boss is too easy

**Sim validation:** `--loadouts` compares bare weapon vs best boss loadout. `--slotvalue` measures individual item impact against hard content.

---

## 8b. Items drive the economy at every level, not just endgame

The economy lives or dies on whether items feel worth having. This applies at EVERY stage:

- **Early game**: A level 5 player buying Fortifying Stew before a hard fight. Common weapon drops that are slight upgrades over starters.
- **Mid game**: Uncommon weapons with interesting effects. Consumable buffs for zone boss attempts. Selling drops you've outgrown.
- **Endgame**: Max-level players farming consumables for gold. Rare/epic weapons that enable new builds. Respec gold sink when new zones shift optimal stat distributions.

Consumables are especially important — they're the recurring demand that keeps the economy liquid. If consumables don't matter in combat (health pots, buffs, debuffs, flee items), there's no reason to trade them. Combat balance must ensure consumables are the difference between winning and losing in hard content, not a nice-to-have.

**Design targets:**
- Consumables should swing PvE win rate by 20-30% in hard content (boss fights, +2 level mobs)
- At any level, there should be items worth buying from other players on the marketplace
- Drop rates tuned so players are both sellers (of things they don't need) and buyers (of things they do)
- Gold sinks (repair, respec, consumables) must feel worth the cost, not punitive

---

## 9. Balance changes don't break the game economy

Combat speed affects gold flow. If a balance change lets players kill mobs 2x faster, that doubles the gold faucet. Always check the economic ripple of combat tuning.

**Numerical targets:**
- Kill speed changes < 20% from any single balance change
- No single class gains > 30% DPT advantage over the next closest (prevents "everyone rerolls X")
- Death rate stays meaningful (5% escrow penalty must hurt enough to make flee/pot decisions real)

---

## 10. Onchain values match sim values

The sim is only useful if it reflects what's actually deployed. Constants drift between sim files, test files, and constants.sol has caused bugs before.

**Validation:**
- After any balance constant change, ALL files referencing that constant must be updated
- `verify-onchain.ts` must pass after every deploy
- `CombatBalance.t.sol` weapon/monster stats must match `items.json` / deploy scripts

---

## How to use this document

1. **Before a balance change**: Read the core principle and goals 1-8. Which goals does this change affect? Does it create or destroy meaningful tradeoffs?
2. **Running the sim**: Map each assertion failure to its goal above. A failing test is a violated goal — understand which one before deciding whether to change the number or change the test.
3. **After the sim**: Write a one-paragraph summary: "Goals X, Y pass. Goal Z is marginal because [reason]. Decision: [ship/retune/revisit]."
4. **Archiving results**: Save sim output + this summary to `docs/combat-stats/sim-runs/YYYY-MM-DD_[change].md`.

---

*Last updated: March 2026*
