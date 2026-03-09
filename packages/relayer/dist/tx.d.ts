import { type Hex, type Address, type PublicClient } from 'viem';
export declare const relayerAddress: Address;
export declare const publicClient: PublicClient;
export declare function sendRelayerTx(params: {
    to: Address;
    value?: bigint;
    calldata?: Hex;
    gasOverride?: bigint;
}): Promise<Hex>;
export declare function getRelayerBalance(): Promise<string>;
