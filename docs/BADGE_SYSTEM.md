# Badge System Design

Soulbound (non-transferable) ERC1155 badges that recognize player achievements and gate features.

> **Status Key**: `[IMPLEMENTED]` = in code, `[PLANNED]` = designed but not built

## Implemented Badges `[IMPLEMENTED]`

| Token ID | Badge | Requirement | Unlocks |
|----------|-------|-------------|---------|
| 1 | Adventurer | Reach Level 3 | Chat access |
| 50 | Founder | Play during launch window (configurable) | Cosmetic recognition |
| 100 | Zone Conqueror (DC) | Top 10 to reach max level in Dark Cave | Cosmetic recognition |
| 101 | Peaks Conqueror (WP) | Top 10 to reach max level in Windy Peaks | Cosmetic recognition |
| 152 | Peaks Pioneer | Enter the Windy Peaks zone | Cosmetic recognition |
| 201 | Lore Keeper (DC) | Collect all 8 Dark Cave fragments | Cosmetic recognition |
| 202 | Peaks Lore Keeper (WP) | Collect all Windy Peaks fragments | Cosmetic recognition |

Unique token ID per character: `(BADGE_ID × 1,000,000) + characterTokenId`

### Zone Badge Ranges
- **100 + zoneId**: Zone Conqueror (top 10 to max level per zone, via `ZoneConfig.badgeBase`)
- **150 + zoneId**: Zone Pioneer (first entry into a zone, minted by `ZoneTransitionSystem`)
- **200 + zoneId**: Lore Keeper (all zone fragments, minted by `FragmentSystem`)

## Future Badges `[PLANNED]`

### Progression
| Token ID | Badge | Requirement |
|----------|-------|-------------|
| 2 | Veteran | Reach level 10 |
| 3 | Hero | Reach level 25 |
| 4 | Legend | Reach max level |

### Combat - PvP
| Token ID | Badge | Requirement |
|----------|-------|-------------|
| 10 | First Blood | Win first PvP battle |
| 11 | Gladiator | Win 10 PvP battles |
| 12 | Champion | Win 100 PvP battles |
| 13 | Duelist | Win 5 PvP battles in a row |
| 14 | Untouchable | Win PvP without taking damage |

### Combat - PvE
| Token ID | Badge | Requirement |
|----------|-------|-------------|
| 15 | Monster Slayer | Kill 100 monsters |
| 16 | Dragon Slayer | Kill a boss monster |
| 17 | Exterminator | Kill 1000 monsters |
| 18 | Flawless | Kill boss without taking damage |

### Economic
| Token ID | Badge | Requirement |
|----------|-------|-------------|
| 20 | Trader | Complete first marketplace sale |
| 21 | Merchant | 10 marketplace transactions |
| 22 | Tycoon | Earn 10,000 gold total |
| 23 | Monopolist | Own 100 items simultaneously |

### Exploration
| Token ID | Badge | Requirement |
|----------|-------|-------------|
| 30 | Explorer | Visit 5 different zones |
| 31 | Cartographer | Visit all zones |
| 32 | Trailblazer | First player to enter a new zone |

### Quests
| Token ID | Badge | Requirement |
|----------|-------|-------------|
| 40 | Errand Runner | Complete first quest |
| 41 | Quest Master | Complete 10 quests |
| 42 | Legendary Hero | Complete all main story quests |
| 43 | Completionist | Complete all quests in the game |
| 44 | Speed Runner | Complete a quest chain under time limit |

### Social
| Token ID | Badge | Requirement |
|----------|-------|-------------|
| 60 | Helpful | Help another player complete a quest |
| 61 | Guild Founder | Create a guild |
| 62 | Popular | Have 10 players in your guild |

### Special/Limited
| Token ID | Badge | Requirement |
|----------|-------|-------------|
| 50 | Founder | Play during launch window |
| 51 | Beta Tester | Played during beta |
| 52 | Bug Hunter | Report a verified bug |
| 53 | First of Kind | First player to achieve something notable |

## Technical Implementation

### Contract
- **ERC1155** deployed via MUD `erc1155-puppet` module (NOT ERC721)
- Namespace: `BADGES`
- Soulbound: non-transferable
- Address stored in `UltimateDominionConfig` table

### Minting Triggers
- **Adventurer (1)**: Minted in `LevelSystem` when character reaches Level 3 (`ADVENTURER_BADGE_LEVEL = 3`)
- **Founder (50)**: Minted during launch window (`founderWindowEnd` timestamp)

### Token ID Ranges
- 1-9: Progression badges
- 10-19: Combat badges
- 20-29: Economic badges
- 30-39: Exploration badges
- 40-49: Quest badges
- 50-59: Special/Limited badges
- 60-69: Social badges

### Chat Gating
- Chat access gated by Adventurer badge (Token ID 1)
- Players must reach Level 3 before participating in chat

## Adding New Badges

1. Reserve a token ID in the appropriate range
2. Add minting logic in the relevant system contract
3. Update this document
4. (Optional) Add UI display for the new badge

---

*Last updated: March 9, 2026*
