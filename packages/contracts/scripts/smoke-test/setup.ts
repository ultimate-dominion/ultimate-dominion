import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Address,
  type Hex,
  type WalletClient,
  type PublicClient,
  type Account,
  keccak256,
  toHex,
  encodePacked,
  stringToHex,
} from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY as Hex;
const WORLD_ADDRESS = process.env.WORLD_ADDRESS as Address;

if (!RPC_URL) throw new Error("RPC_URL not set");
if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY not set");
if (!WORLD_ADDRESS) throw new Error("WORLD_ADDRESS not set");

export const worldAddress = WORLD_ADDRESS;

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

const deployerAccount = privateKeyToAccount(PRIVATE_KEY);

export const deployerWallet = createWalletClient({
  account: deployerAccount,
  chain: base,
  transport: http(RPC_URL),
});

// ---------------------------------------------------------------------------
// ABI — every World function the tests need
// ---------------------------------------------------------------------------

export const worldAbi = parseAbi([
  // Character creation
  "function UD__mintCharacter(address account, bytes32 name, string tokenUri) external returns (bytes32 characterId)",
  "function UD__chooseRace(bytes32 characterId, uint8 race) external",
  "function UD__choosePowerSource(bytes32 characterId, uint8 powerSource) external",
  "function UD__chooseStartingArmor(bytes32 characterId, uint8 armorType) external",
  "function UD__rollBaseStats(bytes32 userRandomNumber, bytes32 characterId) external payable",
  "function UD__enterGame(bytes32 characterId, uint256 starterWeaponId, uint256 starterArmorId) external",
  "function UD__spawn(bytes32 entityId) external",
  "function UD__getCharacterIdFromOwnerAddress(address ownerAddress) external view returns (bytes32)",
  "function UD__getOwnerAddress(bytes32 characterId) external pure returns (address)",

  // Movement & adventure
  "function UD__move(bytes32 entityId, uint16 x, uint16 y) external",
  "function UD__autoAdventure(bytes32 cid, uint16 x, uint16 y) external returns (bool combatOccurred, bool playerWon, bool playerDied, uint256 xpGained, uint256 goldGained, bytes32 encounterId)",
  "function UD__autoFight(bytes32 cid, bytes32 monsterId, uint256 weaponId) external returns (bool playerWon, bool playerDied, bytes32 encounterId)",

  // Leveling
  "function UD__levelCharacter(bytes32 characterId, (int256 strength, int256 agility, uint8 class, int256 intelligence, int256 maxHp, int256 currentHp, uint256 experience, uint256 level, uint8 powerSource, uint8 race, uint8 startingArmor, uint8 advancedClass, bool hasSelectedAdvancedClass) desiredStats) external",
  "function UD__selectAdvancedClass(bytes32 characterId, uint8 advancedClass) external",

  // Equipment
  "function UD__equipItems(bytes32 characterId, uint256[] itemIds) external",
  "function UD__unequipItem(bytes32 characterId, uint256 itemId) external returns (bool success)",

  // Shop
  "function UD__buy(uint256 amount, bytes32 shopId, uint256 itemIndex, bytes32 characterId) external",
  "function UD__sell(uint256 amount, bytes32 shopId, uint256 itemIndex, bytes32 characterId) external",
  "function UD__sellAny(uint256 amount, bytes32 shopId, uint256 itemId, bytes32 characterId) external",

  // Marketplace
  "function UD__createOrder((( uint8 tokenType, address token, uint256 identifier, uint256 amount) offer, (uint8 tokenType, address token, uint256 identifier, uint256 amount, address recipient) consideration, bytes signature, address offerer) order) external returns (bytes32 orderHash)",
  "function UD__fulfillOrder(bytes32 orderHash) external returns (bool fulfilled)",
  "function UD__getOrderStatus(bytes32 orderHash) external view returns (uint8 orderStatus)",
  "function UD__getCounter(address offerer) external view returns (uint256)",
  "function UD__incrementCounter(address offerer) external returns (uint256)",
  "function UD__marketplaceAddress() external view returns (address)",

  // Encounter / PvP
  "function UD__createEncounter(uint8 encounterType, bytes32[] group1, bytes32[] group2) external returns (bytes32 encounterId)",
  "function UD__endTurn(bytes32 encounterId, bytes32 playerId, (bytes32 attackerEntityId, bytes32 defenderEntityId, uint256 itemId)[] attacks) external payable",

  // Rest
  "function UD__rest(bytes32 characterId) external",

  // Views — stats & map
  "function UD__getStats(bytes32 characterId) external view returns ((int256 strength, int256 agility, uint8 class, int256 intelligence, int256 maxHp, int256 currentHp, uint256 experience, uint256 level, uint8 powerSource, uint8 race, uint8 startingArmor, uint8 advancedClass, bool hasSelectedAdvancedClass))",
  "function UD__getLevel(bytes32 characterId) external view returns (uint256)",
  "function UD__getExperience(bytes32 characterId) external view returns (uint256)",
  "function UD__getEntityPosition(bytes32 entityId) external view returns (uint16 x, uint16 y)",
  "function UD__getEntitiesAtPosition(uint16 x, uint16 y) external view returns (bytes32[])",
  "function UD__getSpawnedPlayerCount() external view returns (uint256)",
  "function UD__isValidCharacterId(bytes32 characterId) external view returns (bool)",

  // Views — items
  "function UD__isStarterItem(uint256 itemId) external view returns (bool)",
  "function UD__getItemType(uint256 itemId) external view returns (uint8)",
  "function UD__isEquipped(bytes32 characterId, uint256 itemId) external view returns (bool)",
  "function UD__getItemBalance(bytes32 entityId, uint256 itemId) external view returns (uint256)",
  "function UD__hasSpellConfig(bytes32 effectId) external view returns (bool)",

  // Views — config
  "function UD__getGoldToken() external view returns (address)",
  "function UD__getItemsContract() external view returns (address)",

  // Views — shop
  "function UD__isShop(bytes32 shopId) external view returns (bool)",
  "function UD__itemStock(bytes32 shopId, uint256 itemIndex) external view returns (uint256)",

  // Admin
  "function UD__adminSetStats(bytes32 entityId, (int256 strength, int256 agility, uint8 class, int256 intelligence, int256 maxHp, int256 currentHp, uint256 experience, uint256 level, uint8 powerSource, uint8 race, uint8 startingArmor, uint8 advancedClass, bool hasSelectedAdvancedClass) desiredStats) external",
  "function UD__adminDropGold(bytes32 characterId, uint256 goldAmount) external",
  "function UD__adminDropItem(bytes32 characterId, uint256 itemId, uint256 amount) external",
  "function UD__adminClearEncounterState(bytes32 entityId) external",
  "function UD__adminMoveEntity(bytes32 entityId, uint16 x, uint16 y) external",
]);

