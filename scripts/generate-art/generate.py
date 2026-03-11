#!/usr/bin/env python3
"""
Art generation pipeline for Ultimate Dominion.
Uses Flux 2 Pro via Replicate API with reference images for style consistency.

Usage:
    python generate.py --test                  # Generate test samples (~$0.40)
    python generate.py --all                   # Generate all missing art
    python generate.py --category weapons      # Generate one category
    python generate.py --item "Phantom Bow"    # Generate single item
    python generate.py --dry-run               # Print prompts without generating
"""

import argparse
import base64
import json
import os
import random
import sys
import time
import urllib.request
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

replicate = None  # Lazy import — only needed for actual generation

from prompts import build_prompt, TEST_ITEMS

# Paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
CLIENT_IMAGES = PROJECT_ROOT / "packages" / "client" / "public" / "images"
ITEMS_DIR = CLIENT_IMAGES / "items"
MONSTERS_DIR = CLIENT_IMAGES / "monsters"
FRAGMENTS_DIR = CLIENT_IMAGES / "fragments"
OUTPUT_DIR = Path(__file__).resolve().parent / "output"

# Replicate model
FLUX_2_PRO = "black-forest-labs/flux-2-pro"

# Reference images for style consistency — a diverse sample of existing art
REFERENCE_IMAGES = {
    "weapon": [
        ITEMS_DIR / "broken-sword.png",
        ITEMS_DIR / "runesword.png",
        ITEMS_DIR / "dragonfire-scepter.png",
        ITEMS_DIR / "necrotic-staff.png",
    ],
    "armor": [
        ITEMS_DIR / "apprentice-robes.png",
        ITEMS_DIR / "worn-leather-vest.png",
        ITEMS_DIR / "rusty-chainmail.png",
        ITEMS_DIR / "scout-armor.png",
    ],
    "consumable": [
        ITEMS_DIR / "broken-sword.png",  # Use weapon refs for style baseline
        ITEMS_DIR / "runesword.png",
    ],
    "spell": [
        ITEMS_DIR / "dragonfire-scepter.png",
        ITEMS_DIR / "necrotic-staff.png",
    ],
    "monster": [
        MONSTERS_DIR / "cave-rat.webp",
        MONSTERS_DIR / "crystal-elemental.webp",
        MONSTERS_DIR / "shadow-dragon.webp",
    ],
    "fragment": [
        ITEMS_DIR / "runesword.png",
        ITEMS_DIR / "apprentice-robes.png",
    ],
}


def _get_reference_images(item_type: str, count: int = 3) -> list[Path]:
    """Get reference images for the given item type."""
    refs = REFERENCE_IMAGES.get(item_type, REFERENCE_IMAGES["weapon"])
    # Return up to `count` refs, all of them if fewer exist
    return refs[:count]


