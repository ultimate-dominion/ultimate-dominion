import { type Hex, type Address, type PublicClient } from 'viem';
export declare const relayerAddress: Address;
export declare const publicClient: PublicClient;
export declare function sendRelayerTx(params: {
    to: Address;
    value?: bigint;
    calldata?: Hex;
    gasOverride?: bigint;
}): Promise<Hex>;
/**
 * Send a transaction from the primary wallet only.
 * Used for gas charging — the on-chain config only authorizes the primary address.
 */
export declare function sendPrimaryTx(params: {
    to: Address;
    value?: bigint;
    calldata?: Hex;
}): Promise<Hex>;
export declare function getRelayerBalance(): Promise<string>;