// Minimal ERC20 ABI for gold balance reads
export const erc20Abi = parseAbi([
  "function balanceOf(address account) external view returns (uint256)",
]);

// ---------------------------------------------------------------------------
// Enums (matching common.sol)
// ---------------------------------------------------------------------------

export enum Race {
  None = 0,
  Human = 1,
  Elf = 2,
  Dwarf = 3,
}

export enum PowerSource {
  None = 0,
  Divine = 1,
  Weave = 2,
  Physical = 3,
}

export enum ArmorType {
  None = 0,
  Cloth = 1,
  Leather = 2,
  Plate = 3,
}

export enum Classes {
  Warrior = 0,
  Rogue = 1,
  Mage = 2,
}

export enum AdvancedClass {
  None = 0,
  Paladin = 1,
  Sorcerer = 2,
  Warrior = 3,
  Druid = 4,
  Warlock = 5,
  Ranger = 6,
  Cleric = 7,
  Wizard = 8,
  Rogue = 9,
}

export enum ItemType {
  Weapon = 0,
  Armor = 1,
  Spell = 2,
  Consumable = 3,
  QuestItem = 4,
  Accessory = 5,
}

export enum EncounterType {
  PvP = 0,
  PvE = 1,
  World = 2,
}

export enum OrderStatus {
  Canceled = 0,
  Active = 1,
  Fulfilled = 2,
}

export enum TokenType {
  NATIVE = 0,
  ERC20 = 1,
  ERC721 = 2,
  ERC1155 = 3,
}

// ---------------------------------------------------------------------------
// StatsData type (mirrors Solidity struct)
// ---------------------------------------------------------------------------

export type StatsData = {
  strength: bigint;
  agility: bigint;
  class: number;
  intelligence: bigint;
  maxHp: bigint;
  currentHp: bigint;
  experience: bigint;
  level: bigint;
  powerSource: number;
  race: number;
  startingArmor: number;
  advancedClass: number;
  hasSelectedAdvancedClass: boolean;
};

