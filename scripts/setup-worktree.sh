#!/usr/bin/env bash
# setup-worktree.sh — Create and configure a UD worktree for Claude Code
#
# Usage:
#   ./scripts/setup-worktree.sh <name> [branch]
#
# Examples:
#   ./scripts/setup-worktree.sh balance-sim dev
#   ./scripts/setup-worktree.sh guild-buffs feat/guild-stat-buffs
#   ./scripts/setup-worktree.sh chat-system   # defaults to new branch worktree/<name>
#
# What it does:
#   1. Creates git worktree at .claude/worktrees/<name>
#   2. Symlinks all .env files from main repo
#   3. Symlinks project memory directory so UD gotchas/feedback load
#   4. Runs pnpm install
#   5. Runs MUD codegen

set -euo pipefail

MAIN_REPO="$(cd "$(dirname "$0")/.." && pwd)"
WORKTREE_DIR="$MAIN_REPO/.claude/worktrees"
MEMORY_SRC="$HOME/.claude/projects/-Users-michaelorourke-ultimate-dominion/memory"

if [ $# -lt 1 ]; then
  echo "Usage: $0 <name> [branch]"
  echo "  name:   worktree name (e.g., balance-sim, guild-buffs)"
  echo "  branch: existing branch to check out (default: creates worktree/<name> from HEAD)"
  exit 1
fi

NAME="$1"
BRANCH="${2:-}"
WT_PATH="$WORKTREE_DIR/$NAME"

# --- Step 1: Create worktree ---
if [ -d "$WT_PATH" ]; then
  echo "Worktree already exists at $WT_PATH"
  echo "To remove: git worktree remove $WT_PATH"
  exit 1
fi

mkdir -p "$WORKTREE_DIR"

if [ -n "$BRANCH" ]; then
  echo "Creating worktree '$NAME' on branch '$BRANCH'..."
  git -C "$MAIN_REPO" worktree add "$WT_PATH" "$BRANCH"
else
  echo "Creating worktree '$NAME' on new branch 'worktree/$NAME'..."
  git -C "$MAIN_REPO" worktree add "$WT_PATH" -b "worktree/$NAME"
fi

# --- Step 2: Symlink .env files ---
echo "Symlinking .env files..."

symlink_env() {
  local rel_path="$1"
  local src="$MAIN_REPO/$rel_path"
  local dst="$WT_PATH/$rel_path"
  if [ -f "$src" ]; then
    mkdir -p "$(dirname "$dst")"
    ln -sf "$src" "$dst"
    echo "  $rel_path"
  fi
}

# Root env
symlink_env ".env"

# Contracts env files
for f in .env .env.mainnet .env.testnet; do
  symlink_env "packages/contracts/$f"
done

# Client env files
for f in .env .env.development .env.development.local .env.production .env.staging; do
  symlink_env "packages/client/$f"
done

# --- Step 3: Symlink project memory ---
echo "Symlinking project memory..."
# Compute the memory path Claude Code would use for this worktree CWD
# and symlink it to the main project's memory so all gotchas/feedback load
WT_SLUG=$(echo "$WT_PATH" | sed 's|/|-|g' | sed 's|^-||')
WT_MEMORY_DIR="$HOME/.claude/projects/$WT_SLUG/memory"

if [ -d "$MEMORY_SRC" ]; then
  mkdir -p "$(dirname "$WT_MEMORY_DIR")"
  if [ -L "$WT_MEMORY_DIR" ]; then
    echo "  Memory symlink already exists"
  elif [ -d "$WT_MEMORY_DIR" ]; then
    echo "  WARNING: Memory dir exists and is not a symlink. Backing up..."
    mv "$WT_MEMORY_DIR" "$WT_MEMORY_DIR.bak.$(date +%s)"
    ln -sf "$MEMORY_SRC" "$WT_MEMORY_DIR"
    echo "  Symlinked to main project memory"
  else
    ln -sf "$MEMORY_SRC" "$WT_MEMORY_DIR"
    echo "  Symlinked to main project memory"
  fi
else
  echo "  WARNING: Source memory dir not found at $MEMORY_SRC"
fi

# --- Step 4: Install dependencies ---
echo "Running pnpm install..."
cd "$WT_PATH"
pnpm install --frozen-lockfile 2>&1 | tail -3

# --- Step 5: MUD codegen ---
echo "Running MUD codegen..."
pnpm mud codegen 2>&1 | tail -3

echo ""
echo "Worktree ready at: $WT_PATH"
echo "Start a session:   cd $WT_PATH && claude"
echo "Or use:             cd $WT_PATH && claude -w"
echo ""
echo "When done:"
echo "  git worktree remove $WT_PATH"
