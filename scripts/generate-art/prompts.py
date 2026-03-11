"""
Prompt templates for Ultimate Dominion art generation.

Style: White-on-black ink illustration with subtle color accents.
Base style established by existing artist — high contrast, detailed linework,
medieval dark fantasy aesthetic.
"""

# Base style prompt that goes into every generation
BASE_STYLE = (
    "rough white ink sketch on pure black background, "
    "expressive loose brushstrokes, hand-drawn feel, raw and unpolished, "
    "white paint strokes with visible brush texture, glowing white edges bleeding into black, "
    "high contrast, dark fantasy, NOT photorealistic, NOT 3D rendered, NOT clean digital art"
)

# Color accent map by item category/type
COLOR_ACCENTS = {
    # Weapon classes
    "melee": "faint warm steel-grey metallic highlights",
    "ranged": "subtle amber-gold string and wood tones",
    "magic_weapon": "subtle blue-violet arcane glow on the focal point",
    "staff": "subtle blue-violet arcane glow emanating from the tip",
    "wand": "faint purple-blue magical energy at the tip",

    # Armor classes
    "cloth": "faint blue-grey fabric highlights",
    "leather": "subtle warm brown-amber leather tones",
    "chain": "cool steel-blue metallic sheen",
    "plate": "bright steel-white metallic highlights with faint gold trim",
    "robes": "subtle deep blue or purple mystical fabric glow",

    # Consumables
    "potion": "deep red liquid glow inside glass vial",
    "food": "warm amber-orange tones",
    "poison": "sickly green luminescence",
    "buff": "golden shimmer",
    "material": "muted earth tones, brown and grey",
    "scroll": "faint amber parchment tone",

    # Spells
    "fire": "bright orange-red flame glow",
    "ice": "cold blue-white crystalline glow",
    "lightning": "bright electric blue-white crackling energy",
    "arcane": "deep purple arcane energy",
    "heal": "warm golden-white radiance",
    "dark": "deep purple-black with faint violet edges",
    "nature": "muted green organic glow",

    # Monsters
    "beast": "faint red eyes, warm grey fur/skin tones",
    "undead": "sickly green-purple necrotic glow",
    "elemental": "color matching element type",
    "humanoid": "faint warm skin or armor tones",
    "dragon": "subtle fire-orange eye glow and scale highlights",

    # Fragments
    "fragment": "faint golden-amber ancient glow, weathered parchment edges",

    # Bug Pit (dev humor zone) — slightly more saturated, playful
    "bug_pit": "subtle neon green terminal-glow accents",
}

# Classify items into color accent categories
def get_color_accent(item_name: str, item_type: str, zone: str = "") -> str:
    """Return the appropriate color accent for an item."""
    name_lower = item_name.lower()

    if zone == "bug_pit":
        return COLOR_ACCENTS["bug_pit"]

    if item_type == "spell":
        if any(w in name_lower for w in ["fire", "flame", "burn", "meteor", "scorch"]):
            return COLOR_ACCENTS["fire"]
        if any(w in name_lower for w in ["ice", "frost", "cold", "freeze", "shard"]):
            return COLOR_ACCENTS["ice"]
        if any(w in name_lower for w in ["lightning", "thunder", "shock", "bolt"]):
            return COLOR_ACCENTS["lightning"]
        if any(w in name_lower for w in ["heal", "bless", "divine", "restore"]):
            return COLOR_ACCENTS["heal"]
        if any(w in name_lower for w in ["shadow", "dark", "void", "death", "soul", "drain"]):
            return COLOR_ACCENTS["dark"]
        if any(w in name_lower for w in ["entangle", "nature", "thorn"]):
            return COLOR_ACCENTS["nature"]
        return COLOR_ACCENTS["arcane"]

    if item_type == "monster":
        if any(w in name_lower for w in ["rat", "spider", "brute", "troll"]):
            return COLOR_ACCENTS["beast"]
        if any(w in name_lower for w in ["lich", "undead", "skeleton", "ghost"]):
            return COLOR_ACCENTS["undead"]
        if any(w in name_lower for w in ["elemental", "crystal"]):
            return COLOR_ACCENTS["elemental"]
        if any(w in name_lower for w in ["dragon"]):
            return COLOR_ACCENTS["dragon"]
        return COLOR_ACCENTS["humanoid"]

    if item_type == "weapon":
        if any(w in name_lower for w in ["staff", "scepter", "rod", "focus"]):
            return COLOR_ACCENTS["staff"]
        if any(w in name_lower for w in ["wand"]):
            return COLOR_ACCENTS["wand"]
        if any(w in name_lower for w in ["bow", "crossbow", "shortbow"]):
            return COLOR_ACCENTS["ranged"]
        if any(w in name_lower for w in ["arcane", "cosmic", "void", "soul",
                                          "blast", "surge", "drain", "mark",
                                          "shadowstep", "shadowstrike",
                                          "entangle", "battle cry", "blessing",
                                          "divine", "hunter's mark"]):
            return COLOR_ACCENTS["magic_weapon"]
        return COLOR_ACCENTS["melee"]

    if item_type == "armor":
        if any(w in name_lower for w in ["robe", "vestment", "attire", "regalia",
                                          "shroud", "archmage", "sorcerer",
                                          "conjurer", "channeler", "magister",
                                          "cosmic", "mage"]):
            return COLOR_ACCENTS["robes"]
        if any(w in name_lower for w in ["plate", "bulwark", "champion",
                                          "knight", "warlord", "titan", "full",
                                          "half", "battlefield"]):
            return COLOR_ACCENTS["plate"]
        if any(w in name_lower for w in ["chain", "mercenary"]):
            return COLOR_ACCENTS["chain"]
        if any(w in name_lower for w in ["leather", "scout", "ranger", "hunter",
                                          "garb", "shadow", "phantom",
                                          "nightstalker", "assassin",
                                          "sharpshooter", "vest"]):
            return COLOR_ACCENTS["leather"]
        return COLOR_ACCENTS["cloth"]

    if item_type == "consumable":
        if any(w in name_lower for w in ["potion", "restore", "health", "elixir"]):
            return COLOR_ACCENTS["potion"]
        if any(w in name_lower for w in ["stew", "berries", "tea", "coffee",
                                          "pizza", "meal"]):
            return COLOR_ACCENTS["food"]
        if any(w in name_lower for w in ["venom", "poison", "sapping", "spore",
                                          "antidote"]):
            return COLOR_ACCENTS["poison"]
        if any(w in name_lower for w in ["tonic", "salve", "ale", "smoke",
                                          "flash", "bomb"]):
            return COLOR_ACCENTS["buff"]
        if any(w in name_lower for w in ["tooth", "moss", "bone", "crystal",
                                          "hide", "nail"]):
            return COLOR_ACCENTS["material"]
        return COLOR_ACCENTS["scroll"]

    if item_type == "fragment":
        return COLOR_ACCENTS["fragment"]

    return ""


