# Contributing to Ultimate Dominion

Thank you for your interest in contributing. Ultimate Dominion is fully open source and we welcome contributions across contracts, client, infrastructure, and documentation.

## Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

## Getting Started

1. **Fork and clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/ultimate-dominion.git
   cd ultimate-dominion
   pnpm install
   ```

2. **Set up your environment**
   ```bash
   cp packages/client/.env.sample packages/client/.env
   cp packages/contracts/.env.sample packages/contracts/.env
   cp packages/api/.env.sample packages/api/.env
   ```

3. **Start local development**
   ```bash
   pnpm dev
   ```
   This starts Anvil (local chain), deploys contracts, and runs the client at `http://localhost:3000`.

4. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Project Structure

```
packages/
  contracts/    Solidity systems (MUD v2), tables, deploy scripts
  client/       React 18 + Chakra UI frontend
  api/          Express API on Vercel
  indexer/      Custom MUD indexer
  relayer/      Gas relayer (5 EOA pool)
  guide/        Player-facing Astro site
```

## Where to Contribute

### Smart Contracts

The MUD schema in `mud.config.ts` includes **121 pre-defined tables** for future features that don't have systems yet. Check [`docs/ROADMAP.md`](docs/ROADMAP.md) to see what's available to build.

**Before writing a new system:**
- Read [`docs/architecture/SYSTEM_ARCHITECTURE.md`](docs/architecture/SYSTEM_ARCHITECTURE.md)
- Read [`docs/architecture/ACCESS_CONTROL.md`](docs/architecture/ACCESS_CONTROL.md)
- Read [`docs/architecture/TOKEN_GUIDE.md`](docs/architecture/TOKEN_GUIDE.md)
- Check that `PauseLib.requireNotPaused()` is on all player-facing entry points
- Check access control — admin functions must use `_requireSystemOrAdmin()`

**Testing:**
```bash
cd packages/contracts
forge test
```

### Client (React)

- Read [`docs/architecture/frontend_guidelines.md`](docs/architecture/frontend_guidelines.md) for the design system
- Read [`docs/APP_FLOW.md`](docs/APP_FLOW.md) for the current UX flow
- Follow the crypto abstraction principle: **no wallet addresses, gas fees, chain IDs, or transaction hashes in the UI**
- Mobile-first — if it doesn't work on a phone browser, it doesn't ship

**Building:**
```bash
cd packages/client
pnpm build
```

### Documentation

- Developer docs live in `docs/`
- Player-facing guide lives in `packages/guide/`
- When updating game mechanics, update both
- All docs should have a `*Last updated: [date]*` footer

### Bug Fixes

Check the [issues](https://github.com/ultimate-dominion/ultimate-dominion/issues) for bugs labeled `good first issue`. The [`docs/operations/ERROR_REFERENCE.md`](docs/operations/ERROR_REFERENCE.md) is helpful for understanding error codes.

## Development Guidelines

### Code Style

- **Solidity**: Follow existing patterns. Use named imports. Keep systems under 24KB.
- **TypeScript**: ESLint + Prettier configs are in the repo. Follow existing patterns.
- **Commits**: Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`)
- **Scope**: One feature or fix per PR. Don't bundle unrelated changes.

### Security

This is an on-chain game managing real assets. Security is not optional.

- Check for reentrancy, integer overflow, and access control on every contract change
- Never hardcode private keys or secrets
- Validate all user input at system boundaries
- Read [SECURITY.md](SECURITY.md) for the full security policy
- **Report vulnerabilities privately** — never in a public issue

### Game Design

Every change should pass the manifesto test: *"Does this make the world more permanent, more player-driven, and more worth coming back to in a year?"*

Read [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md) for canonical game mechanics.

## Pull Request Process

1. Ensure tests pass:
   - `forge test` for contract changes
   - `pnpm build` in `packages/client` for frontend changes
2. Fill out the PR template completely
3. Link related issues
4. Include screenshots for UI changes
5. One approval required for docs, two for contract or security changes

## Getting Help

- Open a [GitHub Discussion](https://github.com/ultimate-dominion/ultimate-dominion/discussions)
- Check [`docs/INDEX.md`](docs/INDEX.md) for the full documentation map
- Check [`docs/operations/ERROR_REFERENCE.md`](docs/operations/ERROR_REFERENCE.md) for debugging

---

*Last updated: March 9, 2026*
