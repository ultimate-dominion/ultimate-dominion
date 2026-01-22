# Badge System Design

Soulbound (non-transferable) ERC721 badges that recognize player achievements and gate features.

## Implemented Badges

| Token ID | Badge | Requirement | Unlocks |
|----------|-------|-------------|---------|
| 1 | Adventurer | Reach level 3 | Global chat access |
| 50 | Founder | Play during launch window | Cosmetic recognition |

## Future Badges

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
- ERC721 deployed via MUD `erc721-puppet` module
- Namespace: `Badges`
- Soulbound: Override `transferFrom` to revert (non-transferable)

### Minting Triggers
- **Adventurer (1)**: Minted in `LevelSystem.processLevelUp()` when level reaches 3
- **Founder (50)**: Minted in `CharacterCore.createCharacter()` during launch window

### Token ID Ranges
- 1-9: Progression badges
- 10-19: Combat badges
- 20-29: Economic badges
- 30-39: Exploration badges
- 40-49: Quest badges
- 50-59: Special/Limited badges
- 60-69: Social badges

### Push Protocol Integration
- Chat group gated by Adventurer badge (Token ID 1)
- Group created with `rules.entry.conditions` checking badge ownership

## Adding New Badges

1. Reserve a token ID in the appropriate range
2. Add minting logic in the relevant system contract
3. Update this document
4. (Optional) Add UI display for the new badge
