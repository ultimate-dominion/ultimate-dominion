#!/bin/bash
# ==========================================================================
# Z2 Windy Peaks — Batch creature forge
#
# Meshy 800-char prompt limit: descriptions must be <420 chars.
# Archetype hints removed (blow budget). Key learnings baked into descriptions:
#   - Weapons "fused to forearm" for animation motion
#   - Specific anatomical details for distinct silhouettes
#   - attack: 19 (light) or 99 (heavy), hit: 100 (knockback)
# ==========================================================================

set -euo pipefail
cd "$(dirname "$0")"

set -a; source .env; set +a

echo "=== Z2 Windy Peaks — Batch Forge ==="
echo "  MESHY_API_KEY: ${MESHY_API_KEY:0:10}..."
echo ""

SUCCEEDED=""
FAILED=""

run_forge() {
  local name="$1" desc="$2" weapon="$3"
  echo ""
  echo "━━━ FORGING: $name (weapon: $weapon) ━━━"
  if node creature-forge.mjs "$name" "$desc" \
    --type humanoid --weapon "$weapon" --iterations 2; then
    SUCCEEDED="$SUCCEEDED $name,"
  else
    echo "  FAILED: $name"
    FAILED="$FAILED $name,"
  fi
}

# ── Harpy ─────────────────────────────────────────────────────────────────
# Silhouette: wing-cape, oversized talons, gaunt predator
run_forge "Harpy" \
  "winged humanoid predator, large ragged feathered wings as arm-cape, oversized razor-sharp bird talons for feet, wild matted hair, shrieking face with sharp predatory eyes and pointed teeth, grey-brown mottled feathers on torso, gaunt ribcage visible, long clawed fingers, mountain ambush creature" \
  "unarmed"

# ── Ogre ──────────────────────────────────────────────────────────────────
# Silhouette: massive body, tiny head, club fused to arm
run_forge "Ogre" \
  "massive 9-foot hunched brute, enormous gut and barrel chest, tiny flat head with beady eyes and jutting jaw with broken tusks, warty olive-green skin, huge spiked wooden club fused to right forearm extending from wrist, crude animal hide loincloth, enormously thick arms, patches of coarse body hair, battle-scarred" \
  "mace"

# ── Orc ───────────────────────────────────────────────────────────────────
# Silhouette: armored warrior, axe fused to arm, broad shoulders
run_forge "Orc" \
  "muscular green-skinned orc warrior, heavy brow ridge, sharp lower tusks, battle scars across face and chest, iron battle axe blade fused to right forearm extending from wrist, patched leather and rusted chain armor, thick boots, broad powerful shoulders, war paint on face, aggressive fighting stance" \
  "axe"

# ── Orc Shaman ────────────────────────────────────────────────────────────
# Silhouette: hunched elder, tall skull staff, fetishes dangling
run_forge "Orc Shaman" \
  "hunched elderly orc in ragged dark robes, gnarled wooden staff topped with bleached skull held in both hands — staff taller than creature, glowing green eyes under deep hood, bone trinkets and shrunken heads on belt, tribal white ash face paint, one hand raised channeling dark energy, bare gnarled feet" \
  "staff"

# ── Troll ─────────────────────────────────────────────────────────────────
# Silhouette: tall thin frame, impossibly long arms past knees
run_forge "Troll" \
  "towering lanky humanoid, grotesquely long arms reaching past knees, rubbery grey-green skin with regenerating flesh patches, hunched forward posture, hooked nose, sunken bloodshot eyes, jagged yellowed teeth, massive clawed hands with elongated fingers, knobby spine visible, moss growing on shoulders" \
  "unarmed"

# ── Griffon ───────────────────────────────────────────────────────────────
# Silhouette: eagle head, wings, powerful body — attempting bipedal pose
# May fail rigging → canvas backup
run_forge "Griffon" \
  "eagle-headed beast in semi-upright bipedal pose, large golden-brown feathered wings folded against back, sharp curved beak and fierce golden raptor eyes, front limbs are eagle talons with massive curved claws, muscular lion-like hind legs, long tufted tail, dark feathers on head and wings, tawny fur on body, battle scars on chest" \
  "unarmed"

# ── Korrath's Warden (Zone Boss) ─────────────────────────────────────────
# Silhouette: towering armored sentinel, horned helm, massive halberd
run_forge "Korraths Warden" \
  "colossal armored sentinel over 10 feet tall, ancient stone-plated armor with cracks revealing amber glow within, towering horned great helm with narrow visor showing burning eyes, massive war halberd fused to right forearm — weapon half the creature's height, enormous pauldrons and stone gauntlets, tattered war banner on shoulder, rune carvings on chest, wind-eroded battle damage" \
  "hammer"

# ── Summary ───────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  BATCH COMPLETE"
echo "  Succeeded:$SUCCEEDED"
[ -n "$FAILED" ] && echo "  Failed:$FAILED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
