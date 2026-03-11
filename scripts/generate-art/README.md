# Art Generation Pipeline

Generates game item/monster/fragment art using Flux Dev + LoRA via Replicate.

## Setup
```bash
pip install replicate
export REPLICATE_API_TOKEN=your_token_here
```

## Usage
```bash
# Test mode: generate a few samples to validate style
python generate.py --test

# Generate all missing art
python generate.py --all

# Generate specific category
python generate.py --category weapons
python generate.py --category armor
python generate.py --category consumables
python generate.py --category monsters
python generate.py --category fragments

# Generate a single item by name
python generate.py --item "Crystal Blade"

# Use a trained LoRA (after training)
python generate.py --test --lora your-lora-id

# Train a LoRA from existing art
python train_lora.py
```

## Pipeline
1. `train_lora.py` — Train a Flux Dev LoRA on existing game art (~$1.85, ~2 min)
2. `generate.py` — Batch generate images using the trained LoRA
3. `postprocess.py` — Remove backgrounds, resize, optimize

## Cost
- LoRA training: ~$1.85
- Per image (Flux Dev): ~$0.025
- Background removal: ~$0.0005/image
- 189 missing items: ~$5
