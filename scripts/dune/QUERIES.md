# Dune Dashboard Queries — Ultimate Dominion

Phase 1 queries. All target Base Mainnet, World `0x99d01939F58B965E6E84a1D167E710Abdf5764b0`.

## Query IDs

| # | Name | Query ID | Dune Link |
|---|------|----------|-----------|
| 1 | Player Growth | 6898724 | https://dune.com/queries/6898724 |
| 2 | Gold Price (ETH) | 6898725 | https://dune.com/queries/6898725 |
| 3 | Daily Active Users | 6898726 | https://dune.com/queries/6898726 |
| 4 | Gold Total Supply | 6898727 | https://dune.com/queries/6898727 |
| 5 | Level Distribution | 6898728 | https://dune.com/queries/6898728 |

## Key Addresses

| Contract | Address |
|----------|---------|
| World | `0x99d01939F58B965E6E84a1D167E710Abdf5764b0` |
| Gold ERC20 | `0x0F046E538926760A737761b555fe1074b6B1e16A` |
| Character ERC721 (puppet) | `0x082944c0f4b2b976be56b593e7d53eef7b3c2e30` |
| Items ERC1155 (puppet) | `0xc17fe588f33ef9e60af2ce8070d4ea39fad0b531` |
| Gold/WETH Pool | `0xE09639634Ba44B86c59dA7703aA9796f88082526` |

## MUD Table IDs

| Table | ID |
|-------|-----|
| SessionTimer | `0x7462554400000000000000000000000053657373696f6e54696d657200000000` |
| Stats | `0x7462554400000000000000000000000053746174730000000000000000000000` |
| Characters | `0x7462554400000000000000000000000043686172616374657273000000000000` |

## MUD Event Topic0 Hashes

| Event | Topic0 |
|-------|--------|
| Store_SetRecord | `0x8dbb3a9672eebfd3773e72dd9c102393436816d832c7ba9e1e1ac8fcadcac7a9` |
| Store_SpliceStaticData | `0x8c0b5119d4cec7b284c6b1b39252a03d1e2f2d7451a5895562524c113bb952be` |
| Store_DeleteRecord | `0x0e1f72f429eb97e64878619984a91e687ae91610348b9ff4216782cc96e49d07` |

## Notes

- **Character mints**: UD systems bypass the ERC721 puppet (direct MUD table writes via StoreSwitch), so no Transfer events. Player Growth uses Characters table Store_SetRecord events instead.
- **Gold supply**: Only tracks from GoldERC20System activation (~March 23). Pre-ERC20 gold was virtual.
- **Level distribution**: Joins Characters → Stats to exclude mob entities (mobs are never deleted from Stats table, 0 DeleteRecord events).
- **DAU**: Uses SessionTimer Store events (both SpliceStaticData and SetRecord) with different byte offsets for entity extraction.
- **Store_SetRecord entity offsets**: keyTuple[0] at byte 161 (4-slot ABI head + length word). Store_SpliceStaticData: byte 129 (3-slot head). Store_DeleteRecord: byte 65 (1-slot head).

## Debug Queries (can delete)

| Query ID | Purpose |
|----------|---------|
| 6898732 | Puppet event count |
| 6898733 | base.logs schema check |
| 6898743 | Stats SetRecord vs DeleteRecord counts |
