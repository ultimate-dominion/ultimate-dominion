#!/bin/bash
# Temper context injection — fires on every user prompt via UserPromptSubmit hook.
# Injects active session state and advisor roster so they stay visible during work.

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0

SESSION_JSON=$(cd "$REPO_ROOT" && pnpm exec temper session show --json 2>/dev/null)
[ -z "$SESSION_JSON" ] && exit 0

NEXT=$(echo "$SESSION_JSON" | node -e "
  let d='';
  process.stdin.on('data',c=>d+=c);
  process.stdin.on('end',()=>{
    try {
      const j = JSON.parse(d);
      const e = j.sessionState?.entries?.[0];
      if (e) console.log(e.workstream + ' | ' + e.status + ' | next: ' + e.next);
    } catch(e) {}
  });
" 2>/dev/null)

[ -z "$NEXT" ] && exit 0

cat <<EOF
--- Temper ---
Session: $NEXT
Advisors: 🎯 Kaplan · ♟️ Meier · 🔧 Carmack — surface at design, arch, and risk moments
coach (before designing) · ship lite (after building) · handoff (wrap up)
-------------
EOF
