# Error Reference — Ultimate Dominion

Debugging reference for developers and operators. When a transaction reverts, match the 4-byte selector from the revert data against this table to identify the error and its resolution.

**Tip**: To decode a raw revert selector, use `cast 4byte <selector>` or match it against the tables below.

---

## 1. Custom Error Code Reference

### Access Control

| Error | Selector | Cause | System(s) | Resolution |
|---|---|---|---|---|
| `Unauthorized()` | `0x82b42900` | Caller is not the character owner or authorized delegate | ShopSystem, MapSystem, EncounterSystem, ImplicitClassSystem, StatSystem, CharacterEnterSystem, WorldActionSystem, PvPSystem | Ensure the transaction sender owns the character or has a valid GameDelegation |
| `NotAdmin()` | `0x7bfa4b9f` | Caller is not in the Admin table | PauseSystem, AdminContentSystem, AdminTuningSystem, AdminEntitySystem, AdminShopSystem, AdminSystem, FragmentSystem | Call from an address with `Admin.get(addr) == true` |
| `GamePaused()` | `0x379a7ed9` | The game is paused via PauseSystem | Any system checking pause state | Wait for admin to unpause, or call `unpause()` from admin address |
| `InvalidShopEntity()` | `0x46db0415` | Entity ID passed is not a registered shop | AdminShopSystem | Verify the shop entity ID exists in the Shop table |
| `NotAuthorizedCaller()` | `0x7046c88d` | Internal utility call from unauthorized address | utils.sol (internal) | Ensure the calling system has the correct namespace access |

### Character Creation & Class

| Error | Selector | Cause | System(s) | Resolution |
|---|---|---|---|---|
| `CharacterLocked()` | `0x261fa6d6` | Character is locked (in world / spawned) | ImplicitClassSystem, StatSystem, CharacterEnterSystem | Despawn the character before modifying class/stats |
| `InvalidCharacter()` | `0x312a9f56` | Character entity does not exist (tokenId == 0) | StatSystem, FragmentSystem | Pass a valid character entity ID |
| `InvalidRace()` | `0x42e6ce25` | Race enum is `None` or out of range | ImplicitClassSystem | Pass a valid Race enum value |
| `RaceAlreadySet()` | `0xdc37ef01` | Character already chose a race | ImplicitClassSystem | Race is permanent — cannot be changed |
| `InvalidPowerSource()` | `0xf7c3171a` | PowerSource enum is `None` or out of range | ImplicitClassSystem | Pass a valid PowerSource enum value |
| `PowerSourceAlreadySet()` | `0xb347e4e5` | Character already chose a power source | ImplicitClassSystem | Power source is permanent — cannot be changed |
| `InvalidArmorType()` | `0x71b98e70` | ArmorType enum is `None` or out of range | ImplicitClassSystem, CharacterEnterSystem | Pass a valid ArmorType enum value |
| `ArmorAlreadySet()` | `0x3c486b94` | Character already chose starting armor type | ImplicitClassSystem | Starting armor is permanent — cannot be changed |
| `InvalidAdvancedClass()` | `0xab97502e` | AdvancedClass enum is `None` or out of range | ImplicitClassSystem | Pass a valid AdvancedClass enum value |
| `AdvancedClassAlreadySet()` | `0xc62a04a7` | Character already selected an advanced class | ImplicitClassSystem | Advanced class is permanent — one selection per character |
| `RequiresLevel10()` | `0xcbeca0ab` | Character is below level 10 | ImplicitClassSystem | Level the character to 10 before selecting an advanced class |
| `InvalidStatChange()` | `0x81c5c748` | Stat allocation does not match allowed point budget | StatSystem | Ensure stat changes match the points available for the level-up |
| `CannotLevelInCombat()` | `0x514ff012` | Attempted to level up while in an encounter | StatSystem | Finish or flee the encounter first |
| `MaxCharacters()` | `0x0762d547` | Account already owns a character | CharacterCore | One character per account. Delete or use a different account |
| `NameTaken()` | `0x9e4b2685` | Character name already exists | CharacterCore | Choose a different name |
| `InvalidAccount()` | `0x6d187b28` | Account address is zero, name is empty, or ERC721 ownership mismatch | CharacterCore, CharacterEnterSystem | Verify account address and token ownership |
| `InvalidTokenUri()` | `0x442473f8` | Empty token URI string | CharacterCore | Provide a non-empty token URI |
| `InvalidStarterItem()` | `0x572721e0` | Item is not in the StarterItemPool | CharacterEnterSystem | Use an item marked as a starter in StarterItemPool |
| `InsufficientStat()` | `0xb8bad4c1` | Character stats do not meet item requirements | CharacterEnterSystem | Choose starter items matching the character's stat roll |
| `InvalidItemType()` | `0x7932f1fc` | Item type does not match expected slot (weapon vs. armor) | CharacterEnterSystem | Pass a weapon for the weapon slot and armor for the armor slot |
| `MustChooseRaceFirst()` | `0xd0cc5baa` | Attempted to roll stats before selecting a race | ImplicitClassSystem | Select a race before rolling stats |
| `MustChoosePowerSourceFirst()` | `0x37469947` | Attempted to roll stats before selecting a power source | ImplicitClassSystem | Select a power source before rolling stats |
| `MaxStatRollsExceeded()` | `0x9b06ec25` | Used all 4 stat rolls (1 initial + 3 re-rolls) | ImplicitClassSystem | No more re-rolls available — accept current stats or create a new character |
| `CharacterDead()` | `0x30e36817` | Character HP is zero | WorldActionSystem | Character must be revived or healed before acting |

