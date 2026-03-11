# Art System Design

The visual identity of Ultimate Dominion. Every item, monster, and fragment follows this system.

## Core Style

**White ink illustration on pure black background.** Rough, expressive brushstrokes with a hand-drawn feel. Not photorealistic, not 3D-rendered. Raw and unpolished — visible brush texture, glowing white edges bleeding into black. Dark fantasy medieval aesthetic.

This style was established by the original artist and all generated art must match it.

## Visual Hierarchy by Rarity

Color and complexity scale with rarity. The rarity system is the primary tool for visual differentiation at scale.

### Rarity 0–1: Common / Worn
- **Monochrome.** White ink on black, minimal to no color accent.
- Simple silhouettes — short guards, plain blades, basic shapes.
- These are disposable gear and *should* feel similar. Quantity over distinction.

### Rarity 2: Uncommon
- **Single muted color accent** at ~30% saturation.
- Steel-grey metallic, warm amber, muted blue — enough to categorize (melee vs magic vs ranged) at a glance.
- Slightly more detail in linework than common items.

### Rarity 3: Rare
- **Single color accent at ~60% saturation.** The accent becomes a feature, not a hint.
- A rare fire sword has visible orange glow along the blade edge. A rare robe has deep purple that's unmistakable.
- Ornate details — visible runes, wider blades, decorative crossguards.

### Rarity 4: Epic
- **Dual-color accents.** A second color enters — gold + blue, red + purple.
- Exaggerated silhouettes — more ornate, more detail, larger flourishes.
- These should look *busy* compared to commons.
- Items at this tier break conventions slightly — floating elements, energy wisps.

### Rarity 5+: Legendary
- **Full color treatment.** Break the monochrome rule entirely.
- When a player sees full color in a sea of white ink, they immediately know.
- Energy effects that break the silhouette boundary (glow, particles, aura).
- The UI's rarity border glow reinforces this visually.

## Silhouette Language

Color alone isn't enough at small sizes (32–44px in loadout slots). Silhouette must communicate tier:

- **Low tier (1–3):** Simple blade shapes, short guards, thin staffs, plain bows
- **Mid tier (4–6):** Wider blades, ornate crossguards, visible runes, thicker staffs with orbs
- **High tier (7+):** Exaggerated proportions, floating elements, energy effects breaking the boundary

A "Worn Greataxe" and "Godslayer" don't just differ in detail — the Godslayer has a fundamentally different visual weight.

## Color Accent Map

### Weapons
| Subtype | Accent Color |
|---------|-------------|
| Melee (swords, axes, maces) | Warm steel-grey metallic |
| Ranged (bows, crossbows) | Amber-gold wood and string tones |
| Magic (staffs, wands, rods) | Blue-violet arcane glow |
| Scepters | Deep purple energy |

### Armor
| Subtype | Accent Color |
|---------|-------------|
| Cloth / basic | Faint blue-grey |
| Leather | Warm brown-amber |
| Chainmail | Cool steel-blue |
| Plate | Bright steel-white with gold trim |
| Robes / magic | Deep blue or purple mystical glow |

### Consumables
| Subtype | Accent Color |
|---------|-------------|
| Health potions | Deep red liquid glow |
| Food / drink | Warm amber-orange |
| Poisons / debuffs | Sickly green |
| Buffs / tonics | Golden shimmer |
| Junk / materials | Muted earth tones |

### Spells
| Element | Accent Color |
|---------|-------------|
| Fire | Bright orange-red |
| Ice | Cold blue-white |
| Lightning | Electric blue-white |
| Arcane | Deep purple |
| Heal / divine | Warm golden-white |
| Dark / necrotic | Purple-black with violet edges |
| Nature | Muted green |

### Zones
| Zone | Override |
|------|---------|
| Bug Pit | Neon green terminal-glow accents (replaces category color) |

## Scaling to Thousands of Items

When the item count exceeds ~500, additional systems are needed:

### 1. Category Type Icons
Small badge/overlay in the UI corner (sword icon, staff icon, bow icon) that's always consistent regardless of art. Solves recognition at 32px where art details are lost.

### 2. Procedural Variation
Don't hand-generate thousands of unique images. Generate base templates per weapon archetype (sword, axe, staff, bow) at each rarity tier, then apply color shifts programmatically.

**50 base templates × 10 color palettes = 500 unique-looking items.**

### 3. Template Categories Needed
- Swords (short, long, great, curved)
- Axes (hand, battle, great)
- Maces / hammers (light, heavy)
- Daggers
- Staffs (simple, orbed, crystal-tipped)
- Wands / rods
- Bows (short, long, recurve, crossbow)
- Cloth armor (rags, robes, vestments, regalia)
- Leather armor (vest, jerkin, studded, full)
- Chain armor (shirt, half, full)
- Plate armor (partial, half, full, ornate)
- Potions (small, medium, large)
- Food items
- Spell effects (projectile, aura, beam, area)
- Monsters (beast, humanoid, undead, elemental, dragon)
- Fragments (scroll, tablet, crystal)

## Generation Pipeline

Art is generated using `scripts/generate-art/`:
- **Model:** Flux 2 Pro via Replicate API
- **Style consistency:** Reference images from existing artist work passed with each generation
- **Prompt structure:** Item description + base style + rarity visual rules + color accent + silhouette guidance
- **Cost:** ~$0.05 per image

See `scripts/generate-art/README.md` for usage instructions.

## Artist Handoff

This system is designed as a bridge until the artist completes work. When replacing AI art with artist originals:
1. Artist should follow the same rarity visual hierarchy
2. Color accent map can be used as a reference palette
3. Silhouette language rules apply regardless of who creates the art
4. AI-generated art can serve as reference/concept art for the artist
