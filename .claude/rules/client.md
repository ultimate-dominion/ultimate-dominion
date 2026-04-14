---
paths:
  - packages/client/**/*.ts
  - packages/client/**/*.tsx
  - packages/client/**/*.css
---

# Client / Frontend Rules

## Performance
- This is a browser game — speed is a feature. Every interaction should feel instant.
- Never add blocking operations to the UI thread. All chain reads/writes must be async with loading states.
- Be mindful of bundle size. Lazy-load routes. Don't add heavy dependencies without justification.
- Test that any UI change remains responsive on mobile browsers.

## Usability & Crypto Abstraction
- All UI must work without crypto knowledge. Follow `docs/architecture/frontend_guidelines.md`.
- Never expose wallet addresses, transaction hashes, gas fees, or chain IDs to the player.
- Every action needs clear feedback: loading states, success confirmations, error messages with recovery steps.
- Mobile-first — if it doesn't work on a phone browser, it doesn't ship.

## Security
- No `dangerouslySetInnerHTML`, no `eval`, no user-controlled URLs without validation.
- Validate `chainId` against `supportedChains`.

## Player-Facing Copy
Any text that appears in the game — item descriptions, system messages, patch notes, NPC dialogue, UI labels — must sound like a specific person wrote it. No generic AI language. If a player can tell AI wrote it, it failed.

## SEO (Public Pages Only)
When adding a new page:
1. Import `{ Helmet } from 'react-helmet-async'`
2. Add `<Helmet><title>Page Name | Ultimate Dominion</title></Helmet>`
3. If public (no auth): add to `sitemap.xml`
4. If authenticated/private: add to `Disallow` in `robots.txt`

Canonical domain: `https://ultimatedominion.com`. No SEO needed for beta.
