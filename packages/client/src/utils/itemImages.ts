/**
 * Maps item names to their bundled image paths.
 * Images are in /public/images/items/ as PNG files.
 */
const ITEM_IMAGES: Record<string, string> = {
  'Broken Sword': '/images/items/broken-sword.png',
  'Worn Shortbow': '/images/items/worn-shortbow.png',
  'Cracked Wand': '/images/items/cracked-wand.png',
  'Hunting Bow': '/images/items/hunting-bow.png',
  'Iron Axe': '/images/items/iron-axe.png',
  'Apprentice Staff': '/images/items/apprentice-staff.png',
  'Light Mace': '/images/items/steel-mace.png',
  'Shortbow': '/images/items/recurve-bow.png',
  'Channeling Rod': '/images/items/channeling-rod.png',
  'Runesword': '/images/items/runesword.png',
  'Warhammer': '/images/items/warhammer.png',
  'Longbow': '/images/items/longbow.png',
  'Dire Rat Fang': '/images/items/rat-kings-fang.png',
  'Sporecap Wand': '/images/items/sporecap-wand.png',
  'Notched Cleaver': '/images/items/brutes-cleaver.png',
  'Crystal Shard': '/images/items/crystal-blade.png',
  'Gnarled Cudgel': '/images/items/trolls-bonebreaker.png',
  'Webspinner Bow': '/images/items/webspinner-bow.png',
  'Necrotic Staff': '/images/items/necrotic-staff.png',
  'Earthshaker Maul': '/images/items/earthshaker-maul.png',
  'Dragonfire Scepter': '/images/items/dragonfire-scepter.png',
  // Dark Cave armor
  'Tattered Cloth': '/images/items/tattered-cloth.png',
  'Worn Leather Vest': '/images/items/worn-leather-vest.png',
  'Rusty Chainmail': '/images/items/rusty-chainmail.png',
  'Padded Armor': '/images/items/padded-armor.png',
  'Leather Jerkin': '/images/items/leather-jerkin.png',
  'Apprentice Robes': '/images/items/apprentice-robes.png',
  'Studded Leather': '/images/items/studded-leather.png',
  'Scout Armor': '/images/items/scout-armor.png',
  'Acolyte Vestments': '/images/items/acolyte-vestments.png',
  'Ranger Leathers': '/images/items/ranger-leathers.png',
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
 * Fallback icons from game-icons.net (CC BY 3.0) for items without custom PNGs.
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
  // Dark Cave armor
  'Tattered Cloth': '/images/icons/robe.svg',
  'Worn Leather Vest': '/images/icons/leather-vest.svg',
  'Rusty Chainmail': '/images/icons/chain-mail.svg',
  'Padded Armor': '/images/icons/breastplate.svg',
  'Leather Jerkin': '/images/icons/leather-vest.svg',
  'Apprentice Robes': '/images/icons/robe.svg',
  'Studded Leather': '/images/icons/leather-vest.svg',
  'Scout Armor': '/images/icons/leather-vest.svg',
  'Acolyte Vestments': '/images/icons/robe.svg',
  'Etched Chainmail': '/images/icons/chain-mail.svg',
  'Ranger Leathers': '/images/icons/leather-vest.svg',
  'Mage Robes': '/images/icons/robe.svg',
  'Spider Silk Wraps': '/images/icons/leather-vest.svg',
  'Carved Stone Plate': '/images/icons/breastplate.svg',
  "Stalker's Cloak": '/images/icons/hood.svg',
  'Scorched Scale Vest': '/images/icons/fish-scales.svg',
  // Dark Cave weapons
  'Notched Blade': '/images/icons/plain-dagger.svg',
  'Mage Staff': '/images/icons/wizard-staff.svg',
  'Bone Staff': '/images/icons/bone-gnawer.svg',
  'Stone Maul': '/images/icons/wood-club.svg',
  'Darkwood Bow': '/images/icons/high-shot.svg',
  'Smoldering Rod': '/images/icons/orb-wand.svg',
  // V3 epic weapons
  'Trollhide Cleaver': '/images/icons/battle-axe.svg',
  'Phasefang': '/images/icons/plain-dagger.svg',
  'Drakescale Staff': '/images/icons/wizard-staff.svg',
  // V3 armor
  "Drake's Cowl": '/images/icons/hood.svg',
  // Basilisk weapons
  'Basilisk Fangs': '/images/icons/fangs.svg',
  'Petrifying Gaze': '/images/icons/evil-book.svg',
  // Dark Cave monster weapons
  'Venomous Bite': '/images/icons/fangs.svg',
  'Crushing Slam': '/images/icons/fist.svg',
  'Razor Claws': '/images/icons/wolverine-claws.svg',
  'Dark Magic': '/images/icons/evil-book.svg',
  'Elemental Burst': '/images/icons/fire-ring.svg',
  'Stone Fist': '/images/icons/rock.svg',
  'Shadow Strike': '/images/icons/hooded-assassin.svg',
  // Dark Cave consumables
  'Minor Health Potion': '/images/icons/health-potion.svg',
  'Health Potion': '/images/icons/health-potion.svg',
  'Greater Health Potion': '/images/icons/health-potion.svg',
  'Fortifying Stew': '/images/icons/hot-meal.svg',
  'Quickening Berries': '/images/icons/berries-bowl.svg',
  'Focusing Tea': '/images/icons/tea.svg',
  'Antidote': '/images/icons/vial.svg',
  'Smoke Bomb': '/images/icons/smoke-bomb.svg',
  'Rat Tooth': '/images/icons/fang.svg',
  'Cave Moss': '/images/icons/grass.svg',
  'Cracked Bone': '/images/icons/bone.svg',
  'Dull Crystal': '/images/icons/crystal-growth.svg',
  'Tattered Hide': '/images/icons/animal-hide.svg',
  'Bent Nail': '/images/icons/nail.svg',
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

export const getItemImage = (name: string): string | undefined => {
  return ITEM_IMAGES[name] ?? FALLBACK_ICONS[name];
};

export const getConsumableEmoji = (name: string): string => {
  return CONSUMABLE_EMOJIS[name] || '\uD83D\uDCE6';
};