### Shop

| Error | Selector | Cause | System(s) | Resolution |
|---|---|---|---|---|
| `NotAtShopPosition()` | `0x9d026e7f` | Character is not on the same tile as the shop | ShopSystem | Move the character to the shop's position before buying/selling |
| `OutOfStock()` | `0xade1cb41` | Shop item stock is depleted | ShopSystem | Wait for restock or try a different shop |
| `InsufficientItemBalance()` | `0x16a8a709` | Seller does not have enough of the item to sell | ShopSystem, WorldActionSystem | Check inventory balance before selling |
| `ShopInsufficientGold()` | `0x4a675dad` | Buyer does not have enough gold, or shop reserve is empty | ShopSystem | Earn more gold or check the shop's gold reserve |
| `NotOwnShopEncounter()` | `0x78d73082` | Trying to interact with a shop encounter that belongs to another character | ShopSystem | Only the character who opened the shop encounter can use it |

### Encounter

| Error | Selector | Cause | System(s) | Resolution |
|---|---|---|---|---|
| `InvalidPvE()` | `0xadee4371` | PvE encounter validation failed | EncounterSystem | Ensure character is at a valid PvE position with spawned monsters |
| `InvalidPvP()` | `0xa4385cbb` | PvP encounter validation failed | EncounterSystem | Both players must be at the same position and meet PvP requirements |
| `InvalidEncounter()` | `0xd8deb7b5` | Encounter does not exist or is in an invalid state | ShopSystem, EncounterResolveSystem, EncounterSystem | Check that the encounter ID exists and hasn't already ended |
| `ExpiredEncounter()` | `0xd5bbc5d0` | Current turn exceeds maxTurns | EncounterSystem | Encounter has timed out — resolve it |
| `NonCombatant()` | `0x2090d0eb` | Entity is not a participant in the encounter | EncounterSystem | Only encounter participants can submit actions |
| `CannotEndTurn()` | `0x025045d4` | Caller is not a member of the active team | EncounterSystem | Wait for your turn before ending it |
| `NotCombatEncounter()` | `0x6f53077d` | Expected a combat encounter but got a different type | EncounterSystem | Verify the encounter type before submitting combat actions |
| `EncounterAlreadyOver()` | `0x08f8364b` | Encounter has already been resolved | EncounterResolveSystem | Encounter is finished — claim rewards if applicable |
| `InvalidEncounterType()` | `0x4f331f71` | Encounter type enum is unrecognized | EncounterResolveSystem, EncounterSystem | Use a valid EncounterType enum value |
| `InvalidWorldLocation()` | `0x4afb32d9` | Defender is not at the attacker's position | EncounterSystem | Both parties must be on the same tile for PvP |
| `InvalidShopEncounter()` | `0x6bbd0237` | Shop encounter validation failed (entity not a shop, encounter mismatch) | ShopSystem, EncounterSystem | Verify the entity is a shop and encounter state is valid |
| `AlreadyInEncounter()` | `0x0769bef0` | Character is already in an active encounter | EncounterSystem | Finish or flee the current encounter before starting a new one |
| `InvalidCombatEntity()` | `0x1af235ec` | Entity is already in an encounter or is dead | EncounterSystem, StatSystem | Entity must be alive and not in another encounter |
| `InvalidGroupSize()` | `0x2cbdc231` | Group has 0 members or exceeds MAX_PARTY_SIZE (10) | EncounterSystem | Keep party size between 1 and 10 |
| `CombatantHpZero()` | `0xb759fa67` | A combatant has 0 HP at encounter start | EncounterSystem | Heal the character before entering combat |
| `NotInEncounter()` | `0x5ce83b2d` | Character is not in any encounter | PvPSystem | Character must be in an encounter to flee |
| `CanOnlyFleeFirstTurn()` | `0xfb2fd46b` | Attempted to flee after the first turn | PvPSystem | Fleeing is only allowed on turn 1 (attacker) or turn 2 (defender) |
| `InvalidFlee()` | `0x39fed10d` | Defender tried to flee (only attacker can flee PvP) | PvPSystem | Only the encounter initiator (attacker) can flee |
| `UnrecognizedEncounterType()` | `0x9310ec80` | Encounter type not handled in resolution logic | PvPSystem | Internal error — report as a bug |

