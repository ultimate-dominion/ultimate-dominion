import type { ServiceCheckResult } from './types.js';
/**
 * Check self-hosted Base node.
 * Compares block number against Alchemy to detect lag.
 * Optionally scrapes Prometheus metrics for deeper health data.
 */
export declare function checkBaseNode(rpcUrl: string, authToken: string, alchemyUrl: string, metricsUrl?: string): Promise<ServiceCheckResult>;
/**
 * Check relayer health endpoint.
 */
export declare function checkRelayer(url: string): Promise<ServiceCheckResult>;
/**
 * Check indexer health (self-check — direct data access, no HTTP).
 */
export declare function checkIndexerSelf(latestBlockNumber: number, chainHead: number, wsClients: number): ServiceCheckResult;
/**
 * Check a web client (Vercel-hosted frontend).
 */
export declare function checkClient(url: string, label: string): Promise<ServiceCheckResult>;
/**
 * Check API health endpoint.
 */
export declare function checkApi(url: string): Promise<ServiceCheckResult>;
