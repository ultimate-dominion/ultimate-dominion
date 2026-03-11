# Ultimate Dominion — Daily Research Pipeline Sources

Last updated: 2026-03-10

Signal types:
- **Contrarian** — Content we can take opposing positions on
- **Amplify** — Smart people saying things we agree with
- **Vindication** — Events/data that prove our thesis
- **Intel** — Competitive/market intelligence

---

## 1. RSS Feeds

### Game Design & Industry

| Source | RSS URL | Signal | Frequency |
|--------|---------|--------|-----------|
| Lost Garden (Daniel Cook) | `https://lostgarden.com/feed/` | Amplify, Contrarian | Weekly check |
| Raph Koster | `https://www.raphkoster.com/feed/` | Amplify — MMO/virtual world theory | Weekly check |
| Game Developer (gamedeveloper.com) | `https://www.gamedeveloper.com/rss.xml` | Intel, Contrarian — industry news + design essays | Daily |
| Deconstructor of Fun | `https://www.deconstructoroffun.com/blog?format=rss` | Contrarian — F2P orthodoxy to push against | 2x/week |
| Naavik | `https://naavik.co/feed` | Intel — gaming business analytics | 2x/week |

```bash
# Fetch any RSS feed
curl -s "https://lostgarden.com/feed/" | head -100
curl -s "https://naavik.co/feed" | head -100
curl -s "https://www.deconstructoroffun.com/blog?format=rss" | head -100
curl -s "https://www.gamedeveloper.com/rss.xml" | head -100
curl -s "https://www.raphkoster.com/feed/" | head -100
# No auth needed for any of these
```

### Crypto & Web3

| Source | RSS URL | Signal | Frequency |
|--------|---------|--------|-----------|
| Messari | `https://messari.io/rss` | Intel — crypto research, protocol analysis | Daily |
| The Block | `https://www.theblock.co/rss.xml` | Intel — crypto industry news | Daily |
| BlockchainGamer.biz | `https://www.blockchaingamer.biz/feed/` | Intel, Vindication — blockchain gaming industry | Daily |

```bash
curl -s "https://messari.io/rss" | head -100
curl -s "https://www.theblock.co/rss.xml" | head -100
curl -s "https://www.blockchaingamer.biz/feed/" | head -100
# No auth needed
```

### Autonomous Worlds / MUD Ecosystem

| Source | RSS URL | Signal | Frequency |
|--------|---------|--------|-----------|
| Lattice Newsletter (MUD + Redstone) | `https://newsletter.lattice.xyz/feed` | Vindication, Intel — our framework's ecosystem | Weekly |

```bash
curl -s "https://newsletter.lattice.xyz/feed" | head -100
# No auth. Lattice blog at lattice.xyz/blog has NO RSS feed — must scrape or use newsletter.
```

### Feeds That Need Workarounds

| Source | URL | Issue | Workaround |
|--------|-----|-------|------------|
| a16z Crypto | `https://a16zcrypto.com/posts/tags/gaming/` | No public RSS found | Scrape page or use RSS.app to generate feed |
| Delphi Digital | `https://members.delphidigital.io/` | Paywalled, members-only | Manual check; free reports surface on Twitter |
| Lattice Blog | `https://lattice.xyz/blog` | No RSS feed | Use the Substack newsletter feed above instead |
| Argus Labs Blog | `https://blog.argus.gg/` | Framer site, no RSS | Scrape or monitor Twitter @argaboratory |

---

## 2. Reddit Communities

All use the JSON API format: `https://www.reddit.com/r/{sub}/hot.json?limit=25`

### Gaming Side