### Map & Movement

| Error | Selector | Cause | System(s) | Resolution |
|---|---|---|---|---|
| `OnlyCharacters()` | `0xb8a03426` | Entity is not a valid character | MapSystem | Pass a character entity ID, not a mob or item |
| `NotSpawned()` | `0xbd45e4f6` | Character is not spawned on the map | MapSystem | Spawn the character first via the spawn function |
| `AlreadySpawned()` | `0xb7298922` | Character is already on the map | MapSystem | Character is already spawned — move instead of spawning |
| `InEncounter()` | `0x63754e43` | Character is in an active encounter | MapSystem, WorldActionSystem | Finish or flee the encounter before moving or acting |
| `OutOfBounds()` | `0xb4120f14` | Target coordinates exceed map dimensions | MapSystem | Keep x < width and y < height of the current zone |
| `InvalidMove()` | `0x87822d34` | Move distance is not exactly 1 tile (cardinal directions) | MapSystem | Move one tile at a time (up/down/left/right) |
| `MaxPlayers()` | `0x87d14a36` | Zone player cap reached | MapSystem | Wait for a player to leave or increase maxPlayers (admin) |
| `NoMonsters()` | `0x130e42e3` | No monsters available for the zone | MapSpawnSystem | Load zone content via admin — no mob types configured |
| `NoWeaponsEquipped()` | `0x8fa2ffa1` | Character has no weapon equipped for combat | PvESystem, PvPSystem | Equip a weapon before entering combat |
| `EntityNotAtPosition()` | `0xbd0f4934` | Entity was not found at the expected position | AdminEntitySystem, MapSystem | Verify entity coordinates before removal |
| `UseFleeFunction()` | `0xb4310fba` | Tried to remove an entity that's in combat | MapRemovalSystem | Use the flee function instead of direct removal |
| `SessionNotTimedOut()` | `0x99bc5f7d` | Tried to force-remove entity before session timeout (10 min) | MapRemovalSystem | Wait for SESSION_TIMEOUT (10 minutes) to elapse |
| `MoveTooFast()` | `0x326f4b4f` | Move submitted before MOVE_COOLDOWN elapsed | MapSystem | Wait for the cooldown between moves (currently 0 — client-enforced) |
| `NotAtRestPosition()` | `0x6d30f9af` | Character is not at position (0,0) for rest actions | WorldActionSystem | Return to spawn (0,0) before performing rest actions |

### Items & Equipment

| Error | Selector | Cause | System(s) | Resolution |
|---|---|---|---|---|
| `ArrayMismatch()` | `0xb7c1140d` | Input arrays have different lengths | ItemsSystem, ItemCreationSystem | Ensure all input arrays (IDs, amounts, metadata) have the same length |
| `NotWeapon()` | `0x3539c88f` | Item is not of type Weapon | ItemsSystem | Pass a weapon item ID |
| `NotArmor()` | `0xf54e6b08` | Item is not of type Armor | ItemsSystem | Pass an armor item ID |
| `NotConsumable()` | `0x9ce68c44` | Item is not of type Consumable | ItemsSystem | Pass a consumable item ID |
| `NoSupply()` | `0xad44c75c` | Item has zero total supply | ItemCreationSystem | Mint supply for the item first |
| `NotItemOwner()` | `0x3aa10643` | Character does not own the item | WorldActionSystem | Verify the character has the item in inventory |
| `MustUnequipItem()` | `0xab56f560` | Tried to drop or trade an equipped item | WorldActionSystem | Unequip the item before transferring |
| `OnlyHealingInCombat()` | `0xbd65d9a2` | Tried to use a non-healing consumable in combat | WorldActionSystem | Only healing items can be used during combat |
| `ItemNotFound()` | `0xd3ed043d` | Item does not exist in the Items table | AdminTuningSystem | Verify the item ID exists |

### Equipment System (ArmorSystem)

