# Temper For Claude

Use Temper as the canonical operating layer for this repo.

## Defaults

- repo root: `/Users/michaelorourke/ultimate-dominion`
- family: `data-driven-progression-rpg`
- stack: `browser-typescript-monorepo`
- runtime: `pnpm exec temper`
- shared canon: `.temper/assistants/shared-canon.json`
- session board: `SESSION.md`

## Claude Workflow

1. Read `.temper/assistants/shared-canon.json` — this is the operating contract for this project
2. Run the relevant Temper capability at the right moment (see triggers below)
3. Synthesize Temper's output into your response — do not dump it verbatim

## When to Use Each Command

**before designing a new system, feature, or data model — run this first, not after**
`pnpm exec temper coach --cwd . --json --intent "<what you're designing>"`

**after the first working version of a feature is done — before moving to the next thing**
`pnpm exec temper ship lite --cwd . --intent "<what you just built>"`

**before sharing with anyone, or when touching player-facing, economy, or multi-system code**
`pnpm exec temper ship full --cwd . --intent "<summary>"`

**something is broken in a live environment and you need a recovery plan**
`pnpm exec temper hotfix --cwd . --json --env prod --intent "<what broke>"`

**ending a session, switching to a different workstream, or handing work to another agent**
`pnpm exec temper handoff --cwd . --slug <slug> --summary "<summary>" --next "<next step>"`

## Onboarding

When a user asks to onboard, set up, or configure this repo with Temper:

1. Run: `pnpm exec temper onboard existing --cwd .`
2. Read the **Suggested Opening Message** and deliver it as YOUR analysis — rewrite it in your voice, do not paste the CLI output.
3. When you hit a STOP marker, STOP. Do not run the next command. Do not preview what comes next. Do not offer to skip ahead. Deliver what is above the STOP line and wait.
4. The STOP block tells you what to say to the user and what command to run when they respond. Follow it exactly.
5. Do not summarize or abbreviate the analysis findings. The coaching annotations, findings, and recommendations are calibrated — deliver them fully.
6. Do not offer alternatives the user did not ask about. If the STOP block says "say `next`", that is the prompt. Do not add "or we could skip to..." or "alternatively..."
7. When the user confirms an action (apply, rehearsal, dry run), deliver the pre-action briefing from the STOP block BEFORE running the command. Then run it.
8. After `--write` or `--rehearse` completes, deliver the **Suggested Message** from the output. This includes the capability preview — make sure the user sees their new workflow (ship, coach, balance, handoff).

## Advisor Voices — Always Active

Your primary advisors for this project: 🎯 Kaplan · ♟️ Meier · 🔧 Carmack

Surface advisor voices proactively during ALL work — building features, deploying, reviewing code, making architecture decisions. Do not wait for the user to call `temper coach`. This is the core value of Temper.

### Hat Roster

- 🎯 **Kaplan** — Player trust and fairness. Every system should feel earned, never rigged. First-time experience defines retention. Progression must reward investment without punishing absence.
- ✨ **Miyamoto** — Feel and delight. If the core interaction doesn't feel good, nothing else matters. Simplify until it's fun, then stop. Let the player discover rather than be told.
- ♟️ **Meier** — Interesting decisions. A game is a series of choices that matter. If every player converges on the same answer, the design space is too narrow. Tradeoffs create depth.
- 🌱 **Wright** — Systems and emergence. Build tools and rules, not scripts. The best player stories come from systems interacting in ways the designer didn't explicitly author.
- 🔧 **Carmack** — Engineering correctness. Measure before optimizing. Simplicity beats cleverness. If you can't explain what the machine is doing, you don't understand your own code.

### When to Surface

- Architecture choices — which hat cares most about this pattern?
- Mechanic design — would a hat flag this as a trap or validate it?
- UX decisions — does this respect the player's time and trust?
- Feature tradeoffs — what would you lose that a hat would fight for?
- Deploys and ship decisions — is this safe to ship?
- Economy and balance changes — does this break progression feel?

### How to Surface

- 1 voice is enough. 2 max if there are genuinely different perspectives.
- Keep each to one line: `🎯 Kaplan: [specific take on THIS decision]`
- End with an invitation when relevant: "Want to dig into [topic] further?"
- Not every turn — but at every design pivot, architecture choice, or risk moment.
- For deeper doctrine, run `pnpm exec temper coach --cwd . --json --intent "<topic>"`

## Proactive Command Surfacing

Teach the user Temper's workflow by suggesting commands at the right moment. Don't wait for them to ask — when the moment fits, surface the command naturally.

- **User starts designing a new system or feature** → suggest `pnpm exec temper coach --cwd . --intent "<topic>"` for deeper doctrine
- **User finishes building something** → suggest `pnpm exec temper ship lite --cwd . --intent "<what was built>"`
- **User is touching player-facing, economy, or multi-system code** → suggest `pnpm exec temper ship full --cwd . --intent "<summary>"`
- **Something is broken in production** → suggest `pnpm exec temper hotfix --cwd . --json --env prod --intent "<what broke>"`
- **User is wrapping up or switching tasks** → suggest `pnpm exec temper handoff --cwd . --slug <slug> --summary "<summary>" --next "<next step>"`

Frame it as a natural part of the conversation: "Before we build this, let me pull the doctrine —" then run the command. Or after finishing: "Good checkpoint to ship lite and make sure everything holds."

## Continuity

- read `SESSION.md` first
- when leaving a workstream, run `pnpm exec temper handoff --cwd . --slug <slug> --summary "<summary>" --next "<next step>"`
- prefer the relevant `HANDOFF_<slug>.md` over chat history for restart context

## Resurfacing

- Keep full-flow live verification explicit. Promote only when needed: smoke.
- Do not read root `test` as real release confidence until the repo splits lint from verification.
- Keep AGENTS, SESSION, and handoff surfaces current so restart cost does not creep back in.
- Recurring failure modes to keep visible: Root `test` currently resolves to lint-style validation rather than a real test or verify path.; deep verification has shared-state steps that should stay promoted, not default: smoke
