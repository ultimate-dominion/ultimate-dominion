#!/usr/bin/env python3
"""
Train a Flux Dev LoRA on existing Ultimate Dominion game art.

This trains a style LoRA using the existing item and monster PNGs
so generated images match the established art style.

Cost: ~$1.85 on Replicate, takes ~2-5 minutes.

Usage:
    python train_lora.py
    python train_lora.py --dry-run   # Just show what would be uploaded
"""

import argparse
import os
import sys
import zipfile
from pathlib import Path

try:
    import replicate
except ImportError:
    print("Install replicate: pip install replicate")
    sys.exit(1)

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
CLIENT_IMAGES = PROJECT_ROOT / "packages" / "client" / "public" / "images"
ITEMS_DIR = CLIENT_IMAGES / "items"
MONSTERS_DIR = CLIENT_IMAGES / "monsters"
OUTPUT_DIR = Path(__file__).resolve().parent / "output"

TRIGGER_WORD = "ULTDOM style"


def collect_training_images() -> list[Path]:
    """Collect all existing game art for training."""
    images = []

    # Item PNGs
    for png in sorted(ITEMS_DIR.glob("*.png")):
        images.append(png)

    # Monster images
    for img in sorted(MONSTERS_DIR.glob("*.*")):
        if img.suffix in (".png", ".webp", ".jpg", ".jpeg"):
            images.append(img)

    return images


def create_training_zip(images: list[Path], output_path: Path) -> Path:
    """Create a ZIP file of training images with captions."""
    zip_path = output_path / "training_data.zip"
    os.makedirs(output_path, exist_ok=True)

    with zipfile.ZipFile(zip_path, "w") as zf:
        for img in images:
            # Add image
            zf.write(img, img.name)

            # Add caption file (same name, .txt extension)
            caption = (
                f"{TRIGGER_WORD}, white ink illustration on pure black background, "
                f"high contrast detailed linework, dark fantasy medieval game art, "
                f"dramatic lighting, professional quality"
            )
            caption_name = img.stem + ".txt"
            zf.writestr(caption_name, caption)

    return zip_path


def train(dry_run: bool = False):
    """Train the LoRA."""
    images = collect_training_images()

    print(f"Found {len(images)} training images:")
    for img in images:
        size_kb = img.stat().st_size / 1024
        print(f"  {img.name} ({size_kb:.0f} KB)")
    print()

    if len(images) < 10:
        print("WARNING: Fewer than 10 images. LoRA quality may be poor.")
        print("Consider adding more reference images.")
        print()

    if dry_run:
        print("DRY RUN — would create training ZIP and submit to Replicate")
        print(f"Trigger word: '{TRIGGER_WORD}'")
        print(f"Estimated cost: ~$1.85")
        return

    # Create training data
    zip_path = create_training_zip(images, OUTPUT_DIR)
    print(f"Created training ZIP: {zip_path} ({zip_path.stat().st_size / 1024:.0f} KB)")
    print()

    print("Submitting training job to Replicate...")
    print(f"Trigger word: '{TRIGGER_WORD}'")
    print("This will cost ~$1.85 and take ~2-5 minutes.")
    print()

    # Create a new model on Replicate for the LoRA
    # You need to set your Replicate username
    username = os.environ.get("REPLICATE_USERNAME", "")
    if not username:
        print("Set REPLICATE_USERNAME env var to your Replicate username")
        print("Find it at: https://replicate.com/account")
        sys.exit(1)

    model_name = f"{username}/ud-game-art"

    try:
        model = replicate.models.create(
            owner=username,
            name="ud-game-art",
            visibility="private",
            hardware="gpu-t4-nano",
            description="Ultimate Dominion game art style LoRA",
        )
        print(f"Created model: {model_name}")
    except Exception as e:
        if "already exists" in str(e).lower():
            print(f"Model {model_name} already exists, reusing")
        else:
            raise

    # Submit training
    with open(zip_path, "rb") as f:
        training = replicate.trainings.create(
            version="ostris/flux-dev-lora-trainer:4ffd32160efd92e956d39c5338a9b8fbafca58e03f791f6d8011f3e20e8ea6fa",
            input={
                "input_images": f,
                "trigger_word": TRIGGER_WORD,
                "steps": 1000,
                "lora_rank": 16,
                "optimizer": "adamw8bit",
                "batch_size": 1,
                "resolution": "512,768,1024",
                "autocaption": False,  # We provide our own captions
                "learning_rate": 0.0004,
            },
            destination=model_name,
        )

    print(f"Training started! ID: {training.id}")
    print(f"Status: {training.status}")
    print()
    print(f"Monitor at: https://replicate.com/p/{training.id}")
    print()
    print("Once complete, use the LoRA version ID with generate.py:")
    print(f"  python generate.py --test --lora {model_name}:<version>")
    print()
    print("Or pass the HuggingFace URL if the trainer outputs one.")

    # Save training info
    info_path = OUTPUT_DIR / "lora_training.json"
    import json
    with open(info_path, "w") as f:
        json.dump({
            "training_id": training.id,
            "model": model_name,
            "trigger_word": TRIGGER_WORD,
            "num_images": len(images),
            "status": training.status,
        }, f, indent=2)
    print(f"Training info saved to: {info_path}")


def main():
    parser = argparse.ArgumentParser(description="Train LoRA on existing game art")
    parser.add_argument("--dry-run", action="store_true", help="Show what would happen")
    args = parser.parse_args()

    if not args.dry_run and not os.environ.get("REPLICATE_API_TOKEN"):
        print("Set REPLICATE_API_TOKEN env var first")
        sys.exit(1)

    train(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