| Error | Selector | Cause | System(s) | Resolution |
|---|---|---|---|---|
| `ArmorSystem_CharacterNotFound()` | `0x5c7140a2` | Character entity does not exist | ArmorSystem | Pass a valid character ID |
| `ArmorSystem_ItemNotFound()` | `0x25f5b28c` | Item entity does not exist | ArmorSystem | Pass a valid item ID |
| `ArmorSystem_NotArmor()` | `0xe0500ba1` | Item is not an armor type | ArmorSystem | Only armor items can be equipped in armor slots |
| `ArmorSystem_AlreadyEquipped()` | `0x6ff0fd22` | Armor slot already occupied, or same item already equipped | ArmorSystem | Unequip current armor first |
| `ArmorSystem_NotEquipped()` | `0xf8cbe166` | Trying to unequip armor that is not equipped | ArmorSystem | Verify the item is actually equipped |
| `ArmorSystem_RequirementsNotMet()` | `0xc0afe28a` | Character stats do not meet armor requirements | ArmorSystem | Level up or allocate stats to meet minimum requirements |
| `ArmorSystem_LevelTooLow()` | `0x770f2aa4` | Character level is below the item's minimum level | ArmorSystem | Level up the character |
| `ArmorSystem_NoArmorSlot()` | `0x1c5569d7` | No available armor slot for this armor type | ArmorSystem | Unequip an existing armor piece to free the slot |

### Equipment System (AccessorySystem)

| Error | Selector | Cause | System(s) | Resolution |
|---|---|---|---|---|
| `AccessorySystem_CharacterNotFound()` | `0x4d74da00` | Character entity does not exist | AccessorySystem | Pass a valid character ID |
| `AccessorySystem_ItemNotFound()` | `0x69ab671c` | Item entity does not exist | AccessorySystem | Pass a valid item ID |
| `AccessorySystem_NotAccessory()` | `0x36d7e3cb` | Item is not an accessory type | AccessorySystem | Only accessory items can be equipped in accessory slots |
| `AccessorySystem_AlreadyEquipped()` | `0xde185802` | Accessory slot already occupied | AccessorySystem | Unequip current accessory first |
| `AccessorySystem_NotEquipped()` | `0x85103f42` | Trying to unequip accessory that is not equipped | AccessorySystem | Verify the item is actually equipped |
| `AccessorySystem_RequirementsNotMet()` | `0xf28a1e17` | Character stats do not meet accessory requirements | AccessorySystem | Level up or allocate stats to meet minimum requirements |
| `AccessorySystem_LevelTooLow()` | `0x5ac215b2` | Character level is below the item's minimum level | AccessorySystem | Level up the character |

### Level System

| Error | Selector | Cause | System(s) | Resolution |
|---|---|---|---|---|
| `LevelSystem_CharacterNotFound()` | `0xe78e2e7f` | Character entity does not exist | LevelSystem | Pass a valid character ID |
| `LevelSystem_InvalidLevel()` | `0xd574af85` | Target level is invalid | LevelSystem | Internal error — report as a bug |
| `LevelSystem_InvalidStatChanges()` | `0x53b1d713` | Stat point allocation does not match available budget | LevelSystem | Ensure total stat point changes equal the points granted for that level |
| `LevelSystem_CharacterInCombat()` | `0xe22ec585` | Cannot level up while in an encounter | LevelSystem | Finish or flee the encounter first |
| `LevelSystem_MaxLevelReached()` | `0x5d59fa83` | Character is already at MAX_LEVEL (100) | LevelSystem | Character cannot level further |
| `LevelSystem_InsufficientExperience()` | `0xa8d5e4d2` | Not enough XP to level up | LevelSystem | Earn more XP from combat before leveling |

### Effects

| Error | Selector | Cause | System(s) | Resolution |
|---|---|---|---|---|
| `InvalidEffectConfig()` | `0xb3e02fee` | Effect configuration is contradictory (e.g., instant effect with validTurns, or DoT without validTurns) | EffectDataSystem | Fix the effect data — instant effects must have validTurns=0 and damagePerTick=0 |
| `NonExistentIndex()` | `0x779f4f82` | Effect index exceeds the effects array length | EffectsSystem | Pass a valid index within the effects array |
| `InvalidEffect()` | `0xc46e385f` | Effect stat ID mismatch or effect does not match expected configuration | EffectsSystem | Verify the effect ID matches the world-registered effect |
| `InvalidEffectApplication()` | `0xa2efb0c6` | Effect cannot be applied in the current context | EffectsSystem | Check effect type compatibility with the target |
| `InvalidEffectType()` | `0xa4840cbb` | Effect type enum is not recognized | EffectsSystem | Use a valid EffectType enum value |
| `EffectNotApplied()` | `0xcf75903f` | Trying to remove an effect that is not currently applied | EffectsSystem | Verify the effect is active on the target |
| `NotEffectType()` | `0xdbed3dc4` | Effect exists but is not the expected type (Physical/Magic/Status) | EffectDataSystem, EffectsSystem | Use the correct function for the effect's type |

### Loot & Gold