| Subreddit | URL | Signal |
|-----------|-----|--------|
| r/gamedesign | `https://www.reddit.com/r/gamedesign/hot.json?limit=25` | Contrarian — mainstream game design discourse |
| r/MMORPG | `https://www.reddit.com/r/MMORPG/hot.json?limit=25` | Contrarian, Amplify — MMO player sentiment |
| r/MUD | `https://www.reddit.com/r/MUD/hot.json?limit=25` | Amplify — text-based MUD community (our roots) |
| r/roguelikedev | `https://www.reddit.com/r/roguelikedev/hot.json?limit=25` | Amplify — procedural/systems design thinking |
| r/gamedev | `https://www.reddit.com/r/gamedev/hot.json?limit=25` | Intel — broad indie game dev discourse |
| r/truegaming | `https://www.reddit.com/r/truegaming/hot.json?limit=25` | Contrarian — deeper game criticism |

### Crypto / Web3 Side

| Subreddit | URL | Signal |
|-----------|-----|--------|
| r/ethereum | `https://www.reddit.com/r/ethereum/hot.json?limit=25` | Intel — Ethereum ecosystem |
| r/CryptoGaming | `https://www.reddit.com/r/CryptoGaming/hot.json?limit=25` | Contrarian, Vindication — crypto gaming sentiment |
| r/ethgamers | `https://www.reddit.com/r/ethgamers/hot.json?limit=25` | Intel — Ethereum gaming niche |
| r/defi | `https://www.reddit.com/r/defi/hot.json?limit=25` | Intel — DeFi mechanics applicable to game economies |

```bash
# Fetch Reddit JSON (no auth needed for .json endpoints, but rate-limited)
curl -s -H "User-Agent: UltimateDominion/1.0" "https://www.reddit.com/r/CryptoGaming/hot.json?limit=25"
# Add User-Agent header to avoid 429s
```

**Check frequency:** Daily scan of titles; deep-read weekly.

---

## 3. Specific Blogs & Newsletters

### Gaming Analytics & Business

| Source | URL | Format | Signal |
|--------|-----|--------|--------|
| Naavik | `https://naavik.co/` | Blog + RSS (see above) | Intel — gaming business analysis, market sizing |
| Deconstructor of Fun | `https://www.deconstructoroffun.com/blog` | Blog + RSS (see above) | Contrarian — F2P orthodoxy; useful to argue against |
| GameDiscoverCo | `https://newsletter.gamediscover.co/` | Substack | Intel — game discovery/algorithms |

### Crypto Research

| Source | URL | Format | Signal |
|--------|-----|--------|--------|
| Delphi Digital | `https://members.delphidigital.io/` | Members portal (paid) | Intel — deep crypto gaming reports. Free reports shared on X |
| Messari | `https://messari.io/research` | Research portal + RSS | Intel — protocol analysis, market data |
| The Block Research | `https://www.theblock.pro/` | Paid tier | Intel — institutional crypto analysis |
| Messari API | `https://docs.messari.io/api-reference/` | REST API (free tier: 20 req/min, needs API key) | Intel — programmatic data access |

### a16z Crypto / Games

| Source | URL | Format | Signal |
|--------|-----|--------|--------|
| a16z Crypto Blog | `https://a16zcrypto.com/posts/` | Blog | Amplify, Contrarian — VC thesis on crypto + gaming |
| a16z Gaming Tag | `https://a16zcrypto.com/posts/tags/gaming/` | Filtered blog | Amplify — when they validate on-chain gaming |
| a16z Subscription Center | `https://a16z.com/subscription-center/` | Newsletter signup | Intel |

### Lattice / MUD Ecosystem

| Source | URL | Format | Signal |
|--------|-----|--------|--------|
| Lattice Blog | `https://lattice.xyz/blog` | Blog (no RSS) | Vindication — MUD framework updates, ecosystem growth |
| MUD + Redstone Newsletter | `https://newsletter.lattice.xyz/` | Substack + RSS | Vindication — direct MUD ecosystem news |
| MUD Docs/Changelog | `https://mud.dev/` | Docs site | Intel — framework changes affecting our stack |
| Redstone Chain | `https://redstone.xyz/` | Chain explorer | Intel — ecosystem activity |

