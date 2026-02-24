# Ultimate Dominion — Go-to-Market

Marketing plan — SEO, community platform, distribution channels, content strategy, press, and priority action plan.

> **Status Key**: `[IMPLEMENTED]` = done, `[PLANNED]` = designed but not built

---

## Table of Contents

1. [Community Platform](#community-platform)
2. [SEO Audit](#seo-audit-current-state)
3. [Distribution Channels](#distribution-channels)
4. [Content Marketing Strategy](#content-marketing-strategy)
5. [Messaging by Audience](#messaging-by-audience)
6. [Press & Influencers](#press--influencers)
7. [Priority Action Plan](#priority-action-plan)

---

## Community Platform `[PLANNED]`

### Decision: Self-Hosted Discourse (No Discord)

Communication channels: **public forum (Discourse) + in-game chat + email**. No Discord.

**Why Discourse:**
- Server-rendered HTML fallback for crawlers — strong SEO out of the box
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

### Forum Structure

```
ULTIMATE DOMINION FORUMS
|
|-- Announcements & News
|   |-- Patch Notes
|   |-- Developer Blogs
|   |-- Events & Tournaments
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
|   |-- Advanced Tutorials
|   |-- Economy & Crafting Guides
|   |-- Wiki-style Collaborative Posts
|
|-- On-Chain & Economy
|   |-- Marketplace Discussion
|   |-- Smart Contract Discussion
|   |-- Governance Proposals
|   |-- Bug Bounties
|
|-- Community
|   |-- Guild Recruitment & Alliances
|   |-- PvP Rankings & Leaderboard Discussion
|   |-- Fan Art & Creative Content
|   |-- Off-Topic / The Tavern
|
|-- Support
|   |-- Bug Reports
|   |-- Technical Support
|   |-- Account Issues
```

---

## SEO Audit (Current State)

The client is a pure CSR React SPA (Vite + React 18 + Chakra UI). Crawlers see a blank page until JS loads.

| Issue | Severity | Status |
|-------|----------|--------|
| No meta description, OG tags, or Twitter cards | HIGH | Missing |
| No robots.txt or sitemap.xml | HIGH | Missing |
| No SSR/prerendering | CRITICAL | Missing |
| No dynamic meta tags (every page has identical title) | HIGH | Missing |
| No structured data (JSON-LD/schema.org) | MEDIUM | Missing |
| Large JS bundle | MEDIUM | Needs optimization |
| No react-helmet or equivalent | HIGH | Missing |
| Source maps shipped to production | MEDIUM | Should disable |
| URL structure | OK | Clean: /marketplace, /characters/:id, /leaderboard |
| Vercel Analytics | OK | `[IMPLEMENTED]` |

### SEO Quick Wins (Priority Order)

1. Add `react-helmet-async` for per-route meta tags (title, description, OG, Twitter cards)
2. Add `robots.txt` and `sitemap.xml` to `public/`
3. Create a 1200x630px OG image for social sharing
4. Add JSON-LD structured data (Game schema, Organization)
5. Disable source maps in production build (`sourcemap: false` in vite.config.ts)
6. Add canonical URL tags
7. Add alt tags to all images

### Longer-Term SEO

- Implement prerendering for public pages (Welcome, Leaderboard, Character profiles, Marketplace items)
- Build a game wiki (either on Discourse or a dedicated subdomain)
- Dynamic OG image generation for character/item cards (API endpoint using Canvas/Sharp — Sharp already in API dependencies)

---

## Distribution Channels

### Web3 Channels

**Base Chain Ecosystem:**
- Base Builder Grants: https://docs.base.org/get-started/get-funded (2 ETH weekly rewards, 1–5 ETH grants)
- Base Batches 2026: https://batches.base.org/ (top teams get $10K–$50K)
- Tag @base on X/Twitter and Farcaster for amplification

**Farcaster / Warpcast:**
- Built on Base, massive overlap with target audience
- DEGEN tipping token rewards creators
- Farcaster Frames for inline game interaction
- URL: https://warpcast.com/

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

## Content Marketing Strategy

### Dev Logs (Most Powerful Strategy for Solo Dev)

**What to post:**
- Weekly/biweekly dev updates with screenshots/GIFs
- "How I solved X" technical posts
- Design decision retrospectives
- Monthly progress summaries with before/after
- Honest posts about challenges (perform BETTER than success stories)

**Where to cross-post:**
- Own Discourse forum → Medium → IndieDB → itch.io → Reddit (subreddit-appropriate)

### Twitter/X Cadence

| Day | Hashtag | Content |
|-----|---------|---------|
| Wednesday | #WIPWednesday | Work-in-progress shots |
| Saturday | #ScreenshotSaturday | Gameplay GIF (6–15 seconds) |
| Anytime | #gamedev #indiedev #web3gaming | Technical threads, bug showcases, milestone posts |

### High-Value Blog/Medium Articles

- "Why I'm Building an MMORPG Entirely On-Chain"
- "The MUD Framework: Building Autonomous Worlds on Ethereum"
- "PvP Economy Design: Lessons from 20 Years of MUDs"
- "Solo Dev MMORPG: Month X Update"
- "How Smart Contracts Replace Game Servers"

### YouTube Content

- Dev log videos (5–15 min)
- 60–90 sec gameplay trailers
- "How on-chain combat actually works" explainers
- PvP highlight reels

### SEO Guerilla Tactics

- **Game wiki**: Item database, class builds, quest guides — every page is a long-tail keyword target
- **Quora/Arqade answers**: Answer "What are the best browser MMORPGs?" with genuine helpful answers
- **Comparison pages**: "On-Chain Games Like Dark Forest" or "Best Browser MMORPGs in 2026"
- **Directory backlinks**: Every listing is a backlink improving domain authority

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

### YouTubers to Contact

| Channel | Why |
|---------|-----|
| Josh Strife Hayes | 1M+ subs, covers niche/indie MMOs |
| TheLazyPeon | Reviews every MMORPG, covers niche titles |
| MMOHut / FreeMMOStation | Dedicated F2P/browser MMO reviews |
| Nookrium | Spotlights in-development indie games |

### Press/Blogs

- Bio Break: https://biobreak.wordpress.com/ (also writes for Massively OP)
- Dog Water Gaming: https://dogwatergaming.com/ (publishes "Top 10 Indie MMOs" lists)
- The Indie Informer: https://the-indie-in-former.com/
- Best Indie Games Newsletter: https://www.thebestindiegames.com/newsletter
- BlockchainGamer.biz: https://www.blockchaingamer.biz/
- GAM3S.GG News: https://gam3s.gg/news/
- CoinDesk Gaming, Decrypt (web3 angle)

---

## Priority Action Plan

### This Week
1. Apply for Base Builder Grants (free money, ecosystem visibility)
2. Create Farcaster account, start posting dev updates
3. List on MUD directories (MUD Connector, MudVerse, MudListings, Top Mud Sites)
4. Post on r/MUD — introduce the game
5. Submit to PBBG.com and BrowserMMORPG.com

### This Month
6. Create press kit using PressKitty
7. Set up IndieDB and itch.io game pages with dev logs
8. Start #ScreenshotSaturday on Twitter/X
9. Write first Medium article
10. Submit to DappRadar, ChainPlay, PlayToEarn, GAM3S.GG
11. Email MMORPG.com Indie MMO Spotlight columnist
12. Email Massively Overpowered

### Next 2–3 Months
13. Show HN post (once browser experience is friction-free)
14. Email 10 indie game YouTubers with press kits
15. Build in-game referral system
16. Start game wiki and populate with content
17. Post on Royal Road (serialized lore or forum posts)
18. Apply to Base Batches 2026
19. Reach out to gaming guilds (YGG, Merit Circle, Avocado DAO)
20. Engage LitRPG communities

### Getting First 100 Players

| Phase | Target | Actions |
|-------|--------|---------|
| Inner Circle | 1–25 | r/MUD, MUD directories, Lattice/MUD community, Farcaster |
| Expansion | 25–50 | Show HN, r/IndieGaming, r/playmygame, MMORPG.com Spotlight, Twitter |
| Viral Push | 50–100 | YouTuber outreach, Medium articles, Base Grants, aggregator listings |

### Retention Drivers
- Responsive developer (players who get questions answered stay 45% vs 17%)
- Visible changelogs and patch notes
- In-game referral system (double-sided rewards, leaderboard)
- "Founding Player" badge for first 100 accounts — never available again `[IMPLEMENTED]` (Founder badge #50)

---

*Last updated: February 2026*