| Error | Selector | Cause | System(s) | Resolution |
|---|---|---|---|---|
| `InvalidRewardState()` | `0xce2521ff` | Encounter not ended or rewards already distributed | PveRewardSystem, PvpRewardSystem | Ensure the encounter has ended and rewards haven't been claimed yet |
| `NotAtSpawn()` | `0x37943517` | Character is not at position (0,0) for gold operations | LootManagerSystem | Move to spawn (0,0) before depositing/withdrawing gold |
| `InsufficientBalance()` | `0xf4d678b8` | Not enough gold for the operation | LootManagerSystem, GasStationSystem | Earn more gold or reduce the transaction amount |

### Combat

| Error | Selector | Cause | System(s) | Resolution |
|---|---|---|---|---|
| `ActionNotFound()` | `0x39f609e8` | Effect data does not exist for the submitted action | CombatSystem | Verify the effect ID is registered in the world |
| `ItemNotEquipped()` | `0x54962c76` | Combat action references an item not in the equipped set | CombatSystem | Equip the item before using it in combat |
| `ActionTypeNotRecognized()` | `0xbb1f5f1e` | Combat action type is not handled | CombatSystem | Internal error — report as a bug |
| `InvalidMagicItemType()` | `0x0f53fbcc` | Item used for magic attack is not a valid magic item | CombatSystem | Use a staff, wand, or other magic-type weapon |
| `InvalidAction()` | `0x4a7f394f` | Item does not have the specified effect | CombatSystem | Verify the item actually grants the effect being used |
| `UnrecognizedResistanceStat()` | `0xd7663649` | Resistance stat enum not handled in damage calculation | CombatSystem | Internal error — report as a bug |
| `InvalidMoves()` | `0x53c48e22` | Empty moves array submitted to RNG system | RngSystem | Submit at least one combat move |
| `UnrecognizedCombatType()` | `0x4e93eeea` | Combat type not handled in RNG request | RngSystem | Internal error — report as a bug |
| `UnrecognizedRequestType()` | `0x4d0743d7` | RNG request type not recognized | RngSystem | Internal error — report as a bug |

### Mob

| Error | Selector | Cause | System(s) | Resolution |
|---|---|---|---|---|
| `MaxMobTypes()` | `0xecea39ab` | Mob type ID exceeds uint32 max | MobSystem | Too many mob types registered — should not occur in practice |
| `MobArrayMismatch()` | `0xdd94cf19` | Input arrays for batch mob creation have different lengths | MobSystem | Ensure metadata URIs and stats arrays match the mob ID array length |
| `WrongMobType()` | `0x64b92770` | Mob is not the expected type (NPC vs. Monster) | MobSystem | Use the correct function for the mob's type |
| `MaxMobSpawns()` | `0x5ffeddff` | Mob spawn counter exceeds uint192 max | MobSystem | Theoretical limit — should not occur in practice |

### Stats

| Error | Selector | Cause | System(s) | Resolution |
|---|---|---|---|---|
| `NegativeStat()` | `0x72af8dba` | A stat calculation would result in a negative value | Stat calculations | Internal safeguard — indicates a bug in stat math |

### Fragment System

| Error | Selector | Cause | System(s) | Resolution |
|---|---|---|---|---|
| `InvalidFragmentType()` | `0x76d73d71` | Fragment type is not between 1 and 8 | FragmentSystem | Pass a fragment type in range [1, 8] |
| `NotCharacterOwner()` | `0xe5bbad0c` | Caller does not own the character | FragmentSystem | Only the character owner can claim fragments |
| `FragmentNotTriggered()` | `0xffe212b8` | Fragment has not been triggered for this character | FragmentSystem | Complete the in-game trigger (e.g., defeat the required mob) before claiming |
| `FragmentAlreadyClaimed()` | `0x6d658389` | Fragment NFT has already been claimed | FragmentSystem | Each fragment can only be claimed once per character |
| `TokenAlreadyMinted()` | `0x00a5a1f5` | Fragment token ID is already owned | FragmentSystem | Token collision — should not occur in normal operation |

### GasStation

