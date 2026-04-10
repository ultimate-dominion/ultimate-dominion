/**
 * Maps item names to their bundled image paths.
 * Images are in /public/images/items/ as optimized WebP files.
 */
const ITEM_IMAGES: Record<string, string> = {
  // --- Weapons ---
  // r0
  'Broken Sword': '/images/items/broken-sword.webp',
  'Worn Shortbow': '/images/items/worn-shortbow.webp',
  'Cracked Wand': '/images/items/cracked-wand.webp',
  // r1
  'Iron Axe': '/images/items/iron-axe.webp',
  'Hunting Bow': '/images/items/hunting-bow.webp',
  'Apprentice Staff': '/images/items/apprentice-staff.webp',
  'Light Mace': '/images/items/light-mace.webp',
  'Shortbow': '/images/items/shortbow.webp',
  'Channeling Rod': '/images/items/channeling-rod.webp',
  'Notched Blade': '/images/items/notched-blade.webp',
  // r2
  'Warhammer': '/images/items/warhammer.webp',
  'Longbow': '/images/items/longbow.webp',
  'Mage Staff': '/images/items/mage-staff.webp',
  'Sporecap Wand': '/images/items/sporecap-wand.webp',
  'Notched Cleaver': '/images/items/notched-cleaver.webp',
  'Webspinner Bow': '/images/items/webspinner-bow.webp',
  'Crystal Shard': '/images/items/crystal-shard.webp',
  // r3
  'Dire Rat Fang': '/images/items/dire-rat-fang.webp',
  'Bone Staff': '/images/items/bone-staff.webp',
  'Darkwood Bow': '/images/items/darkwood-bow.webp',
  'Smoldering Rod': '/images/items/smoldering-rod.webp',
  'Stone Maul': '/images/items/stone-maul.webp',
  'Gnarled Cudgel': '/images/items/gnarled-cudgel.webp',
  // r4
  'Trollhide Cleaver': '/images/items/trollhide-cleaver.webp',
  'Phasefang': '/images/items/phasefang.webp',
  'Drakescale Staff': '/images/items/drakescale-staff.webp',

  // --- Armor ---
  // r0
  'Tattered Cloth': '/images/items/tattered-cloth.webp',
  'Worn Leather Vest': '/images/items/worn-leather-vest.webp',
  'Rusty Chainmail': '/images/items/rusty-chainmail.webp',
  // r1
  'Padded Armor': '/images/items/padded-armor.webp',
  'Leather Jerkin': '/images/items/leather-jerkin.webp',
  'Apprentice Robes': '/images/items/apprentice-robes.webp',
  'Studded Leather': '/images/items/studded-leather.webp',
  'Scout Armor': '/images/items/scout-armor.webp',
  'Acolyte Vestments': '/images/items/acolyte-vestments.webp',
  // r2
  'Etched Chainmail': '/images/items/etched-chainmail.webp',
  'Ranger Leathers': '/images/items/ranger-leathers.webp',
  'Mage Robes': '/images/items/mage-robes.webp',
  'Spider Silk Wraps': '/images/items/spider-silk-wraps.webp',
  // r3
  'Carved Stone Plate': '/images/items/carved-stone-plate.webp',
  "Stalker's Cloak": '/images/items/stalkers-vest.webp',
  'Scorched Scale Vest': '/images/items/scorched-scale-vest.webp',
  "Drake's Cowl": '/images/items/drakes-cowl.webp',

  // --- Consumables ---
  // Trophy drops (r0)
  'Rat Tooth': '/images/items/rat-tooth.webp',
  'Cave Moss': '/images/items/cave-moss.webp',
  'Cracked Bone': '/images/items/cracked-bone.webp',
  'Dull Crystal': '/images/items/dull-crystal.webp',
  'Tattered Hide': '/images/items/tattered-hide.webp',
  'Bent Nail': '/images/items/bent-nail.webp',
  // Potions & buffs (r1)
  'Minor Health Potion': '/images/items/minor-health-potion.webp',
  'Health Potion': '/images/items/health-potion.webp',
  'Greater Health Potion': '/images/items/greater-health-potion.webp',
  'Fortifying Stew': '/images/items/fortifying-stew.webp',
  'Quickening Berries': '/images/items/quickening-berries.webp',
  'Focusing Tea': '/images/items/focusing-tea.webp',
  'Bloodrage Tonic': '/images/items/bloodrage-tonic.webp',
  'Stoneskin Salve': '/images/items/stoneskin-salve.webp',
  'Trollblood Ale': '/images/items/trollblood-ale.webp',
  'Venom Vial': '/images/items/venom-vial.webp',
  'Spore Cloud': '/images/items/spore-cloud.webp',
  'Sapping Poison': '/images/items/sapping-poison.webp',
  'Antidote': '/images/items/antidote.webp',
  // r2
  'Flashpowder': '/images/items/flashpowder.webp',

  // --- Spells (L10) ---
  'Battle Cry': '/images/spells/battle-cry.webp',
  'Divine Shield': '/images/spells/divine-shield.webp',
  'Marked Shot': '/images/spells/marked-shot.webp',
  'Soul Drain': '/images/spells/soul-drain.webp',
  'Arcane Blast': '/images/spells/arcane-blast.webp',
  'Arcane Infusion': '/images/spells/arcane-infusion.webp',
  'Expose Weakness': '/images/spells/expose-weakness.webp',
  'Entangle': '/images/spells/entangle.webp',
  'Blessing': '/images/spells/blessing.webp',

  // --- Spells (L15) ---
  'Warcry': '/images/spells/warcry.webp',
  'Judgment': '/images/spells/judgment.webp',
  'Volley': '/images/spells/volley.webp',
  'Backstab': '/images/spells/backstab.webp',
  'Regrowth': '/images/spells/regrowth.webp',
  'Blight': '/images/spells/blight.webp',
  'Meteor': '/images/spells/meteor.webp',
  'Mana Burn': '/images/spells/mana-burn.webp',
  'Smite': '/images/spells/smite.webp',

  // --- Monster weapons ---
  'Razor Claws': '/images/monster-weapons/razor-claws.webp',
  'Elemental Burst': '/images/monster-weapons/elemental-burst.webp',
  'Venomous Bite': '/images/monster-weapons/venomous-bite.webp',
  'Crushing Slam': '/images/monster-weapons/crushing-slam.webp',
  'Dark Magic': '/images/monster-weapons/dark-magic.webp',
  'Stone Fist': '/images/monster-weapons/stone-fist.webp',
  'Shadow Strike': '/images/monster-weapons/shadow-strike.webp',
  'Basilisk Fangs': '/images/monster-weapons/basilisk-fangs.webp',
  'Petrifying Gaze': '/images/monster-weapons/petrifying-gaze.webp',

  // ==========================================
  // Windy Peaks (Zone 2)
  // ==========================================

  // --- Z2 Armor ---
  'Peakstone Mail': '/images/items/peakstone-mail.webp',
  'Ridgeforged Plate': '/images/items/ridgeforged-plate.webp',
  'Windsworn Plate': '/images/items/windsworn-plate.webp',
  "Warden's Bulwark": '/images/items/wardens-bulwark.webp',
  'Mountain Hide': '/images/items/mountain-hide.webp',
  'Galebound Leather': '/images/items/galebound-leather.webp',
  'Stormhide Vest': '/images/items/stormhide-vest.webp',
  'Phantom Shroud': '/images/items/phantom-shroud.webp',
  'Frostweave Robe': '/images/items/frostweave-robe.webp',
  'Mistcloak': '/images/items/mistcloak.webp',
  'Wraith Vestments': '/images/items/wraith-vestments.webp',
  'Ember Mantle': '/images/items/ember-mantle.webp',

  // --- Z2 Weapons ---
  'Ridgestone Hammer': '/images/items/ridgestone-hammer.webp',
  'Peak Cleaver': '/images/items/peak-cleaver.webp',
  'Windforged Axe': '/images/items/windforged-axe.webp',
  "Warden's Maul": '/images/items/wardens-maul.webp',
  'Scrub Bow': '/images/items/scrub-bow.webp',
  'Gale Bow': '/images/items/gale-bow.webp',
  'Stormfeather Bow': '/images/items/stormfeather-bow.webp',
  'Peakwind Longbow': '/images/items/peakwind-longbow.webp',
  'Frozen Shard': '/images/items/frozen-shard.webp',
  'Rime Staff': '/images/items/rime-staff.webp',
  'Stormglass Rod': '/images/items/stormglass-rod.webp',
  'Wraith Beacon': '/images/items/wraith-beacon.webp',
  "Warden's Ember": '/images/items/wardens-ember.webp',
  'Windweaver': '/images/items/windweaver.webp',
  'Ridgefang': '/images/items/ridgefang.webp',
  'Viperstrike': '/images/items/viperstrike.webp',
  'Ashveil Staff': '/images/items/ashveil-staff.webp',

  // --- Z2 Consumables (trash drops) ---
  'Corroded Bronze Fragment': '/images/items/corroded-bronze-fragment.webp',
  'Etched Stone Chip': '/images/items/etched-stone-chip.webp',
  'Wind-Bleached Bone': '/images/items/wind-bleached-bone.webp',
  'Shattered Crest': '/images/items/shattered-crest.webp',
  'Warm Iron Shard': '/images/items/warm-iron-shard.webp',
  'Dried Summit Lichen': '/images/items/dried-summit-lichen.webp',

  // --- Z2 Monster weapons ---
  'Ridge Stalker Strike': '/images/monster-weapons/ridge-stalker-strike.webp',
  'Frost Wraith Strike': '/images/monster-weapons/frost-wraith-strike.webp',
  'Granite Sentinel Strike': '/images/monster-weapons/granite-sentinel-strike.webp',
  'Gale Phantom Strike': '/images/monster-weapons/gale-phantom-strike.webp',
  'Blighthorn Strike': '/images/monster-weapons/blighthorn-strike.webp',
  'Storm Shrike Strike': '/images/monster-weapons/storm-shrike-strike.webp',
  'Hollow Scout Strike': '/images/monster-weapons/hollow-scout-strike.webp',
  'Ironpeak Charger Strike': '/images/monster-weapons/ironpeak-charger-strike.webp',
  'Peakfire Wraith Strike': '/images/monster-weapons/peakfire-wraith-strike.webp',
  'Korraths Warden Strike': '/images/monster-weapons/korraths-warden-strike.webp',
};