def build_prompt(
    item_name: str,
    item_type: str,
    description: str = "",
    zone: str = "",
    lora_trigger: str = "",
) -> str:
    """Build a full generation prompt for an item."""
    parts = []

    # LoRA trigger word first if using a trained model
    if lora_trigger:
        parts.append(lora_trigger)

    # Item-specific description
    if item_type == "weapon":
        parts.append(f"a fantasy weapon called '{item_name}', isolated on black background")
    elif item_type == "armor":
        parts.append(f"a fantasy armor piece called '{item_name}', displayed flat/front-facing on black background")
    elif item_type == "consumable":
        parts.append(f"a fantasy item called '{item_name}', small object isolated on black background")
    elif item_type == "spell":
        parts.append(f"a magical spell effect called '{item_name}', magical energy on black background")
    elif item_type == "monster":
        parts.append(f"a dark fantasy creature called '{item_name}', portrait view facing forward on black background")
    elif item_type == "fragment":
        parts.append(f"an ancient scroll or stone tablet fragment called '{item_name}', weathered and cracked on black background")
    else:
        parts.append(f"'{item_name}' on black background")

    # Flavor from item description
    if description:
        # Take just the key visual details, not the full flavor text
        parts.append(f"({description})")

    # Base style
    parts.append(BASE_STYLE)

    # Color accent
    accent = get_color_accent(item_name, item_type, zone)
    if accent:
        parts.append(accent)

    # Negative-style guidance baked into prompt
    parts.append("no text, no watermark, no frame, no border, centered composition")

    return ", ".join(parts)


# Test prompts for validation
TEST_ITEMS = [
    # Existing items we can compare against
    {"name": "Broken Sword", "type": "weapon", "desc": "Snapped at the hilt. The edge still cuts if you hold it right."},
    {"name": "Runesword", "type": "weapon", "desc": "Ancient runes carved into the blade. The metal hums with power."},
    {"name": "Apprentice Robes", "type": "armor", "desc": "Faded blue with a singed hem. The last wearer learned something the hard way."},
    # Missing items to generate
    {"name": "Archmage Regalia", "type": "armor", "desc": "Robes of impossible fabric, threaded with starlight."},
    {"name": "Phantom Bow", "type": "weapon", "desc": "The bow flickers in and out of existence. The arrows don't."},
    {"name": "Greater Health Potion", "type": "consumable", "desc": "Thick and amber. Closes wounds you can watch."},
    {"name": "Fireball", "type": "spell", "desc": "A sphere of flame summoned from nothing."},
    {"name": "Rubber Duck Mace", "type": "weapon", "desc": "Squeaks on impact. Surprisingly effective.", "zone": "bug_pit"},
]