| Error | Selector | Cause | System(s) | Resolution |
|---|---|---|---|---|
| `GasStationDisabled()` | `0xb7581a8a` | GasStation feature is turned off | GasStationSystem | Admin must enable GasStation via config |
| `GasStationCooldownActive()` | `0xca8943f1` | Player swapped too recently (within DEFAULT_GAS_COOLDOWN = 60s) | GasStationSystem | Wait 60 seconds between gas swaps |
| `GasStationMaxSwapExceeded()` | `0x645a71fd` | Gold amount exceeds DEFAULT_MAX_GOLD_PER_SWAP (500 Gold) | GasStationSystem | Reduce the gold amount to 500 or below |
| `GasStationInsufficientTreasury()` | `0x554129b5` | World contract does not have enough ETH for the swap | GasStationSystem | Fund the world contract with ETH, or wait for admin to replenish |
| `GasStationBelowMinLevel()` | `0x9523c7cb` | Character is below GAS_STATION_MIN_LEVEL (level 3) | GasStationSystem | Level the character to 3 before using GasStation |
| `GasStationTransferFailed()` | `0x65d58d99` | ETH transfer to player failed | GasStationSystem | Player address may be a contract that rejects ETH — check recipient |
| `GasStationZeroAmount()` | `0x198b97b1` | Gold amount is zero | GasStationSystem | Pass a non-zero gold amount |
| `GasStationSwapFailed()` | `0x376e1b5c` | Uniswap swap returned 0 WETH | GasStationSystem | Liquidity issue on the WETH/Gold pool — check Uniswap pool state |
| `GasStationNotRelayer()` | `0xa847d334` | Caller is not the registered relayer address | GasStationSystem | Only the configured relayer EOA can call gas charge functions |
| `GasStationArrayMismatch()` | `0x0e2c623c` | Players and characterIds arrays have different lengths | GasStationSystem | Ensure both arrays are the same length in batch operations |

---

## 2. MUD Framework Errors

These errors come from the MUD World framework itself, not from Ultimate Dominion systems.

| Error | Selector | Cause | Resolution |
|---|---|---|---|
| `World_AccessDenied(string,address)` | `0xd787b737` | System or caller lacks namespace/table access | Grant the system access to the required namespace via `World.grantAccess()`. Check that the system is registered under the correct namespace (`UD`, `Gold`, `Characters`, `Items`, `Badges`, `Fragments`). |
| `World_ResourceNotFound(bytes32)` | `0xd018e14e` | System or table resource ID not registered in the World | Run `mud deploy` to register the system. Verify the resource ID matches what was deployed. Check for bytecode mismatch causing a new World deploy. |
| `World_CallbackNotAllowed(bytes4)` | `0x284b09e0` | A system tried to call back into the World in a prohibited way | Remove the reentrant call. Systems should not call `prohibitDirectCallback` functions. |
| `World_SystemAlreadyExists(bytes32)` | N/A | Attempting to register a system that already exists | Use system upgrade instead of fresh registration. |
| `World_InvalidResourceId(bytes32)` | N/A | Malformed resource ID (wrong type prefix or length) | Check the resource ID encoding — must be `bytes32` with correct type prefix (`tb` for table, `sy` for system, `ns` for namespace). |
| `Store_InvalidResourceType(bytes2)` | N/A | Wrong resource type byte prefix for a store operation | Verify the table ID has the correct `tb` prefix. |
| `Store_TableAlreadyExists(bytes32)` | N/A | Table already registered with a different schema | Schema has changed — either add a new table with a different name or write a migration. Never modify a table schema with live player data. |
| `Store_InvalidSplice(...)` | N/A | Static/dynamic data length mismatch on write | Schema mismatch between client expectations and deployed table schema. Redeploy or check ABI. |

**Common MUD troubleshooting steps:**
1. After `mud deploy`, always verify function selectors with `cast sig`.
2. If systems suddenly lose access, check if a redeployment created a NEW World (different address) due to compiler setting changes.
3. `address(this)` inside a MUD system returns the World address when called via delegatecall — but after a system upgrade, the system contract address changes, so any data keyed by `address(this)` at the old system address is orphaned.

---

## 3. Client-Side Errors

### "Buffer is not defined"
- **Cause**: Missing Node.js polyfill in the browser environment. Viem and some crypto libraries expect `Buffer` to be available.
- **Fix**: Ensure the Vite config includes the Buffer polyfill. Check `vite.config.ts` for `define: { global: 'globalThis' }` and the `buffer` package in `optimizeDeps`.

### Gas estimation failures
- **Cause**: Almost always a contract revert. The RPC node tries to simulate the transaction and it fails.
- **Debug**: Extract the 4-byte selector from the error data and match it against the tables above. Common culprits:
  - `Unauthorized()` — wallet not connected or wrong account
  - `InEncounter()` — player tried to move while in combat
  - `CharacterLocked()` — tried to modify a spawned character
- **Fix**: Address the underlying revert cause. If the error data is empty, the revert may be from a low-level call (e.g., ETH transfer failure).

### Nonce errors ("nonce too low" / "nonce already used")
- **Cause**: Relayer pool contention. Multiple relayer EOAs may be racing, or a previous transaction is still pending.
- **Debug**: Check the relayer pool status. Each of the 5 EOAs has its own nonce counter.
- **Fix**: Wait for pending transactions to confirm. If persistent, reset the nonce tracking in the relayer service. The relayer auto-recovers in most cases.