def _file_to_data_uri(path: Path, max_size: int = 512) -> str:
    """Convert a local file to a data URI, resizing to avoid timeouts."""
    from PIL import Image
    import io

    img = Image.open(path)
    # Resize to max_size on longest side
    if max(img.size) > max_size:
        img.thumbnail((max_size, max_size), Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    data = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{data}"


def load_item_registry():
    """Load all items from the project and identify what needs art."""
    items_file = PROJECT_ROOT / "packages" / "contracts" / "items_expanded.json"
    desc_map = _load_descriptions()

    with open(items_file) as f:
        data = json.load(f)

    # Items that already have custom PNG art
    has_art = set()
    for png in ITEMS_DIR.glob("*.png"):
        has_art.add(png.stem)

    has_monster_art = set()
    for img in MONSTERS_DIR.glob("*.*"):
        has_monster_art.add(img.stem)

    registry = []

    for cat_key, item_type in [("weapons", "weapon"), ("armor", "armor"),
                                ("consumables", "consumable"), ("spells", "spell")]:
        for item in data.get(cat_key, []):
            slug = _slugify(item["name"])
            if slug not in has_art:
                registry.append({
                    "name": item["name"],
                    "type": item_type,
                    "slug": slug,
                    "desc": desc_map.get(f"{item_type}:{slug.replace('-', '_')}", ""),
                    "zone": "",
                    "output_path": str(ITEMS_DIR / f"{slug}.png"),
                })

    # Zone-specific items
    zones_dir = PROJECT_ROOT / "packages" / "contracts" / "zones"
    if zones_dir.exists():
        for zone_dir in sorted(zones_dir.iterdir()):
            if not zone_dir.is_dir():
                continue
            zone_name = zone_dir.name
            items_json = zone_dir / "items.json"
            if not items_json.exists():
                continue
            with open(items_json) as f:
                zone_data = json.load(f)

            for cat_key, item_type in [("weapons", "weapon"), ("armor", "armor"),
                                        ("consumables", "consumable"), ("spells", "spell")]:
                for item in zone_data.get(cat_key, []):
                    slug = _slugify(item["name"])
                    if slug not in has_art and not any(r["slug"] == slug for r in registry):
                        registry.append({
                            "name": item["name"],
                            "type": item_type,
                            "slug": slug,
                            "desc": desc_map.get(f"{item_type}:{slug.replace('-', '_')}", ""),
                            "zone": zone_name,
                            "output_path": str(ITEMS_DIR / f"{slug}.png"),
                        })

            # Monsters
            monsters_json = zone_dir / "monsters.json"
            if monsters_json.exists():
                with open(monsters_json) as f:
                    monster_data = json.load(f)
                for monster in monster_data:
                    if isinstance(monster, dict):
                        name = monster.get("name", "")
                        slug = _slugify(name)
                        if slug not in has_monster_art:
                            if not any(r["slug"] == slug and r["type"] == "monster" for r in registry):
                                registry.append({
                                    "name": name,
                                    "type": "monster",
                                    "slug": slug,
                                    "desc": "",
                                    "zone": zone_name,
                                    "output_path": str(MONSTERS_DIR / f"{slug}.webp"),
                                })

    return registry


def _load_descriptions() -> dict[str, str]:
    """Parse item descriptions from the TypeScript file."""
    desc_file = PROJECT_ROOT / "packages" / "client" / "src" / "utils" / "itemDescriptions.ts"
    descs = {}
    if desc_file.exists():
        content = desc_file.read_text()
        in_map = False
        for line in content.split("\n"):
            line = line.strip()
            if "ITEM_DESCRIPTIONS" in line:
                in_map = True
                continue
            if in_map and line.startswith('"'):
                parts = line.split('": "', 1)
                if len(parts) == 2:
                    key = parts[0].strip('" ')
                    val = parts[1].rstrip('",')
                    descs[key] = val
            if in_map and line == "};":
                break
    return descs


def _slugify(name: str) -> str:
    """Convert item name to file-safe slug."""
    return (
        name.lower()
        .replace("\u2019s", "s")
        .replace("'s", "s")
        .replace("'", "")
        .replace("\u2019", "")
        .replace(".", "")
        .replace(",", "")
        .replace(":", "")
        .replace("/", "-")
        .replace(" ", "-")
        .replace("--", "-")
        .strip("-")
    )


def generate_image(
    prompt: str,
    output_path: str,
    item_type: str = "weapon",
    aspect_ratio: str = "1:1",
    guidance: float = 3.5,
    steps: int = 28,
) -> str:
    """Generate a single image via Replicate Flux 2 Pro."""
    global replicate
    if replicate is None:
        try:
            import replicate as _replicate
            replicate = _replicate
        except ImportError:
            print("Install replicate: pip install replicate")
            sys.exit(1)

    # Build reference images as data URIs
    ref_paths = _get_reference_images(item_type)
    ref_uris = []
    for ref_path in ref_paths:
        if ref_path.exists():
            ref_uris.append(_file_to_data_uri(ref_path))

    input_params = {
        "prompt": prompt,
        "aspect_ratio": aspect_ratio,
        "output_format": "png",
        "safety_tolerance": 5,
        "prompt_upsampling": False,
    }

    # Add reference images if we have them
    if ref_uris:
        input_params["reference_images"] = ref_uris

    output = replicate.run(FLUX_2_PRO, input=input_params)

    # Download the image
    if isinstance(output, list):
        url = str(output[0])
    elif hasattr(output, "url"):
        url = output.url
    else:
        url = str(output)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    urllib.request.urlretrieve(url, output_path)
    return output_path


def run_test(dry_run: bool = False):
    """Generate test images to validate the style."""
    print(f"=== TEST MODE {'(DRY RUN)' if dry_run else ''} ===")
    print(f"Generating {len(TEST_ITEMS)} test images using Flux 2 Pro + reference images")
    print(f"Estimated cost: ~${len(TEST_ITEMS) * 0.05:.2f}")
    print()

    os.makedirs(OUTPUT_DIR / "test", exist_ok=True)

    for item in TEST_ITEMS:
        prompt = build_prompt(
            item["name"],
            item["type"],
            item.get("desc", ""),
            item.get("zone", ""),
        )
        slug = _slugify(item["name"])
        out_path = str(OUTPUT_DIR / "test" / f"{slug}.png")
        refs = _get_reference_images(item["type"])

        print(f"  {item['name']} ({item['type']})")
        print(f"    Refs: {', '.join(r.name for r in refs if r.exists())}")
        print(f"    Prompt: {prompt[:140]}...")
        print(f"    Output: {out_path}")

        if not dry_run:
            try:
                generate_image(prompt, out_path, item_type=item["type"])
                print(f"    Done!")
            except Exception as e:
                print(f"    ERROR: {e}")
        print()

    if not dry_run:
        print(f"Test images saved to: {OUTPUT_DIR / 'test'}")
        print("Review them and adjust prompts.py if needed before running --all")


def run_generate(
    registry: list[dict],
    category: str = "",
    item_name: str = "",
    dry_run: bool = False,
    max_parallel: int = 3,
):
    """Generate images for items in the registry."""
    if item_name:
        registry = [r for r in registry if r["name"].lower() == item_name.lower()]
        if not registry:
            print(f"Item '{item_name}' not found in registry or already has art")
            return
    elif category:
        cat_map = {
            "weapons": "weapon", "weapon": "weapon",
            "armor": "armor",
            "consumables": "consumable", "consumable": "consumable",
            "spells": "spell", "spell": "spell",
            "monsters": "monster", "monster": "monster",
            "fragments": "fragment", "fragment": "fragment",
        }
        target_type = cat_map.get(category.lower(), category.lower())
        registry = [r for r in registry if r["type"] == target_type]

    if not registry:
        print("Nothing to generate!")
        return

    cost_estimate = len(registry) * 0.05
    print(f"=== GENERATING {len(registry)} IMAGES {'(DRY RUN)' if dry_run else ''} ===")
    print(f"Estimated cost: ${cost_estimate:.2f}")
    print()

    if not dry_run and not item_name:
        resp = input(f"Generate {len(registry)} images for ~${cost_estimate:.2f}? [y/N] ")
        if resp.lower() != "y":
            print("Cancelled.")
            return

    succeeded = 0
    failed = 0

    def process_item(item):
        prompt = build_prompt(
            item["name"], item["type"], item["desc"], item["zone"],
        )
        if dry_run:
            return item["name"], prompt, None

        try:
            path = generate_image(prompt, item["output_path"], item_type=item["type"])
            return item["name"], prompt, path
        except Exception as e:
            return item["name"], prompt, f"ERROR: {e}"

    if dry_run:
        for item in registry:
            name, prompt, _ = process_item(item)
            print(f"  {name}")
            print(f"    Prompt: {prompt[:150]}...")
            print(f"    Output: {item['output_path']}")
            print()
    else:
        # Sequential for now to avoid rate limits; bump max_parallel once confirmed
        with ThreadPoolExecutor(max_workers=max_parallel) as executor:
            futures = {executor.submit(process_item, item): item for item in registry}
            for i, future in enumerate(as_completed(futures), 1):
                name, prompt, result = future.result()
                if result and str(result).startswith("ERROR"):
                    print(f"  [{i}/{len(registry)}] FAIL: {name} -- {result}")
                    failed += 1
                else:
                    print(f"  [{i}/{len(registry)}] OK: {name}")
                    succeeded += 1

        print()
        print(f"Done! {succeeded} succeeded, {failed} failed")
        print(f"Actual cost: ~${succeeded * 0.05:.2f}")


def main():
    parser = argparse.ArgumentParser(description="Generate Ultimate Dominion game art")
    parser.add_argument("--test", action="store_true", help="Generate test samples")
    parser.add_argument("--all", action="store_true", help="Generate all missing art")
    parser.add_argument("--category", type=str, help="Generate for a specific category")
    parser.add_argument("--item", type=str, help="Generate for a single item by name")
    parser.add_argument("--dry-run", action="store_true", help="Print prompts without generating")
    parser.add_argument("--parallel", type=int, default=3, help="Max parallel generations")
    args = parser.parse_args()

    needs_api = not args.dry_run and (args.test or args.all or args.category or args.item)
    if needs_api and not os.environ.get("REPLICATE_API_TOKEN"):
        print("Set REPLICATE_API_TOKEN env var first")
        print("Get your token at: https://replicate.com/account/api-tokens")
        sys.exit(1)

    if args.test:
        run_test(dry_run=args.dry_run)
    elif args.all or args.category or args.item:
        registry = load_item_registry()
        run_generate(
            registry,
            category=args.category or "",
            item_name=args.item or "",
            dry_run=args.dry_run,
            max_parallel=args.parallel,
        )
    else:
        registry = load_item_registry()
        from collections import Counter
        counts = Counter(r["type"] for r in registry)
        print(f"Items needing art: {len(registry)}")
        for t, c in sorted(counts.items()):
            print(f"  {t}: {c}")
        print()
        print("Run with --test to generate samples, or --all to generate everything")
        print("Run with --dry-run to preview prompts without spending money")


if __name__ == "__main__":
    main()
