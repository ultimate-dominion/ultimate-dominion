# Text-First UI

Ultimate Dominion's game client does not require content artwork. Items, monsters, characters, classes, fragments, quests, maps, and progression screens are identified from their names, types, stats, rarity, and state.

## Rules

- Do not add gameplay images, portraits, sprites, 3D models, image manifests, or per-entity asset registries.
- New content must render from semantic data already available to the client.
- Use short text marks for fast scanning: `STR`, `AGI`, `INT`, `WPN`, `ARM`, `SPL`, `FOE`, player initials, and fragment numerals.
- Preserve rarity colors, typography, spacing, borders, HP bars, motion, sound, and clear state labels. These carry the hierarchy and feedback that artwork used to provide.
- Content metadata may include a text-only URI for compatibility, but the client must not depend on an `image` field.
- The favicon and the single generic Open Graph card are brand infrastructure, not gameplay content. Do not create per-content share cards.

## Adding Content

1. Add the on-chain/data definition: name, description, type, stats, rarity, requirements, and relationships.
2. Verify the new entity renders in lists, details, combat, rewards, and mobile layouts without a name-specific client mapping.
3. Verify unknown or future content receives a sensible generic text mark.
4. Run the text-first invariant test, client tests, and client build.
5. Validate the normal gameplay flow on beta.

If adding an item or monster requires editing a visual registry, the UI has regressed.