### "Transaction replaced" / "transaction underpriced"
- **Cause**: A replacement transaction was submitted with the same nonce but higher gas price, or the original transaction's gas price is too low for current network conditions.
- **Fix**: The relayer handles gas bumping automatically. If the user sees this, it usually means the original transaction succeeded — check the chain.

### "Chain mismatch" / wrong chainId
- **Cause**: Wallet is connected to the wrong network.
- **Fix**: Ensure the wallet is on Base Mainnet (chain 8453). The client validates `chainId` against `supportedChains`.

### CORS / network errors on RPC calls
- **Cause**: Self-hosted RPC node (`rpc.ultimatedominion.com`) may be down or rate-limiting.
- **Fix**: Check the RPC node health. Fallback to a public Base RPC if needed.

---

## 4. Forge / Development Errors

### "Internal transport error"
- **Cause**: Intermittent Foundry bug on macOS. Affects `forge test`, `forge script`, and `forge build`.
- **Fix**: Run `forge clean` and retry. If persistent, wrap the command in `/bin/bash -c 'forge test'`. Restarting the terminal session sometimes helps.

### Nonce mismatch on deploy
- **Cause**: `mud deploy` can silently skip transactions when nonce errors occur, leaving the deployment in a partial state.
- **Debug**: After every deploy, verify function selectors with `cast sig` against the deployed contracts.
- **Fix**: Re-run `mud deploy` with `--worldAddress` to retry failed registrations. Check that all systems are registered and have correct access.

### Bytecode mismatch — new World deployed instead of upgrade
- **Cause**: Compiler settings changed (e.g., `optimizer_runs`, `via_ir`), which changes all contract bytecodes. MUD uses CREATE2 for deterministic addresses, so different bytecode = different address = MUD deploys a fresh World instead of upgrading the existing one.
- **Fix**: Always use `--worldAddress` flag when deploying to existing chains. Keep compiler settings identical across deploys. If a new World was accidentally deployed, revert to the correct `WORLD_ADDRESS` and redeploy with matching settings.
- **Prevention**: Lock `foundry.toml` optimizer settings. Never change them on a whim.

### "Stack too deep" compilation error
- **Cause**: Solidity's EVM stack limit (16 slots) exceeded in a function with too many local variables.
- **Fix**: Extract logic into internal helper functions, use structs to bundle variables, or enable `via_ir` (but beware: changing `via_ir` changes all bytecodes — see above).

### Forge test failures after system changes
- **Cause**: Test suite may rely on hardcoded entity IDs, encounter states, or specific turn sequences that changed.
- **Fix**: Run `forge test -vvv` for detailed stack traces. Check that test setup matches the current contract state.

---

## 5. Quick Selector Lookup

For fast reference, here are all selectors sorted alphabetically by error name:

```
0x39f609e8  ActionNotFound()
0x4d74da00  AccessorySystem_CharacterNotFound()
0xde185802  AccessorySystem_AlreadyEquipped()
0x69ab671c  AccessorySystem_ItemNotFound()
0x5ac215b2  AccessorySystem_LevelTooLow()
0x36d7e3cb  AccessorySystem_NotAccessory()
0x85103f42  AccessorySystem_NotEquipped()
0xf28a1e17  AccessorySystem_RequirementsNotMet()
0xbb1f5f1e  ActionTypeNotRecognized()
0x0769bef0  AlreadyInEncounter()
0xb7298922  AlreadySpawned()
0x3c486b94  ArmorAlreadySet()
0x5c7140a2  ArmorSystem_CharacterNotFound()
0x6ff0fd22  ArmorSystem_AlreadyEquipped()
0x25f5b28c  ArmorSystem_ItemNotFound()
0x770f2aa4  ArmorSystem_LevelTooLow()
0x1c5569d7  ArmorSystem_NoArmorSlot()
0xe0500ba1  ArmorSystem_NotArmor()
0xf8cbe166  ArmorSystem_NotEquipped()
0xc0afe28a  ArmorSystem_RequirementsNotMet()
0xb7c1140d  ArrayMismatch()
0xfb2fd46b  CanOnlyFleeFirstTurn()
0x514ff012  CannotLevelInCombat()
0x025045d4  CannotEndTurn()
0x30e36817  CharacterDead()
0x261fa6d6  CharacterLocked()
0xb759fa67  CombatantHpZero()
0xcf75903f  EffectNotApplied()
0x08f8364b  EncounterAlreadyOver()
0xd5bbc5d0  ExpiredEncounter()
0x6d658389  FragmentAlreadyClaimed()
0xffe212b8  FragmentNotTriggered()
0x379a7ed9  GamePaused()
0x0e2c623c  GasStationArrayMismatch()
0x9523c7cb  GasStationBelowMinLevel()
0xca8943f1  GasStationCooldownActive()
0xb7581a8a  GasStationDisabled()
0x554129b5  GasStationInsufficientTreasury()
0x645a71fd  GasStationMaxSwapExceeded()
0xa847d334  GasStationNotRelayer()
0x376e1b5c  GasStationSwapFailed()
0x65d58d99  GasStationTransferFailed()
0x198b97b1  GasStationZeroAmount()
0x63754e43  InEncounter()
0xf4d678b8  InsufficientBalance()
0x16a8a709  InsufficientItemBalance()
0xb8bad4c1  InsufficientStat()
0x6d187b28  InvalidAccount()
0x4a7f394f  InvalidAction()
0xab97502e  InvalidAdvancedClass()
0x71b98e70  InvalidArmorType()
0x312a9f56  InvalidCharacter()
0x1af235ec  InvalidCombatEntity()
0xc46e385f  InvalidEffect()
0xa2efb0c6  InvalidEffectApplication()
0xb3e02fee  InvalidEffectConfig()
0xa4840cbb  InvalidEffectType()
0xd8deb7b5  InvalidEncounter()
0x4f331f71  InvalidEncounterType()
0x39fed10d  InvalidFlee()
0x76d73d71  InvalidFragmentType()
0x2cbdc231  InvalidGroupSize()
0x7932f1fc  InvalidItemType()
0x0f53fbcc  InvalidMagicItemType()
0x87822d34  InvalidMove()
0x53c48e22  InvalidMoves()
0xf7c3171a  InvalidPowerSource()
0xa4385cbb  InvalidPvP()
0xadee4371  InvalidPvE()
0x42e6ce25  InvalidRace()
0xce2521ff  InvalidRewardState()
0x6bbd0237  InvalidShopEncounter()
0x46db0415  InvalidShopEntity()
0x81c5c748  InvalidStatChange()
0x572721e0  InvalidStarterItem()
0x442473f8  InvalidTokenUri()
0x4afb32d9  InvalidWorldLocation()
0x54962c76  ItemNotEquipped()
0xd3ed043d  ItemNotFound()
0xe22ec585  LevelSystem_CharacterInCombat()
0xe78e2e7f  LevelSystem_CharacterNotFound()
0xa8d5e4d2  LevelSystem_InsufficientExperience()
0xd574af85  LevelSystem_InvalidLevel()
0x53b1d713  LevelSystem_InvalidStatChanges()
0x5d59fa83  LevelSystem_MaxLevelReached()
0x0762d547  MaxCharacters()
0xecea39ab  MaxMobTypes()
0x5ffeddff  MaxMobSpawns()
0x87d14a36  MaxPlayers()
0x9b06ec25  MaxStatRollsExceeded()
0xdd94cf19  MobArrayMismatch()
0x326f4b4f  MoveTooFast()
0xd0cc5baa  MustChooseRaceFirst()
0x37469947  MustChoosePowerSourceFirst()
0xab56f560  MustUnequipItem()
0x72af8dba  NegativeStat()
0x130e42e3  NoMonsters()
0xad44c75c  NoSupply()
0x8fa2ffa1  NoWeaponsEquipped()
0x2090d0eb  NonCombatant()
0x779f4f82  NonExistentIndex()
0x7bfa4b9f  NotAdmin()
0xf54e6b08  NotArmor()
0x6d30f9af  NotAtRestPosition()
0x9d026e7f  NotAtShopPosition()
0x37943517  NotAtSpawn()
0x7046c88d  NotAuthorizedCaller()
0xe5bbad0c  NotCharacterOwner()
0x6f53077d  NotCombatEncounter()
0x9ce68c44  NotConsumable()
0xdbed3dc4  NotEffectType()
0x5ce83b2d  NotInEncounter()
0x3aa10643  NotItemOwner()
0x78d73082  NotOwnShopEncounter()
0xbd45e4f6  NotSpawned()
0x3539c88f  NotWeapon()
0xb8a03426  OnlyCharacters()
0xbd65d9a2  OnlyHealingInCombat()
0xb4120f14  OutOfBounds()
0xade1cb41  OutOfStock()
0xb347e4e5  PowerSourceAlreadySet()
0xdc37ef01  RaceAlreadySet()
0xcbeca0ab  RequiresLevel10()
0x99bc5f7d  SessionNotTimedOut()
0x4a675dad  ShopInsufficientGold()
0x00a5a1f5  TokenAlreadyMinted()
0x82b42900  Unauthorized()
0x4e93eeea  UnrecognizedCombatType()
0x9310ec80  UnrecognizedEncounterType()
0x4d0743d7  UnrecognizedRequestType()
0xd7663649  UnrecognizedResistanceStat()
0xb4310fba  UseFleeFunction()
0x64b92770  WrongMobType()
```

---

*Last updated: March 9, 2026*
