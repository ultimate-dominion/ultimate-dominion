# Worktree Workflow

One-page cheat sheet for how Ultimate Dominion work flows through git worktrees, enforced by Claude Code hooks.

## Mental model

**One worktree = one branch = one workstream.** Worktrees are pinned to their branch for life. When a workstream is done, retire the whole thing (worktree + branch) together. Never branch-hop inside a worktree, never start feature work in the main checkout.

- **Main checkout** (`~/ultimate-dominion`) — for prod operations, reviewing merged state, coordination. Stays on `main` or `dev`. No feature work.
- **Worktrees** (`~/ultimate-dominion/.claude/worktrees/<name>`) — all feature work lives here, one per branch.

## The commands you'll actually use

| I want to... | Run this |
|---|---|
| Start new work | `./scripts/setup-worktree.sh <name> [base-branch]` |
| Resume a worktree | `cd .claude/worktrees/<name> && claude -w` |
| See worktree health | `bash ~/.claude/scripts/wt-audit.sh` |
| Finish a worktree | `/handoff` (preferred) or `bash ~/.claude/scripts/wt-done.sh <branch>` |
| Bypass an enforcement hook | Prefix with `WT_OVERRIDE=1` |

## Lifecycle

```
1. setup-worktree.sh balance-sim dev
     → .claude/worktrees/balance-sim/  (worktree/balance-sim branch)

2. cd into it, launch claude, work, commit, push to dev

3. PR → merge to dev

4. /handoff  (or wt-done worktree/balance-sim)
     → audit runs, confirms merged, removes worktree + branch,
       self-heals SESSION.md, writes HANDOFF_*.md, archives
```

## What's blocked (and why)

These are enforced by `~/.claude/scripts/wt-enforce.sh`:

| Command | Where | Why blocked |
|---|---|---|
| `git checkout -b` / `git switch -c` | everywhere | Use `setup-worktree.sh` so the new branch gets its own worktree |
| `git worktree remove` | everywhere | Use `wt-done.sh` — has dirty-state + merged-PR safety checks |
| `git branch -d` / `-D` | everywhere | Use `wt-done.sh` |
| `git checkout <branch>` | in a worktree | Worktrees are pinned — start a session in a different worktree |
| `git checkout <feature-branch>` | in main checkout | Feature work belongs in a worktree |

Always allowed:
- `git checkout main` / `dev` / `master` (in main checkout)
- `git checkout -- <path>` / `git checkout <sha> -- <path>` (path restore)
- `git worktree list` / `add` / `prune`
- `git branch -a` / listing operations
- All non-git operations

**Escape hatch:** prefix any command with `WT_OVERRIDE=1` when you genuinely need to bypass. Example: `WT_OVERRIDE=1 git checkout abc123def` for archaeology.

## What the SessionStart audit shows you

Every new Claude session injects a `<worktree-audit>` block at the top showing:

- All active worktrees with branch, dirty-file count, ahead/behind `dev`
- Local branches with no worktree (stragglers)
- SESSION.md drift (entries pointing to worktrees that no longer exist)
- Main checkout sanity warnings (on a feature branch? dirty?)

If anything is flagged there, act on it before starting new work.

## The /handoff phases

`/handoff` now runs 9 phases in order. The first four are cleanup; the rest preserve the existing write/archive/direction flow:

0. Commit any uncommitted work
1. Run `wt-audit` and embed output in the HANDOFF doc
2. Retire merged branches via `wt-done` (with per-branch confirmation)
3. Self-heal SESSION.md drift
4. Resolve main-checkout sanity warnings
5. Write `HANDOFF_[task-slug].md` to repo root
6. Copy to archive + add Obsidian wiki-links
7. Run `mem handoff <project>` to regenerate direction snapshot
8. Update SESSION.md to post-cleanup state
9. Delete HANDOFF file from repo root, suggest `/clear` prompt

## Dirty-state chime

When Claude finishes a response with uncommitted files, macOS notification fires with title `Claude Code — UNCOMMITTED` and the Basso sound. This is the closest substitute for hooking `/clear` (slash commands are client-side and can't be hooked). If you hear it, commit or `/handoff` before clearing.

## Concurrent session discipline

You run 2-4 Claude/Codex sessions at once. Rules:

- **One session per worktree.** Multiple sessions in the same worktree will collide on file writes — no hook catches this.
- **Different worktrees = isolated.** Session A in `worktree/alpha` and session B in `worktree/beta` won't interfere.
- **Codex is not enforced.** These hooks live in `~/.claude/settings.json` — Codex runs its own config. Keep worktree discipline there manually.
- **Every session sees the shared state.** SessionStart injects the same audit everywhere — if session A left a mess, session B sees it immediately.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `BLOCKED [create-branch]` | Typed `git checkout -b` or `git switch -c` | Use `setup-worktree.sh` |
| `BLOCKED [worktree-switch]` | Tried to switch branches inside a worktree | Launch a session in a different worktree instead |
| `BLOCKED [main-switch]` | Tried to check out a feature branch in main checkout | Create a worktree for it |
| `BLOCKED [branch-delete]` | Ran `git branch -D` manually | Use `wt-done <branch>` |
| `wt-done: ERROR: worktree has N dirty files` | Unpushed changes in the worktree | Commit, push, or stash first |
| `wt-done: ERROR: branch has N commits not on dev and no merged PR` | Work never landed | Push + merge the PR, or use WT_OVERRIDE if you really want to lose the commits |
| SessionStart audit shows stale SESSION.md entries | Old worktrees removed without updating SESSION.md | Run `wt-audit` and manually trim, or let next `/handoff` self-heal |

## Related files

- `~/.claude/scripts/wt-audit.sh` — worktree health audit
- `~/.claude/scripts/wt-done.sh` — safe worktree retirement
- `~/.claude/scripts/wt-enforce.sh` — PreToolUse Bash enforcement hook
- `~/.claude/commands/handoff.md` — 9-phase handoff protocol
- `~/.claude/settings.json` — hook registration
- `scripts/setup-worktree.sh` (repo) — new worktree bootstrap