### Autonomous Worlds Ecosystem

| Source | URL | Format | Signal |
|--------|-----|--------|--------|
| WASD Newsletter | `https://wasd.mirror.xyz/` | Mirror (2x/week) | Amplify, Intel — best dedicated AW content hub |
| 0xPARC | `https://0xparc.org/` | Blog + events | Amplify — foundational AW research org |
| Matchbox DAO | `https://mirror.xyz/matchboxdao.eth` | Mirror | Intel — StarkNet gaming ecosystem |
| 1kx AW Thesis | `https://mirror.xyz/1kx.eth` | Mirror | Amplify — VC thesis on fully on-chain games |
| Autonomous Worlds Anthology | `https://autonomousworlds.metalabel.com/` | Publication | Amplify — foundational AW essays |

### Game Design Deep Cuts

| Source | URL | Format | Signal |
|--------|-----|--------|--------|
| Lost Garden (Daniel Cook) | `https://lostgarden.com/` | Blog + RSS | Amplify — social systems design, kind games |
| Raph Koster | `https://www.raphkoster.com/` | Blog + RSS | Amplify — MMO economics, virtual worlds OG |
| Game Developer | `https://www.gamedeveloper.com/` | News + RSS | Intel, Contrarian — industry news and postmortems |

### Crypto Infrastructure

| Source | URL | Format | Signal |
|--------|-----|--------|--------|
| Messari | `https://messari.io/` | Research + RSS | Intel — protocol-level analysis |
| The Block | `https://www.theblock.co/` | News + RSS | Intel — crypto business news |
| Base Blog | `https://base.org/blog` | Blog | Vindication — our L2's ecosystem updates |

### On-Chain Gaming Specific

