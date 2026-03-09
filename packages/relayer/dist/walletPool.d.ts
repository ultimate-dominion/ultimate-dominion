import { type Address, type PublicClient, type WalletClient } from 'viem';
import { type PrivateKeyAccount } from 'viem/accounts';
import { NonceManager } from './nonce.js';
interface PooledWallet {
    account: PrivateKeyAccount;
    walletClient: WalletClient;
    nonceManager: NonceManager;
    address: Address;
    inflight: number;
}
export declare const chain: {
    blockExplorers?: {
        [key: string]: {
            name: string;
            url: string;
            apiUrl?: string | undefined;
        };
        default: {
            name: string;
            url: string;
            apiUrl?: string | undefined;
        };
    } | undefined;
    blockTime?: number | undefined;
    contracts?: {
        [x: string]: import("viem").ChainContract | {
            [sourceId: number]: import("viem").ChainContract | undefined;
        } | undefined;
        ensRegistry?: import("viem").ChainContract | undefined;
        ensUniversalResolver?: import("viem").ChainContract | undefined;
        multicall3?: import("viem").ChainContract | undefined;
        universalSignatureVerifier?: import("viem").ChainContract | undefined;
    } | undefined;
    ensTlds?: readonly string[] | undefined;
    id: number;
    name: "Base";
    nativeCurrency: {
        readonly name: "Ether";
        readonly symbol: "ETH";
        readonly decimals: 18;
    };
    experimental_preconfirmationTime?: number | undefined;
    rpcUrls: {
        readonly default: {
            readonly http: readonly [string];
        };
    };
    sourceId?: number | undefined;
    testnet?: boolean | undefined;
    custom?: Record<string, unknown> | undefined;
    fees?: import("viem").ChainFees<undefined> | undefined;
    formatters?: undefined;
    serializers?: import("viem").ChainSerializers<undefined, import("viem").TransactionSerializable> | undefined;
};
export declare const rpcTransport: () => import("viem").HttpTransport<undefined, false> | import("viem").FallbackTransport<import("viem").HttpTransport<undefined, false>[]>;
/** Primary EOA — used for gas charging, health reporting */
export declare const primaryAddress: Address;
/** All EOA addresses in the pool */
export declare const allAddresses: Address[];
/** Initialize all nonce managers from chain */
export declare function initializePool(publicClient: PublicClient): Promise<void>;
/** Acquire the least-busy wallet + nonce */
export declare function acquireWallet(): Promise<{
    wallet: PooledWallet;
    nonce: number;
}>;
/** Release wallet back to pool after tx completes */
export declare function releaseWallet(wallet: PooledWallet, success: boolean): void;
/** Resync a wallet's nonce from chain (after failure) */
export declare function resyncWallet(wallet: PooledWallet, publicClient: PublicClient): Promise<void>;
/** Pool status for health endpoint */
export declare function getPoolStatus(publicClient: PublicClient): Promise<{
    poolSize: number;
    totalInflight: number;
    wallets: Array<{
        address: Address;
        nonce: number;
        inflight: number;
        balance: string;
    }>;
}>;
export {};
