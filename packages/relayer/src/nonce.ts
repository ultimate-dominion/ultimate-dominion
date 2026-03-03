import { type Address, type PublicClient } from 'viem';

export class NonceManager {
  private currentNonce = -1;
  private lock: Promise<void> = Promise.resolve();
  private unlock: (() => void) | null = null;

  async initialize(publicClient: PublicClient, address: Address) {
    this.currentNonce = await publicClient.getTransactionCount({
      address,
      blockTag: 'pending',
    });
    console.log(`[nonce] Initialized at ${this.currentNonce}`);
  }

  async acquire(): Promise<number> {
    await this.lock;
    this.lock = new Promise((r) => {
      this.unlock = r;
    });
    return this.currentNonce;
  }

  confirm() {
    this.currentNonce++;
    this.release();
  }

  reject() {
    this.release();
  }

  private release() {
    if (this.unlock) {
      this.unlock();
      this.unlock = null;
    }
  }

  async resync(publicClient: PublicClient, address: Address) {
    this.currentNonce = await publicClient.getTransactionCount({
      address,
      blockTag: 'pending',
    });
    console.log(`[nonce] Resynced to ${this.currentNonce}`);
  }

  get pending(): number {
    return this.currentNonce;
  }
}