// ---------------------------------------------------------------------------
// Nonce-tracking transaction helper
// ---------------------------------------------------------------------------

type WalletState = {
  wallet: WalletClient;
  nonce: number;
  account: Account;
};

const walletStates = new Map<Address, WalletState>();

async function ensureWalletState(wallet: WalletClient): Promise<WalletState> {
  const account = wallet.account!;
  const addr = account.address;
  let state = walletStates.get(addr);
  if (!state) {
    const nonce = await publicClient.getTransactionCount({
      address: addr,
    });
    state = { wallet, nonce, account };
    walletStates.set(addr, state);
  }
  return state;
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

export async function sendTx(
  wallet: WalletClient,
  functionName: string,
  args: any[],
  value?: bigint,
): Promise<Hex> {
  const state = await ensureWalletState(wallet);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const hash = await wallet.writeContract({
        address: worldAddress,
        abi: worldAbi,
        functionName: functionName as any,
        args: args as any,
        nonce: state.nonce,
        ...(value !== undefined ? { value } : {}),
      });
      state.nonce++;
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "reverted") {
        throw new Error(`Transaction reverted: ${hash}`);
      }
      return hash;
    } catch (err: any) {
      const msg = err?.message ?? "";
      // Retry on nonce-related errors
      if (
        msg.includes("nonce") &&
        (msg.includes("too low") || msg.includes("already known")) &&
        attempt < MAX_RETRIES - 1
      ) {
        state.nonce = await publicClient.getTransactionCount({
          address: state.account.address,
        });
        await sleep(RETRY_DELAY);
        continue;
      }
      throw err;
    }
  }
  throw new Error("sendTx: max retries exceeded");
}

// ---------------------------------------------------------------------------
// Read helper
// ---------------------------------------------------------------------------

export async function readWorld(
  functionName: string,
  args: any[] = [],
): Promise<any> {
  return publicClient.readContract({
    address: worldAddress,
    abi: worldAbi,
    functionName: functionName as any,
    args: args as any,
  });
}

// ---------------------------------------------------------------------------
// Wallet generation
// ---------------------------------------------------------------------------

export interface TestWallet {
  wallet: WalletClient;
  account: Account;
  address: Address;
}

export async function createTestWallet(
  seed: string,
  fundAmount: bigint = BigInt("10000000000000000"), // 0.01 ETH default
): Promise<TestWallet> {
  const privKey = keccak256(
    encodePacked(["string"], [`smoke_test_${seed}`]),
  ) as Hex;
  const account = privateKeyToAccount(privKey);

  const wallet = createWalletClient({
    account,
    chain: base,
    transport: http(RPC_URL),
  });

  // Fund from deployer if balance is low
  const balance = await publicClient.getBalance({ address: account.address });
  if (balance < fundAmount / 4n) {
    const hash = await deployerWallet.sendTransaction({
      to: account.address,
      value: fundAmount,
    } as any);
    await publicClient.waitForTransactionReceipt({ hash });
  }

  return { wallet, account, address: account.address };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function nameToBytes32(name: string): Hex {
  return stringToHex(name, { size: 32 });
}

export function uniqueName(prefix: string = "smoke"): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

// ---------------------------------------------------------------------------
// Simulate + send — get return value AND execute
// ---------------------------------------------------------------------------

export async function simulateAndSend<T = any>(
  wallet: WalletClient,
  functionName: string,
  args: any[],
  value?: bigint,
): Promise<{ txHash: Hex; result: T }> {
  const { result } = await publicClient.simulateContract({
    address: worldAddress,
    abi: worldAbi,
    functionName: functionName as any,
    args: args as any,
    account: wallet.account!,
    ...(value !== undefined ? { value } : {}),
  });

  const txHash = await sendTx(wallet, functionName, args, value);
  return { txHash, result: result as T };
}

// ---------------------------------------------------------------------------
// Async queue — serializes calls through a single wallet (e.g. deployer)
// ---------------------------------------------------------------------------

export class AsyncQueue {
  private queue: Promise<any> = Promise.resolve();

  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const task = this.queue.then(fn, () => fn());
    this.queue = task.catch(() => {});
    return task;
  }
}

export const deployerQueue = new AsyncQueue();