| Source | URL | Signal |
|--------|-----|--------|
| Proof of Play Blog | `https://www.proofofplay.com/blog/` | Vindication — shut down Pirate Nation Aug 2025 (proves P2E doesn't work) |
| Argus Labs Blog | `https://blog.argus.gg/` | Intel — World Engine competitor framework |
| Cartridge.gg | `https://cartridge.gg/` | Intel — Dojo/StarkNet gaming infra |
| Starknet Gaming Blog | `https://www.starknet.io/blog/onchain-gaming/` | Intel — StarkNet gaming ecosystem |

---

## 4. Hacker News (Algolia API)

Base URL: `https://hn.algolia.com/api/v1/`

Two endpoints:
- `search` — sorted by relevance, then points
- `search_by_date` — sorted by date (recent first)

### Search Terms to Monitor

```bash
# On-chain gaming / autonomous worlds
curl -s "https://hn.algolia.com/api/v1/search_by_date?query=on-chain+gaming&tags=story&hitsPerPage=10"
curl -s "https://hn.algolia.com/api/v1/search_by_date?query=autonomous+worlds&tags=story&hitsPerPage=10"
curl -s "https://hn.algolia.com/api/v1/search_by_date?query=fully+onchain+game&tags=story&hitsPerPage=10"

# MUD / infrastructure
curl -s "https://hn.algolia.com/api/v1/search_by_date?query=MUD+framework+blockchain&tags=story&hitsPerPage=10"
curl -s "https://hn.algolia.com/api/v1/search_by_date?query=ECS+game+engine&tags=story&hitsPerPage=10"

# Game design / MMO economics
curl -s "https://hn.algolia.com/api/v1/search_by_date?query=MMO+economy&tags=story&hitsPerPage=10"
curl -s "https://hn.algolia.com/api/v1/search_by_date?query=game+design+systems&tags=story&hitsPerPage=10"
curl -s "https://hn.algolia.com/api/v1/search_by_date?query=virtual+economy&tags=story&hitsPerPage=10"
curl -s "https://hn.algolia.com/api/v1/search_by_date?query=browser+RPG&tags=story&hitsPerPage=10"
curl -s "https://hn.algolia.com/api/v1/search_by_date?query=text+based+game&tags=story&hitsPerPage=10"

# Crypto gaming (contrarian fodder — HN hates crypto)
curl -s "https://hn.algolia.com/api/v1/search_by_date?query=crypto+gaming&tags=story&hitsPerPage=10"
curl -s "https://hn.algolia.com/api/v1/search_by_date?query=blockchain+game&tags=story&hitsPerPage=10"
curl -s "https://hn.algolia.com/api/v1/search_by_date?query=web3+gaming&tags=story&hitsPerPage=10"

# Broader tech/culture
curl -s "https://hn.algolia.com/api/v1/search_by_date?query=play+to+earn&tags=story&hitsPerPage=10"
curl -s "https://hn.algolia.com/api/v1/search_by_date?query=Base+L2+blockchain&tags=story&hitsPerPage=10"
curl -s "https://hn.algolia.com/api/v1/search_by_date?query=dark+forest+game&tags=story&hitsPerPage=10"

# No auth needed. No hard rate limits documented, but be respectful.
```

### API Parameters Reference
- `query` — search string
- `tags` — filter: `story`, `comment`, `ask_hn`, `show_hn`, `job`, `author_{username}`
- `numericFilters` — e.g., `points>50`, `num_comments>10`, `created_at_i>{unix_timestamp}`
- `hitsPerPage` — results per page (default 20)
- `page` — pagination

**Check frequency:** Daily, filtered to `created_at_i > {yesterday_unix}`.

---

## 5. Twitter/X Accounts to Monitor

### On-Chain Gaming / Autonomous Worlds Core

| Handle | Who | Signal |
|--------|-----|--------|
| @gubsheep | Brian Gu — Dark Forest creator, 0xPARC founder | Amplify — foundational AW thinker |
| @lataboratory / @latticexyz | Lattice / MUD framework | Vindication — our framework's team |
| @ludens | Lattice co-founder | Amplify — AW vision |
| @alvrs_ | Alvarius — MUD core contributor | Intel — MUD technical direction |
| @0xhank | Hank — Primodium, 0xPARC AW Resident, dfdao | Amplify — AW builder |
| @evefront | EVE Frontier | Intel — AAA studio doing on-chain gaming |
| @ccaboratory | CCP Games | Intel — EVE Frontier updates |
| @argaboratory | Argus Labs | Intel — World Engine competitor |
| @cartridge_gg | Cartridge | Intel — Dojo/StarkNet gaming infra |
| @BibliothecaDAO | BibliothecaDAO / Realms | Intel — StarkNet AW ecosystem |
| @LootRealms | Realms community | Intel — Eternum updates |
| @0xPARC | 0xPARC | Amplify — AW research community |
| @FaultProofBen | Ben — WASD Newsletter author | Amplify — best AW content creator |
| @proaboratory | Proof of Play (note: Pirate Nation shut down) | Contrarian — lessons from their failure |

### Game Design Voices

| Handle | Who | Signal |
|--------|-----|--------|
| @raphkoster | Raph Koster — UO/SWG designer, author | Amplify — MMO design, virtual worlds |
| @danctheduck | Daniel Cook — Lost Garden | Amplify — social systems, kind games |
| @dcfnewsletter | Deconstructor of Fun | Contrarian — F2P orthodoxy |
| @naaboratory | Naavik | Intel — gaming business analytics |

### Crypto Infrastructure / Research

| Handle | Who | Signal |
|--------|-----|--------|
| @MessariCrypto | Messari | Intel — crypto research |
| @a16zcrypto | a16z Crypto | Amplify — VC thesis validation |
| @jessepollak | Jesse Pollak — Base | Vindication — our L2's growth |
| @BuildOnBase | Base | Vindication — ecosystem updates |
| @optimaboratory | Optimism | Intel — OP Stack / Superchain |
| @muddev_ | MUD Framework | Vindication — framework updates |

### Broader Crypto Gaming Commentary

| Handle | Who | Signal |
|--------|-----|--------|
| @BCGbiz | BlockchainGamer.biz | Intel — blockchain gaming industry |
| @Gam3sgg | GAM3S.GG | Intel — web3 gaming aggregator |
| @YatSiu | Yat Siu — Animoca Brands | Contrarian — Web3 gaming VC takes |

**Fetching:** Use Twitter/X API (requires OAuth), or Nitter instances for unauthenticated scraping if still available. Twitter API v2 free tier allows 1500 tweets/month read.

**Check frequency:** Daily scan of key accounts; real-time for @latticexyz and @BuildOnBase.

---

## 6. Competitor / Peer Projects to Track

### Direct Competitors (Permanent On-Chain Worlds)

| Project | URL | Chain | Status | Signal |
|---------|-----|-------|--------|--------|
| Primodium | `https://primodium.com/` | EVM (MUD) | Active | Intel — closest MUD-based competitor |
| Sky Strife | `https://skystrife.xyz/` | Redstone (MUD) | Autonomous Mode | Vindication — Lattice's own game validates MUD |
| Mithraeum | `https://mithraeum.io/` | Ethereum | Active | Intel — on-chain grand strategy |
| Eternum (Realms) | `https://eternum.realms.world/` | StarkNet (Dojo) | Active | Intel — StarkNet's flagship AW |
| Influence | `https://influenceth.io/` | StarkNet | Active | Intel — on-chain space strategy MMO |

### Failed / Pivoted (Lessons)

| Project | URL | Chain | Status | Signal |
|---------|-----|-------|--------|--------|
| Pirate Nation / Proof of Play | `https://www.proofofplay.com/` | Arbitrum Orbit | **Shut down Aug 2025** | Contrarian — P2E model failed, validates our approach |
| Dark Forest | `https://zkga.me/` | Gnosis Chain | Ended (community forks) | Amplify — the OG, proved the thesis |

### AAA / High-Profile

| Project | URL | Chain | Status | Signal |
|---------|-----|-------|--------|--------|
| EVE Frontier | `https://evefrontier.com/` | Sui (migrating March 2026) | Early access | Intel — biggest AAA bet on on-chain gaming |
| Parallel | `https://parallel.life/` | Solana (Colony) | Active | Intel — AI sim + cards |
| Illuvium | `https://illuvium.io/` | Immutable X | Active | Contrarian — AAA crypto game, questionable economics |

### Infrastructure Competitors

| Project | URL | What | Signal |
|---------|-----|------|--------|
| Argus Labs / World Engine | `https://argus.gg/` | Gamechain SDK with sharded rollup architecture | Intel — alternative to MUD |
| Cartridge / Dojo | `https://cartridge.gg/` | StarkNet game engine + controller | Intel — StarkNet equivalent of MUD |
| Curio / Keystone | `https://www.curio.gg/` | OP Stack L2 with built-in game engine (Go-based ECS) | Intel — another EVM game infra approach |

### Others to Watch

| Project | URL | Notes |
|---------|-----|-------|
| Topology.gg | `https://topology.gg/` | On-chain physics/math experiments |
| Words3 | Various | On-chain word game, early MUD project |
| Small Brain Games | Various | Minimalist on-chain games |

**Check frequency:** Weekly deep scan of active projects. Monitor Twitter for all.

---

## 7. Academic / Deep Sources

### Conferences & Vaults

| Source | URL | Signal |
|--------|-----|--------|
| GDC Vault | `https://gdcvault.com/` | Amplify — deep game design talks. $599/yr subscription. Free talks on YouTube. |
| GDC Schedule | `https://schedule.gdconf.com/` | Intel — upcoming talks, trends |

### Key Researchers

| Researcher | Affiliation | Work | Signal |
|------------|-------------|------|--------|
| Edward Castronova | Indiana University | "Synthetic Worlds" (2005), MMO economics pioneer | Amplify — virtual economy theory |
| Vili Lehdonvirta | Oxford / Aalto University | "Virtual Economies: Design and Analysis" (MIT Press, 2014) | Amplify — game economy design framework |
| Daniel Cook | Spry Fox / Lost Garden | Social systems design, kind games | Amplify — prosocial multiplayer theory |
| Raph Koster | Playable Worlds | "A Theory of Fun" author, UO/SWG designer | Amplify — MMO design, player behavior |

### Key Publications & Papers

| Publication | URL | Signal |
|-------------|-----|--------|
| Game Studies Journal | `https://gamestudies.org/` | Intel — academic game research |
| Castronova "On Virtual Economies" | `https://papers.ssrn.com/sol3/papers.cfm?abstract_id=338500` | Amplify — foundational paper |
| Lehdonvirta & Castronova "Virtual Economies" | MIT Press, 2014 | Amplify — the textbook on game economy design |
| Terra Nova (archived) | Blog by Castronova, Dibbell, Hunter, Lastowka | Amplify — pioneering virtual worlds research blog |

### Industry Analysis

| Source | URL | Format | Signal |
|--------|-----|--------|--------|
| DappRadar Games Reports | `https://dappradar.com/blog/` | Blog | Intel — blockchain gaming market data |
| Machinations.io | `https://machinations.io/` | Tool + blog | Intel — game economy modeling tool |
| GameAnalytics Blog | `https://gameanalytics.com/blog/` | Blog | Intel — player behavior data |

**Check frequency:** Monthly for academic sources. Quarterly for GDC content drops.

---

## Fetch Cheat Sheet

```bash
# === RSS FEEDS (no auth, just curl) ===
curl -s "https://naavik.co/feed"
curl -s "https://www.deconstructoroffun.com/blog?format=rss"
curl -s "https://lostgarden.com/feed/"
curl -s "https://www.raphkoster.com/feed/"
curl -s "https://www.gamedeveloper.com/rss.xml"
curl -s "https://messari.io/rss"
curl -s "https://www.theblock.co/rss.xml"
curl -s "https://www.blockchaingamer.biz/feed/"
curl -s "https://newsletter.lattice.xyz/feed"

# === REDDIT (no auth, add User-Agent) ===
curl -s -H "User-Agent: UltimateDominion/1.0" \
  "https://www.reddit.com/r/CryptoGaming/hot.json?limit=25"

# === HACKER NEWS (no auth) ===
curl -s "https://hn.algolia.com/api/v1/search_by_date?query=on-chain+gaming&tags=story&hitsPerPage=10"

# === MESSARI API (needs API key) ===
curl -s -H "x-messari-api-key: YOUR_KEY" \
  "https://data.messari.io/api/v2/news?fields=title,url,published_at&page[size]=25"

# === TWITTER/X API (needs OAuth bearer token) ===
# Free tier: 1500 tweets/month
# Or scrape via Nitter if still running

# === MIRROR.XYZ (no auth, but no native RSS) ===
# Must scrape or use third-party RSS generators
# Try: https://rss3.io/ for Mirror feed aggregation
```

---

## Pipeline Architecture Notes

1. **Daily (automated):** RSS feeds, Reddit JSON, HN Algolia API, Twitter lists
2. **2x/week (manual scan):** WASD newsletter, Lattice newsletter, Naavik, DoF
3. **Weekly (deep read):** Competitor project updates, Mirror essays, blog posts
4. **Monthly:** Academic papers, GDC vault, Delphi reports
5. **Event-driven:** Any time a project launches, shuts down, or pivots — that's content

### Content Buckets
- **Contrarian takes:** When mainstream gaming/crypto outlets get it wrong about on-chain gaming, permanence, or game economies
- **Amplification:** When researchers or builders say what we believe — signal boost them
- **Vindication moments:** When data or events prove that permanent worlds, real economies, and on-chain state matter
- **Intel:** Competitive moves, framework updates, ecosystem growth metrics