/**
 * Fallback emojis for consumables whose names don't contain embedded emojis.
 * Keyed by the plain name (no emoji prefix).
 */
const CONSUMABLE_EMOJIS: Record<string, string> = {
  'Minor Health Potion': '\u2764\uFE0F',
  'Health Potion': '\u2764\uFE0F',
  'Greater Health Potion': '\u2764\uFE0F',
  'Fortifying Stew': '\uD83C\uDF56',
  'Quickening Berries': '\uD83C\uDF52',
  'Focusing Tea': '\uD83C\uDF75',
  'Antidote': '\uD83E\uDDEA',
  'Smoke Bomb': '\uD83D\uDCA8',
};

/**
 * Fallback icons from game-icons.net (CC BY 3.0) for items without custom art.
 * See /public/ICON_CREDITS.md for attribution.
 */
const FALLBACK_ICONS: Record<string, string> = {
  // Base weapons
  'Rusty Axe': '/images/icons/battle-axe.svg',
  'Iron Sword': '/images/icons/broadsword.svg',
  'Novice Staff': '/images/icons/wizard-staff.svg',
  'Throwing Dagger': '/images/icons/thrown-daggers.svg',
  'Steel Sword': '/images/icons/pointy-sword.svg',
  'Flash Bomb': '/images/icons/flash-grenade.svg',
  'Weakening Fumes': '/images/icons/smoke-bomb.svg',
  'Glimmerstone': '/images/icons/gem-pendant.svg',
  'Poison Dart': '/images/icons/dart.svg',
  'Crossbow': '/images/icons/crossbow.svg',
  // Base spells
  'Thunderwave': '/images/icons/lightning-helix.svg',
  'Fireball': '/images/icons/fireball.svg',
  'Wall of Force': '/images/icons/magic-shield.svg',
  'Ice Lance': '/images/icons/ice-spear-shard.svg',
  'Meteor Swarm': '/images/icons/meteor-impact.svg',
  // Base armor
  'Leather Vest': '/images/icons/leather-vest.svg',
  'Steel Breastplate': '/images/icons/breastplate.svg',
  'Light Chainmail': '/images/icons/chain-mail.svg',
  'Apprentice Robe': '/images/icons/robe.svg',
  'Enchanted Armor': '/images/icons/magic-shield.svg',
  // Base consumables
  'healing potion': '/images/icons/health-potion.svg',
  'strong health potion': '/images/icons/health-potion.svg',
  'fortifying stew': '/images/icons/hot-meal.svg',
  'quickening berries': '/images/icons/berries-bowl.svg',
  'focusing tea': '/images/icons/tea.svg',
  'beer': '/images/icons/beer-stein.svg',
  'Smoke Bomb': '/images/icons/smoke-bomb.svg',
  // Bug Pit armor
  'Duct Tape Patch': '/images/icons/sticky-boot.svg',
  'Cardboard Box Armor': '/images/icons/cardboard-box.svg',
  'Trash Bag Poncho': '/images/icons/trash-can.svg',
  'Caffeine-Stained Hoodie': '/images/icons/hoodie.svg',
  'Cargo Shorts of Holding': '/images/icons/shorts.svg',
  'Mechanical Keyboard Shield': '/images/icons/keyboard.svg',
  'Load-Bearing Comment Vest': '/images/icons/leather-vest.svg',
  'Server Rack Plate': '/images/icons/server-rack.svg',
  'The Incognito Tab': '/images/icons/anonymous-mask.svg',
  "Senior Dev's Bathrobe": '/images/icons/robe.svg',
  'Standing Desk Fortress': '/images/icons/desk.svg',
  'Noise-Canceling Cloak': '/images/icons/hood.svg',
  "10x Engineer's Hoodie": '/images/icons/hoodie.svg',
  'The Firewall': '/images/icons/firewall.svg',
  // Bug Pit weapons (player)
  'Console.log Staff': '/images/icons/wizard-staff.svg',
  'Rubber Duck Mace': '/images/icons/rubber-duck.svg',
  'Mouse Click Dagger': '/images/icons/plain-dagger.svg',
  'Keyboard Warrior Blade': '/images/icons/broadsword.svg',
  "Debugger's Breakpoint": '/images/icons/magnifying-glass.svg',
  'Trackpad Shuriken': '/images/icons/shuriken.svg',
  'Hotfix Hammer': '/images/icons/thor-hammer.svg',
  'Stack Trace Scythe': '/images/icons/scythe.svg',
  'Refactor Blade': '/images/icons/katana.svg',
  'Pair Programming Staff': '/images/icons/bo.svg',
  'Git Blame Dagger': '/images/icons/plain-dagger.svg',
  'LGTM Stamp of Doom': '/images/icons/relic-blade.svg',
  'Rage Quit Greatsword': '/images/icons/relic-blade.svg',
  'Code Review Crossbow': '/images/icons/crossbow.svg',
  'The Mass Revert': '/images/icons/sword-clash.svg',
  "Linus's Flamethrower": '/images/icons/flamethrower.svg',
  'Zero-Day Exploit': '/images/icons/backstab.svg',
  // Bug Pit monster weapons
  'Syntax Error': '/images/icons/pointy-sword.svg',
  'Null Reference': '/images/icons/pointy-sword.svg',
  'Index Out of Bounds': '/images/icons/pointy-sword.svg',
  'Heap Corruption': '/images/icons/pointy-sword.svg',
  'Thread Deadlock': '/images/icons/pointy-sword.svg',
  'Recursive Call': '/images/icons/pointy-sword.svg',
  'While True': '/images/icons/pointy-sword.svg',
  'HEAD Detached': '/images/icons/pointy-sword.svg',
  'Core Dump': '/images/icons/pointy-sword.svg',
  'Friday Deploy': '/images/icons/pointy-sword.svg',
  // Bug Pit consumables
  'Emergency Coffee': '/images/icons/coffee-mug.svg',
  'Energy Drink of Haste': '/images/icons/potion-ball.svg',
  'Pizza Slice of Vigor': '/images/icons/pizza-slice.svg',
  'Fortifying Stress Ball': '/images/icons/rubber-duck.svg',
  'Quickening Energy Drink': '/images/icons/potion-ball.svg',
  'Focusing Rubber Duck': '/images/icons/rubber-duck.svg',
  'Antidote.sh': '/images/icons/vial.svg',
  'sudo rm -rf': '/images/icons/smoke-bomb.svg',
  'Deprecated API Key': '/images/icons/old-key.svg',
  'Orphaned TODO Comment': '/images/icons/scroll-unfurled.svg',
  'Unused Import Statement': '/images/icons/scroll-unfurled.svg',
  'Expired SSL Certificate': '/images/icons/scroll-unfurled.svg',
  'Single node_module': '/images/icons/cube.svg',
  'Outdated README': '/images/icons/book.svg',
};

