# Authentication & Wallet Integration

How players authenticate, obtain wallets, and pay for gas in Ultimate Dominion.

---

## Table of Contents

1. [Auth Model Overview](#auth-model-overview)
2. [Privy Embedded Wallet Flow](#privy-embedded-wallet-flow)
3. [RainbowKit / MetaMask Flow](#rainbowkit--metamask-flow)
4. [Crypto Abstraction](#crypto-abstraction)
5. [Session Persistence](#session-persistence)
6. [Gas Station Integration](#gas-station-integration)

---

## Auth Model Overview

Two authentication paths coexist, selected by the player on the sign-in modal (`SignInModal.tsx`). Both produce a standard EOA wallet and a viem `WalletClient` that signs transactions directly on Base Mainnet. There are no meta-transactions, no bundlers, and no paymaster relays in the transaction path.

| Path | Target Audience | Entry Point | Wallet Type | Delegation Required |
|------|----------------|-------------|-------------|---------------------|
| **Privy Embedded** | Non-crypto users | "Sign in with Google" | MPC wallet (Privy SDK) | No |
| **RainbowKit External** | Crypto-native users | "Sign in with Wallet" | MetaMask / injected | Yes (GameDelegationControl) |

The external wallet option only appears when `window.ethereum` is detected. Players who hide the option via localStorage (`ud:hideInjectedWallet`) will see only the Google path.

### Provider Hierarchy

```
PrivyProvider           (outermost — must catch OAuth redirect params immediately)
  Web3Provider          (wagmi + RainbowKit config)
    AuthProvider        (resolves auth method, exposes walletClient + ownerAddress)
      MUDProvider       (world contract, burner/embedded setup, delegation, system calls)
        App             (routes, game contexts)
```

`PrivyProvider` wraps everything and is rendered synchronously in `index.tsx` before the rest of the app lazy-loads. This is required because Privy needs to intercept OAuth callback parameters on the redirect before any other code runs.

**Key files:**
- `packages/client/src/index.tsx` — PrivyProvider config, lazy loading
- `packages/client/src/contexts/AuthContext.tsx` — dual-path auth state
- `packages/client/src/contexts/Web3Provider.tsx` — wagmi + RainbowKit
- `packages/client/src/contexts/MUDContext.tsx` — world contract, delegation, system calls

---

## Privy Embedded Wallet Flow

For players who have no crypto experience. The entire blockchain layer is invisible.

### Step-by-step

1. **Player clicks "Sign in with Google"** in `SignInModal.tsx`
2. **`connectWithGoogle()`** calls `initOAuth({ provider: 'google' })` via Privy's `useLoginWithOAuth` hook
3. **Google OAuth redirect** — player authenticates with Google, browser redirects back
4. **Privy creates an MPC wallet** on-device (no server-side key custody). The wallet is a standard EOA that signs transactions locally using multi-party computation
5. **`AuthContext` detects the Privy wallet** (`walletClientType === 'privy'`), extracts an `EthereumProvider`, and wraps it in a viem `WalletClient`
6. **Auth state resolves**: `authMethod = 'embedded'`, `isAuthenticated = true`, `ownerAddress` set
7. **MUDContext initializes** the embedded path — creates a world contract instance using the Privy wallet client directly (no burner wallet, no delegation)

### Transaction Serialization

Privy's `EthereumProvider` does not track pending nonces. Concurrent `eth_sendTransaction` calls (e.g., AllowanceContext auto-approvals firing alongside character creation) will grab the same nonce, causing "replacement tx underpriced" errors. `AuthContext` wraps the provider with a promise queue that serializes all `eth_sendTransaction` calls.

### viem Compatibility Shim

viem v2.35 sends `wallet_sendTransaction`, but Privy's provider only intercepts `eth_sendTransaction` for local MPC signing. The wrapped provider rewrites the method name before forwarding.

### Buffer Polyfill

The Privy SDK depends on Node.js `Buffer`, which does not exist in browsers. `index.tsx` polyfills it at the top of the file:

```ts
import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;
(globalThis as any).global = globalThis;
```

This must execute before any Privy imports.

### First-Login Gas Funding

On first sign-in, `AuthContext` sends a POST to the relayer's `/fund` endpoint with the new wallet address. The relayer transfers a small amount of ETH to cover initial transactions (character creation, first few moves). This is tracked per-address in localStorage (`ud:gasFunded:{address}`) and only happens once.

### Email Registration

After Google auth, the player's email is sent to two backends:
- **API** (`/api/signup`) — adds to Resend audience, triggers welcome email
- **Indexer** (`/api/queue/player/email`) — stores wallet-to-email mapping for queue notifications

This is rate-limited per session via `sessionStorage`.

---

## RainbowKit / MetaMask Flow

For crypto-native players who want to use their own wallet.

### Step-by-step

1. **Player clicks "Sign in with Wallet"** (only visible when `window.ethereum` is detected)
2. **RainbowKit `ConnectButton`** opens — player selects MetaMask (or another injected wallet) and approves the connection
3. **wagmi resolves** `isConnected`, `address`, and `walletClient`
4. **`AuthContext` resolves**: `authMethod = 'external'`, `isAuthenticated = true`
5. **`ConnectWalletModal` appears**: "Secure Your Session" — prompts the player to authorize a game session
6. **Player clicks "Authorize & Play"** (`DelegationButton.tsx`):
   - **Delegation TX (MetaMask popup 1)**: Calls `registerDelegation()` on the World contract, passing the burner wallet address and the `GameDelegationControl` system ID
   - **Session funding TX (MetaMask popup 2)**: Sends 0.0005 ETH to the burner wallet (enough for hundreds of Base transactions)
7. **`MUDContext.getBurner()`** reads the delegation from the chain, creates a burner `WalletClient` from localStorage, and sets `delegatorAddress`
8. **Navigation**: `ConnectWalletModal` detects `delegatorAddress` is set and navigates to the game

### GameDelegationControl Contract

The delegation is not unlimited. `GameDelegationControl.sol` restricts what the burner wallet can do:

- **System whitelist**: Only systems listed in the `AllowedGameSystems` MUD table can be called through delegation. Admin, pause, and config systems are excluded
- **Function-level filtering on LootManager**: Even though LootManager is whitelisted (for loot drops), the delegation blocks `transferGold()`, `setGoldApproval()`, and `setItemsApproval()`. A compromised burner can fight and move but cannot drain assets
- **Backwards compatibility**: The client accepts both the old `UNLIMITED_DELEGATION` and the new `GAME_DELEGATION` resource IDs when checking delegation status

The delegation resource ID is constructed from namespace `"UD"` and name `"GameDelegation"` (defined in `constants.sol` as `GAME_DELEGATION_NAME`).

### Burner Wallet

- Stored in localStorage (`mud:burnerWallet`)
- Generated client-side, never touches a server
- The player's main wallet delegates to the burner; the burner signs gameplay transactions without requiring MetaMask popups for every action
- On logout, delegation is revoked on-chain and the burner key is cleared from localStorage

### Revoking Delegation

Players can revoke delegation through the wallet details modal. This calls `unregisterDelegation()` on the World contract and clears the burner from localStorage. The player must re-delegate to play again.

**Key files:**
- `packages/client/src/lib/mud/delegation.ts` — setupDelegation, revokeDelegation, isDelegated
- `packages/client/src/components/DelegationButton.tsx` — "Authorize & Play" UI
- `packages/client/src/components/ConnectWalletModal.tsx` — delegation modal flow
- `packages/contracts/src/systems/GameDelegationControl.sol` — on-chain delegation control

---

## Crypto Abstraction

All blockchain terminology is replaced with game-friendly language. Players never see wallet addresses, gas fees, chain IDs, or transaction hashes in the UI.

| What the player sees | What actually happens |
|---------------------|----------------------|
| "Account" | Wallet (EOA address) |
| "Authorize" | Delegation (registerDelegation on-chain) |
| "Permission" | ERC20/ERC1155 allowance approval |
| "Gold" | $GOLD ERC20 token balance |
| "Action" | On-chain transaction |
| "Create" | Mint (ERC721/ERC1155) |
| "Destroy" | Burn (token removal) |
| "Game system" | Smart contract |

The external wallet flow labels the delegation step as "Secure Your Session" and "Authorize & Play" — never "delegate" or "register delegation". Allowance modals are labeled "Permissions".

---

## Session Persistence

### Privy (Embedded Path)

Privy manages session persistence internally. When a player returns to the site:

1. `PrivyProvider` checks for an existing authenticated session (stored by Privy's SDK in its own storage)
2. If found, `authenticated` becomes `true` and the `wallets` array populates with the player's MPC wallet
3. `AuthContext` detects this and initializes the wallet client — the player is signed in without any action

During this auto-reconnect window, `isConnecting` is `true`. Both `Welcome.tsx` and `GameBoard.tsx` check this flag:
- `Welcome.tsx` renders nothing while `isConnecting` is true to avoid flashing the sign-in modal
- `GameBoard.tsx` waits for auth to resolve before rendering game content

### RainbowKit (External Path)

wagmi persists the connected wallet state. On return:

1. wagmi auto-reconnects to the injected wallet
2. `AuthContext` resolves `authMethod = 'external'`
3. `MUDContext` reads the delegation from the chain and restores the burner wallet from localStorage
4. If the delegation is still valid, the player resumes play without any popups

### WebSocket Reconnection

The game state sync layer (Zustand store + WebSocket client) handles network interruptions with exponential backoff reconnection. When the browser tab is hidden and then re-shown, the WS client checks the connection state and reconnects immediately if dead, resetting the backoff counter.

---

## Gas Station Integration

The GasStation system handles gas economics for both auth paths. The goal: players think in Gold, never in ETH.

### How Gas is Funded

**Levels 1-2 (all players):**
- Embedded: Relayer sends a one-time ETH seed on first login (via `/fund` endpoint)
- External: Player deposits 0.0005 ETH during the delegation step

**Level 3+ (auto-swap kicks in):**
- The `useGasStation` hook (mounted in `App.tsx`) monitors the active wallet's ETH balance, which MUDContext polls every 30 seconds
- When balance drops below 0.0001 ETH (the `GAS_THRESHOLD`), the hook calls `buyGas(characterId, goldAmount)` on the GasStation contract
- Default swap: 50 Gold per auto-swap, rate-limited to once per 60 seconds client-side

### GasStationSystem Contract

Two swap modes, selected by admin configuration:

1. **Uniswap V3 mode** (when `swapRouter` is configured): Gold is transferred to the system contract, swapped for WETH on the GOLD/WETH Uniswap V3 pool, unwrapped, and sent as ETH to the player. Total Gold supply is unchanged — Gold re-enters circulation via DEX
2. **Treasury fallback** (when `swapRouter == address(0)`): Gold is burned from total supply, ETH is sent from a pre-funded treasury at a fixed `ethPerGold` rate

Both modes enforce:
- Minimum level 3 (`GAS_STATION_MIN_LEVEL`)
- Per-address cooldown (`cooldownSeconds`)
- Maximum Gold per swap (`maxGoldPerSwap`)
- Character ownership verification

### Relayer Gas Charging (Embedded Path)

For embedded wallet users, the self-hosted relayer sponsors gas by submitting transactions on the player's behalf. The relayer periodically charges Gold from embedded players via `chargeGasGold()` or `batchChargeGasGoldWithCounts()`:

- Only callable by the configured relayer address
- Transfers Gold from player to relayer (total supply unchanged)
- Supports batch charging across multiple players in a single transaction
- Fault-tolerant batch mode: skips ineligible players (wrong character, below level 3, zero Gold), charges partial amounts when full charge exceeds balance

### Out of Resources

When a level 3+ player has both 0 ETH and 0 Gold, the `OutOfResourcesModal` appears:
- **Embedded users**: "Fight a monster to earn Gold. Your next transaction will be sponsored." The relayer sponsors one more transaction so the player can earn Gold through combat
- **External users**: "Deposit ETH from your main wallet." Opens the wallet details modal

**Key files:**
- `packages/client/src/hooks/useGasStation.ts` — client-side auto-swap hook
- `packages/contracts/src/systems/GasStationSystem.sol` — on-chain swap/charge logic
- `packages/client/src/components/OutOfResourcesModal.tsx` — zero-resource recovery UI

---

*Last updated: March 9, 2026*
