export class NonceManager {
    currentNonce = -1;
    lock = Promise.resolve();
    unlock = null;
    async initialize(publicClient, address) {
        this.currentNonce = await publicClient.getTransactionCount({
            address,
            blockTag: 'pending',
        });
        console.log(`[nonce] Initialized at ${this.currentNonce}`);
    }
    async acquire() {
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
    release() {
        if (this.unlock) {
            this.unlock();
            this.unlock = null;
        }
    }
    async resync(publicClient, address) {
        this.currentNonce = await publicClient.getTransactionCount({
            address,
            blockTag: 'pending',
        });
        console.log(`[nonce] Resynced to ${this.currentNonce}`);
    }
    get pending() {
        return this.currentNonce;
    }
}
//# sourceMappingURL=nonce.js.map