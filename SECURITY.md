# Security Policy

Ultimate Dominion is an on-chain game managing real assets (ERC20 tokens, ERC721 characters, ERC1155 items) on Base Mainnet. Security vulnerabilities can result in loss of player assets. We take security seriously.

## Reporting a Vulnerability

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, report vulnerabilities to: **security@ultimatedominion.com**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact (which contracts/systems are affected, estimated asset risk)
- Suggested fix (if you have one)

We will acknowledge receipt within 48 hours and provide a timeline for resolution.

## Scope

### In Scope

| Area | Examples |
|------|---------|
| Smart contracts | Reentrancy, access control bypass, integer overflow, storage collisions |
| MUD World access | Unauthorized system calls, namespace permission escalation |
| Token contracts | Unauthorized minting, transfer manipulation, balance corruption |
| Game logic | Gold duplication, item duplication, XP exploits |
| API | Authentication bypass, rate limit evasion, input injection |
| Client | XSS, credential exposure, private key leakage |
| Relayer | Nonce manipulation, wallet pool drainage, unauthorized gas spending |

### Out of Scope

- Game balance issues (these are bugs, not security — file a regular issue)
- Social engineering attacks
- Denial of service against public RPC endpoints
- Vulnerabilities in third-party dependencies (report to the upstream project)
- Issues in development/test environments only

## What NOT to Do

- Do not exploit vulnerabilities on mainnet (production or beta)
- Do not access or modify other players' data or assets
- Do not perform denial-of-service attacks
- Do not social engineer team members or players

## Disclosure Policy

We follow coordinated disclosure:
1. Reporter submits vulnerability privately
2. We confirm and assess severity
3. We develop and test a fix
4. We deploy the fix
5. We publicly disclose the vulnerability (with credit to the reporter, if desired)

We aim to resolve critical vulnerabilities within 7 days and high-severity within 30 days.

## Smart Contract Specifics

Our contracts use the MUD v2 World framework. Key security considerations:
- All game systems share the `UD` namespace — a compromised system can write to any table in that namespace
- Admin functions are gated by the `Admin` table — verify access control on every new system
- The `PauseLib.requireNotPaused()` check must be present on all player-facing entry points
- System upgrades create new contract addresses — data keyed by `address(this)` is orphaned

See `docs/architecture/ACCESS_CONTROL.md` for the full access control map.

---

*Last updated: March 9, 2026*
