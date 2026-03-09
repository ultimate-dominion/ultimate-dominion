import { type Address } from 'viem';
/**
 * Record a gas funding event for a player. Called after successful fund/top-up.
 * Synchronous — zero latency impact on funding path.
 */
export declare function recordFunding(eoaAddress: Address, ethAmount: bigint): void;
/**
 * Flush pending charges — batch-charge Gold from players.
 * Runs on interval (default 5 min).
 */
export declare function flushCharges(): Promise<void>;
/**
 * Swap accumulated Gold for ETH via Uniswap V3.
 * Runs on interval (default 1 hour).
 */
export declare function swapGoldForEth(): Promise<void>;
export declare function startSchedulers(): void;
export declare function stopSchedulers(): void;
export declare function getPendingChargeCount(): number;
export declare function getTotalPendingEth(): string;
