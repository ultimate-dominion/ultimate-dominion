import { type Address, type PublicClient } from 'viem';
export declare class NonceManager {
    private currentNonce;
    private lock;
    private unlock;
    initialize(publicClient: PublicClient, address: Address): Promise<void>;
    acquire(): Promise<number>;
    confirm(): void;
    reject(): void;
    private release;
    resync(publicClient: PublicClient, address: Address): Promise<void>;
    get pending(): number;
}