/**
 * IPFS manifest cache — loaded lazily per zone.
 * Maps item name → IPFS gateway URL.
 * Populated by loadZoneManifest().
 */
const ipfsCache: Record<string, string> = {};
let manifestsLoaded = false;

/**
 * Load a zone's IPFS art manifest into the cache.
 * Manifests live at /images/manifests/<zone>.json.
 * Call this when a player enters a new zone.
 */
export const loadZoneManifest = async (zoneName: string): Promise<void> => {
  try {
    const res = await fetch(`/images/manifests/${zoneName}.json`);
    if (!res.ok) return;
    const manifest: Record<string, { url: string }> = await res.json();
    for (const [name, entry] of Object.entries(manifest)) {
      ipfsCache[name] = entry.url;
    }
    manifestsLoaded = true;
  } catch {
    // Manifest not available — no-op
  }
};

export const getItemImage = (name: string): string | undefined => {
  return ITEM_IMAGES[name] ?? FALLBACK_ICONS[name] ?? (manifestsLoaded ? ipfsCache[name] : undefined);
};

export const getConsumableEmoji = (name: string): string => {
  return CONSUMABLE_EMOJIS[name] || '\uD83D\uDCE6';
};

/**
 * Preload item images into the browser cache.
 * Call when item data arrives (inventory, shop, marketplace)
 * to start fetching before components mount.
 */
const preloadedUrls = new Set<string>();

export const preloadItemImages = (itemNames: string[]): void => {
  for (const name of itemNames) {
    const src = getItemImage(name);
    if (!src || preloadedUrls.has(src)) continue;
    preloadedUrls.add(src);
    const img = new window.Image();
    img.src = src;
  }
};
