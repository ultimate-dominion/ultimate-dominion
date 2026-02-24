# Ultimate Dominion — Go-to-Market

Marketing plan — SEO, owned channels, distribution, content strategy, press, and priority action plan.

> **Status Key**: `[IMPLEMENTED]` = done, `[PLANNED]` = designed but not built

---

## Table of Contents

1. [Owned Channels Strategy](#owned-channels-strategy)
2. [Public Documentation Site](#public-documentation-site)
3. [SEO Audit & Action Plan](#seo-audit--action-plan)
4. [Content Marketing Strategy](#content-marketing-strategy)
5. [Distribution Channels](#distribution-channels)
6. [Messaging by Audience](#messaging-by-audience)
7. [Press & Influencers](#press--influencers)
8. [Metrics & Success Criteria](#metrics--success-criteria)
9. [Priority Action Plan](#priority-action-plan)

---

## Owned Channels Strategy

**Core principle**: Build on platforms you own first. Rented audiences (Reddit, Twitter followers) can disappear. Owned channels compound.

### 1. Public Docs Site (`docs.ultimatedominion.com`) `[PLANNED]`

See [Public Documentation Site](#public-documentation-site) section below. This is the highest-ROI SEO investment — dozens of indexable pages from content that already exists.

### 2. Discourse Forum (`forum.ultimatedominion.com`) `[PLANNED]`

**When to launch**: Day one — available from the start alongside the beta. Seed it with announcements, patch notes, and a beginner's guide so it doesn't feel empty. Early players who see an active forum with developer presence are more likely to post.

**Why Discourse:**
- Server-rendered HTML — strong SEO out of the box
- Built-in sitemap generation, clean URLs, structured data
- Sign-In with Ethereum (SIWE) plugin: https://github.com/spruceid/discourse-siwe-auth
- DiscourseConnect SSO can bridge Thirdweb auth for embedded wallet users
- One-click updates from admin panel (solo dev friendly)
- Trust levels auto-moderate new users (reduces moderation burden)
- Cost: ~$12–24/month self-hosted on DigitalOcean/Hetzner

**Alternatives considered:**
- XenForo: Best raw SEO (pure PHP server-render), $160 license, no web3 plugins
- NodeBB: Good Node.js option, smaller ecosystem, no web3 plugins
- Flarum: Too young, relies on extensions for basic SEO
- Custom Next.js forum: 3–6 months build time — not worth the opportunity cost

**Forum Structure** (seed categories at launch, expand as needed):

```
ULTIMATE DOMINION FORUMS
|
|-- Announcements & News
|   |-- Patch Notes
|   |-- Developer Blogs
|
|-- Game Discussion
|   |-- General Discussion
|   |-- Classes & Builds (high SEO value)
|   |-- Strategy & Tactics
|   |-- Lore & World Building
|   |-- Suggestions & Feedback
|
|-- Guides & Knowledge Base
|   |-- Beginner's Guide
|   |-- Economy & Trading Guides
|   |-- Wiki-style Collaborative Posts
|
|-- Community
|   |-- PvP Rankings & Leaderboard Discussion
|   |-- Fan Art & Creative Content
|   |-- Off-Topic / The Tavern
|
|-- Support
|   |-- Bug Reports
|   |-- Technical Support
```

**Complementary channels** (alongside the forum):
- In-game chat (Push Protocol, badge-gated) `[IMPLEMENTED]`
- Email list for patch notes and announcements

### 3. X/Twitter `[PLANNED]`

Primary social channel. See [Content Marketing Strategy](#content-marketing-strategy) for cadence and content plan.

### 4. Farcaster / Warpcast `[PLANNED]`

Secondary social channel. Built on Base — massive overlap with target audience.
- DEGEN tipping token rewards creators
- Farcaster Frames for inline game interaction
- URL: https://warpcast.com/

### 5. In-Game Chat `[IMPLEMENTED]`

Push Protocol integration, badge-gated (Level 3 = Adventurer badge). This is where early community forms before external channels exist.

### 6. Email List `[PLANNED]`

Capture emails on the landing page for patch notes, events, and re-engagement. Critical for bringing back lapsed players. Options: Buttondown (free tier, developer-friendly), Resend, or Discourse's built-in mailing list.

---

## Public Documentation Site `[PLANNED]`

### Why This Matters for SEO

The game client is a React SPA — Google sees a blank page. A public docs site is **server-rendered HTML by default**, meaning every page is immediately indexable. The content already exists in the `docs/` markdown files.

### What to Publish vs Keep Internal

**Public (player-facing):**

| Source Doc | Public Page | SEO Keywords |
|-----------|-------------|--------------|
| GAME_DESIGN.md (classes) | Classes & Builds Guide | "browser MMORPG classes", "fantasy RPG class builds" |
| GAME_DESIGN.md (combat) | Combat System Guide | "browser game combat system", "PvP combat mechanics" |
| GAME_DESIGN.md (items) | Items & Equipment | "MMORPG item rarity tiers", "fantasy RPG equipment" |
| ECONOMICS.md | Economy Guide | "game economy design", "player marketplace" |
| COMBAT_SYSTEM.md | Combat Formulas | "RPG damage formula", "combat triangle system" |
| BADGE_SYSTEM.md | Achievements & Badges | "game achievement system", "badge unlocks" |
| LORE_BIBLE.md | World Lore | "fantasy game lore", "dark fantasy worldbuilding" |
| LORE_NFT_FRAGMENTS.md | Lore Fragments Guide | "collectible lore system", "story fragments" |
| (new) Beginner's Guide | Getting Started | "free browser MMORPG", "how to play Ultimate Dominion" |
| (new) FAQ | Frequently Asked Questions | "Ultimate Dominion FAQ", "browser MMO help" |
| Manifesto | Our Manifesto | "indie MMORPG manifesto", "player-owned game" |

**Internal (keep in repo only):**
- architecture/ (SYSTEM_ARCHITECTURE, TECH_STACK, FRONTEND_GUIDELINES)
- combat-stats/COMBAT_BALANCE.md (internal tuning data)
- LAUNCH_STRATEGY.md (anti-abuse mechanisms)
- launch_checklist.md
- processes/

### Recommended Tool: Docusaurus

| Tool | Pros | Cons |
|------|------|------|
| **Docusaurus** | React-based (matches stack), excellent SEO, versioning, search, MDX support | Slightly heavier than alternatives |
| Nextra | Next.js-based, clean, lightweight | Smaller ecosystem |
| Mintlify | Beautiful out of the box, hosted | Paid for custom domains |
| VitePress | Vue-based, fast | Different ecosystem from React |
| Starlight (Astro) | Fastest builds, great SEO | Less React integration |

**Recommendation**: Docusaurus. It's React-based (matches the game client stack), has built-in search (Algolia DocSearch is free for open-source), generates a sitemap automatically, and supports MDX so you can embed interactive components later.

### Setup Plan

1. Create `packages/docs` in the monorepo
2. Install Docusaurus, configure for `docs.ultimatedominion.com`
3. Copy and adapt public-facing docs from `docs/` — rewrite for player audience (remove technical jargon, add examples, add screenshots)
4. Add Beginner's Guide and FAQ as new pages
5. Deploy to Vercel, add `docs` CNAME in Cloudflare
6. Submit sitemap to Google Search Console

### Content Expansion (Ongoing)

Every new game feature should ship with a docs page:
- New zone → zone guide with maps, mob list, level recommendations
- New items → item database entries with stats, drop locations, rarity
- New class abilities → class build guides
- Balance changes → patch notes on both forum and docs

---

## SEO Audit & Action Plan

The client is a pure CSR React SPA (Vite + React 18 + Chakra UI). Crawlers see a blank page until JS loads.

| Issue | Severity | Status | Action |
|-------|----------|--------|--------|
| No meta description, OG tags, or Twitter cards | HIGH | Missing | Do before first public post |
| No robots.txt or sitemap.xml | HIGH | Missing | Do before first public post |
| No SSR/prerendering | CRITICAL | Missing | Docs site solves this for public pages |
| No dynamic meta tags (every page has identical title) | HIGH | Missing | Add react-helmet-async |
| No structured data (JSON-LD/schema.org) | MEDIUM | Missing | Add Game + Organization schema |
| Large JS bundle | MEDIUM | Needs optimization | Lazy-load routes, tree-shake |
| No react-helmet or equivalent | HIGH | Missing | Add react-helmet-async |
| Source maps shipped to production | MEDIUM | Should disable | Set `sourcemap: false` in vite.config.ts |
| URL structure | OK | Clean | /marketplace, /characters/:id, /leaderboard |
| Vercel Analytics | OK | `[IMPLEMENTED]` | — |
| No landing page for link sharing | HIGH | Missing | Build landing page or enhance Welcome |

### Pre-Launch SEO Checklist (Do Before Any Public Post)

These are 1–2 hours of work total. Every future link share benefits from them:

- [ ] Add `react-helmet-async` — per-route title, description, OG image, Twitter card
- [ ] Add `robots.txt` to `public/` (allow all, link to sitemap)
- [ ] Add `sitemap.xml` to `public/` (static for now: /, /manifesto, /leaderboard, /marketplace)
- [ ] Create 1200x630px OG image for social sharing
- [ ] Add JSON-LD structured data (VideoGame schema, Organization)
- [ ] Set `sourcemap: false` in `vite.config.ts` for production builds
- [ ] Add canonical URL tags (`<link rel="canonical">`)
- [ ] Add alt tags to all images
- [ ] Build landing page or enhance Welcome page with game description + screenshots

### Longer-Term SEO

- Public docs site at `docs.ultimatedominion.com` (see above)
- Discourse forum at `forum.ultimatedominion.com` (server-rendered, auto-indexed)
- Dynamic OG image generation for character/item cards (API endpoint using Sharp — already in dependencies)
- Prerendering for Leaderboard, Character profiles, Marketplace items (via Vercel ISR or prerender.io)
- Submit to Google Search Console once docs site is live

### SEO Guerilla Tactics

- **Docs site**: Every page is a long-tail keyword target (item database, class builds, combat guides)
- **Quora/Arqade answers**: Answer "What are the best browser MMORPGs?" with genuine helpful answers that link to docs
- **Comparison pages**: "On-Chain Games Like Dark Forest" or "Best Browser MMORPGs in 2026" (publish on docs site blog)
- **Directory backlinks**: Every listing (PBBG, IndieDB, DappRadar, etc.) is a backlink improving domain authority
- **Forum threads**: Discourse threads get indexed — "Classes & Builds" discussions become organic search results

---

## Content Marketing Strategy

### Owned Channel Priority

1. **Docs site** — permanent, indexable, compounds over time
2. **Discourse forum** — community-generated content, auto-indexed
3. **X/Twitter** — distribution and engagement
4. **Farcaster** — web3 audience overlap
5. **Medium/blog** — cross-posted long-form content

### X/Twitter Strategy `[PLANNED]`

**Cadence:**

| Day | Hashtag | Content |
|-----|---------|---------|
| Wednesday | #WIPWednesday | Work-in-progress shots |
| Saturday | #ScreenshotSaturday | Gameplay GIF (6–15 seconds) |
| Anytime | #gamedev #indiedev #web3gaming | Technical threads, bug showcases, milestone posts |

**First 10 Posts** (pre-write these before launching the account):

1. Introduction thread: "I'm building a browser MMORPG where everything is permanent..." (link to manifesto)
2. #ScreenshotSaturday: Combat GIF showing PvP with gold stakes
3. Technical thread: "How I designed a combat system entirely on-chain"
4. Lore teaser: First fragment text with atmospheric screenshot
5. Dev log: "Week 1 update — what I shipped, what broke, what's next"
6. Class system explainer with visual of the 9 advanced classes
7. #WIPWednesday: Map exploration GIF
8. Thread: "Why I chose no Discord" (contrarian take, high engagement potential)
9. Marketplace/economy screenshot with "everything you see is player-owned"
10. Milestone post: "X players have created characters" (once live)

**Thread formats that perform well:**
- "I built X. Here's what I learned." (dev retrospective)
- "Here's a game mechanic most MMOs get wrong..." (contrarian take)
- Before/after comparisons (UI polish, balance changes)
- Short gameplay clips with context (15 seconds max)

### Dev Logs

**What to post:**
- Weekly/biweekly dev updates with screenshots/GIFs
- "How I solved X" technical posts
- Design decision retrospectives
- Monthly progress summaries with before/after
- Honest posts about challenges (perform BETTER than success stories)

**Where to cross-post:**
- Own Discourse forum → Medium → IndieDB → itch.io → Reddit (subreddit-appropriate)

### Blog/Article Ideas

**Gameplay-first** (for MUD/MMO/gaming audiences):
- "I'm Building a Browser MMORPG Where Your Choices Actually Matter"
- "Designing a PvP Economy That Doesn't Collapse"
- "What MUDs Got Right That Modern MMOs Forgot"
- "Solo Dev MMORPG: Month X Update"
- "Why Permadeath and Risk Make Games Better"

**Technical/crypto** (for Hacker News, Farcaster, web3 audiences):
- "Why I'm Building an MMORPG Entirely On-Chain"
- "The MUD Framework: Building Autonomous Worlds on Ethereum"
- "How Smart Contracts Replace Game Servers"
- "PvP Economy Design: Lessons from 20 Years of MUDs"

**Publish on**: Medium (cross-posted to Discourse blog category), link from Twitter threads.

---

## Distribution Channels

### Web3 Channels

**Base Chain Ecosystem:**
- Base Builder Grants: https://docs.base.org/get-started/get-funded (2 ETH weekly rewards, 1–5 ETH grants)
- Base Batches 2026: https://batches.base.org/ (top teams get $10K–$50K)
- Tag @base on X/Twitter and Farcaster for amplification

**Lattice / MUD Community:**
- MUD Discord — other on-chain game devs
- Lattice Newsletter: https://newsletter.lattice.xyz/
- WASD (web3 gaming publication): https://wasd.mirror.xyz/

**Gaming Guilds & DAOs:**
- Yield Guild Games (YGG): https://yieldguild.io/
- Merit Circle (Beam)
- Avocado DAO: https://www.avocadodao.io/
- Reach out to partnerships teams with working product

**Web3 Game Aggregators (list on all):**

| Platform | URL |
|----------|-----|
| DappRadar | https://dappradar.com/ |
| ChainPlay | https://chainplay.gg/ |
| PlayToEarn | https://playtoearn.com/ |
| GAM3S.GG | https://gam3s.gg/ |
| BlockchainGamer.biz | https://www.blockchaingamer.biz/blockchain-games-directory/ |
| Alchemy Dapp Store | https://www.alchemy.com/dapps |

### Non-Crypto Communities (Gameplay-First Messaging)

#### Tier 1 — Exact Audience (Do Immediately)

**PBBG.com** (Persistent Browser-Based Games)
- https://pbbg.com/ + https://discourse.pbbg.com/
- THE community for persistent browser games. Active Discourse forum.

**BrowserMMORPG.com**
- https://browsermmorpg.com/
- Vote-based ranking, actively supports small developers.

**MUD Directories:**
- MUD Connector: https://www.mudconnect.com/
- MudVerse: https://www.mudverse.com/
- MudListings: https://mudlistings.com/
- Top Mud Sites: https://www.topmudsites.com/

**MUD Coders Guild (Slack)**
- https://slack.mudcoders.com/
- Small, passionate dev community. Great for playtesters and advocates.

**r/MUD** (~20–30K members)
- Post genuine developer introduction. Most receptive subreddit.

**MMORPG.com — Indie MMO Spotlight**
- https://www.mmorpg.com/
- Weekly column that actively scouts indie MMOs. Email the columnist.

**Massively Overpowered**
- https://massivelyop.com/
- Most respected independent MMO journalism. Annual Indie MMO of the Year award.

#### Tier 2 — High-Value Niche Communities

**Royal Road** (LitRPG/GameLit)
- https://www.royalroad.com/
- 14M monthly visits. Readers literally read novels about being inside MMOs.
- Options: Serialized lore story, forum posts, platform ads.
- Angle: "Play the game you've been reading about"

**LitRPG Communities:**
- Goodreads LitRPG Forum: https://www.goodreads.com/group/show/224524-litrpg-forum
- LitRPG Legends: https://www.litrpglegends.com/
- LitRPG Forum: https://litrpgforum.com/

**Old-School MMO Nostalgia:**
- Project 1999 Forums: https://www.project1999.com/forums/ (classic EQ community)
- Fires of Heaven: https://www.firesofheaven.org/ (veteran MMO players)
- Project Gorgon community: https://forum.projectgorgon.com/ (friendly indie MMO players)
- ServUO / UO Servers: https://www.servuo.com/ (Ultima Online sandbox/PvP players)

**Play-by-Post RPG Communities:**
- RPG Crossing: https://www.rpgcrossing.com/ (30,000+ members)
- Roleplayer Guild: https://www.roleplayerguild.com/
- Gamers' Plane: https://gamersplane.com/
- Angle: "Play-by-post meets real-time MUD"

**OSR (Old School Renaissance) Discord Servers:**
- https://discord.me/osr
- Tabletop players who love hardcore mechanics, meaningful death, resource management.

**International (huge untapped):**
- OTLand: https://otland.net/ (Tibia private server community, massive in Brazil/Poland)
- TibiaKing: https://tibiaking.com/ (Brazilian Tibia community)
- RaGEZONE: https://forum.ragezone.com/ (Lineage 2, Ragnarok Online community since 2001)

#### Tier 3 — Broader Discovery

**Reddit (90/10 rule — 90% community participation, 10% promotion):**

| Subreddit | Members | Approach |
|-----------|---------|----------|
| r/MMORPG | ~338K | Dev retrospectives, not ads |
| r/IndieGaming | ~458K | Gameplay GIFs, dev journey |
| r/playmygame | ~105K | Self-promo is the point here |
| r/gamedev | ~1.9M | Technical deep-dives only |
| r/IndieDev | ~263K | WIP screenshots, progress |
| r/roguelikes | Large | If applicable — systems depth angle |
| r/roguelikedev | ~42K | Sharing Saturday, dev discussion |
| r/worldbuilding | Large | Lore entries, maps, factions |

**Hardcore Gaming Forums:**
- RPG Codex: https://rpgcodex.net/ (brutally honest, values mechanical depth)
- Quarter to Three: https://forum.quartertothree.com/ (older, knowledgeable)
- Something Awful: https://forums.somethingawful.com/ ($10 paywall = engaged members)
- NeoGAF / ResetEra (post in existing MMO threads)
- Bay 12 Forums: https://www.bay12forums.com/smf/ (Dwarf Fortress community, loves emergent gameplay)

**Game Directories (submit to all):**

| Platform | URL |
|----------|-----|
| NewRPG | https://newrpg.com/add-game/ |
| TopWebGames | https://topwebgames.com/ |
| IndieDB | https://www.indiedb.com/ |
| itch.io | https://itch.io/ |
| BestMMOs | https://bestmmos.com/indie |
| FreeToGame | https://www.freetogame.com/ |
| MMOBomb | https://www.mmobomb.com/ |
| MMOs.com | https://mmos.com/ |

**Hacker News — Show HN:**
- HIGH potential. "I built a fully on-chain MUD-style MMORPG on Base" is exactly what HN loves.
- Post Tue–Thu, 8–10 AM EST. Technical language, no marketing speak.
- URL: https://news.ycombinator.com/show

**Other Platforms:**
- Product Hunt: https://www.producthunt.com/topics/indie-games (launch on weekends)
- Indie Hackers: https://www.indiehackers.com/ (solo dev journey content)
- IntFiction.org: https://intfiction.org/ (interactive fiction hub)

---

## Messaging by Audience

| Audience | Lead With |
|----------|-----------|
| MUD players | "A modern MUD with PvP, item drops, guilds, and a living marketplace" |
| Old-school MMO vets | "Remember when MMOs were dangerous, social, and rewarding?" |
| LitRPG readers | "Play the game you've been reading about" |
| Roguelike fans | "Deep class builds, meaningful item drops, risk/reward combat" |
| TTRPG/OSR players | "A persistent world with OSR-inspired mechanics — choices matter, death has consequences" |
| Browser game players | "No download — a real MMORPG in your browser" |
| PbP/worldbuilding fans | "A living fantasy world with deep lore and player-driven history" |
| Web3/crypto native | "Fully on-chain MMORPG — your items, your gold, your world" |

---

## Press & Influencers

### Press Kit `[PLANNED]`

Create using PressKitty (https://impress.games/press-kitty). Include:
- Game summary + detailed description
- High-res screenshots, gameplay GIFs, trailer
- Character/item art as transparent PNGs
- Logo files in multiple formats
- Developer bio + photo
- Fact sheet (platform, genre, tech stack)
- Contact email + social links

### Press/Blogs

- MMORPG.com Indie MMO Spotlight: https://www.mmorpg.com/ (weekly column, actively scouts indie MMOs)
- Massively Overpowered: https://massivelyop.com/ (most respected indie MMO journalism)
- Bio Break: https://biobreak.wordpress.com/ (also writes for Massively OP)
- Dog Water Gaming: https://dogwatergaming.com/ (publishes "Top 10 Indie MMOs" lists)
- The Indie Informer: https://the-indie-in-former.com/
- Best Indie Games Newsletter: https://www.thebestindiegames.com/newsletter
- BlockchainGamer.biz: https://www.blockchaingamer.biz/
- GAM3S.GG News: https://gam3s.gg/news/
- CoinDesk Gaming, Decrypt (web3 angle)

---

## Metrics & Success Criteria `[PLANNED]`

### What to Track

| Metric | Tool | Why |
|--------|------|-----|
| Daily Active Users (DAU) | On-chain (unique wallets with tx/day) | Core health metric |
| New characters created / day | On-chain (CharacterSystem mint events) | Growth rate |
| Retention (Day 1, Day 7, Day 30) | On-chain (wallet activity over time) | Are players coming back? |
| Time-to-first-combat | On-chain (time between character mint and first encounter) | Onboarding friction |
| Session length | Vercel Analytics / custom events | Engagement depth |
| Channel attribution | UTM parameters on inbound links | Which channels drive signups |
| Docs site traffic | Google Search Console + Vercel Analytics | SEO performance |
| Forum posts / week | Discourse admin metrics | Community health |
| Twitter impressions / engagement | X Analytics | Social reach |

### Success Milestones

| Milestone | Target | Indicator |
|-----------|--------|-----------|
| Proof of life | 10 DAU | People are playing and coming back |
| Community forming | 25 DAU, 5+ forum posts/week | Players are talking to each other |
| Growth mode | 50 DAU, organic signups > 50% | Word of mouth is working |
| Sustainability | 100 DAU, marketplace active daily | Economy is self-sustaining |

### Review Cadence

- **Weekly**: Check DAU, new signups, channel attribution
- **Monthly**: Review retention curves, content performance, adjust strategy
- **Quarterly**: Full GTM strategy review, reallocate effort to winning channels

---

## Priority Action Plan

### Before First Public Post (Do Now)

1. SEO quick wins: react-helmet, robots.txt, sitemap.xml, OG image (1–2 hours)
2. Build or enhance landing page / Welcome page with game description + screenshots
3. Pre-write first 5 X/Twitter posts (see Content Strategy above)
4. Pre-write r/MUD introduction post
5. Pre-write Farcaster introduction thread

### This Week

6. Apply for Base Builder Grants (free money, ecosystem visibility)
7. Create X/Twitter account, publish first posts
8. Create Farcaster account, start posting dev updates
9. List on MUD directories (MUD Connector, MudVerse, MudListings, Top Mud Sites)
10. Post on r/MUD — introduce the game
11. Submit to PBBG.com and BrowserMMORPG.com

### This Month

12. Create press kit using PressKitty
13. Set up IndieDB and itch.io game pages with dev logs
14. Start #ScreenshotSaturday on X/Twitter
15. Write first Medium article (gameplay-first: "What MUDs Got Right That Modern MMOs Forgot")
16. Submit to DappRadar, ChainPlay, PlayToEarn, GAM3S.GG
17. Email MMORPG.com Indie MMO Spotlight columnist
18. Email Massively Overpowered
19. Set up Google Search Console for ultimatedominion.com
20. Begin building docs site (Docusaurus at docs.ultimatedominion.com)

### Next 2–3 Months

21. Launch public docs site with 10+ pages
22. Show HN post (once browser experience is friction-free)
23. Discourse forum already live (launched with beta)
24. Build in-game referral system
25. Post on Royal Road (serialized lore or forum posts)
26. Apply to Base Batches 2026
27. Reach out to gaming guilds (YGG, Merit Circle, Avocado DAO)
28. Engage LitRPG communities
29. Set up email capture and re-engagement flow

### Getting First 100 Players

| Phase | Target | Actions |
|-------|--------|---------|
| Inner Circle | 1–25 | r/MUD, MUD directories, Lattice/MUD community, Farcaster |
| Expansion | 25–50 | Show HN, r/IndieGaming, r/playmygame, MMORPG.com Spotlight, X/Twitter |
| Viral Push | 50–100 | Press outreach, Medium articles, Base Grants, aggregator listings, docs site SEO |

### Retention Drivers

- Responsive developer (players who get questions answered stay 45% vs 17%)
- Visible changelogs and patch notes (on Discourse + docs site)
- In-game referral system (double-sided rewards, leaderboard)
- "Founding Player" badge for first 100 accounts — never available again `[IMPLEMENTED]` (Founder badge #50)
- Email re-engagement for lapsed players (patch notes, new content alerts)
- Public docs site showing depth of the game (convinces "maybe later" players to return)

---

*Last updated: February 2026*
