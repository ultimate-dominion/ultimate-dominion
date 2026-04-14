Delegate to the `handoff` agent to execute the full handoff protocol. Pass it all context about what was accomplished this session, what's in progress, and any blockers.

The handoff agent will:
1. Gather git state (status, diff, recent log)
2. Write HANDOFF_[task-slug].md to repo root
3. Archive to ~/Documents/ultimate-dominion/docs/handoffs/YYYY-MM-DD_[task-slug].md
4. Update SESSION.md (remove completed tasks, keep active ones)
5. Update today's Obsidian daily note via MCP
6. Delete the handoff file from repo root
7. Output the summary

After it completes, tell Michael to `/clear`.
