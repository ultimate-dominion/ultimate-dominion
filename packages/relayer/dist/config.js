import 'dotenv/config';
function required(name) {
    const val = process.env[name];
    if (!val)
        throw new Error(`Missing required env var: ${name}`);
    return val;
}
export const config = {
    relayerPrivateKey: required('RELAYER_PRIVATE_KEY'),
    rpcUrl: required('RPC_URL'),
    delegationContract: required('DELEGATION_CONTRACT'),
    port: parseInt(process.env.PORT || '3001', 10),
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
    chainId: parseInt(process.env.CHAIN_ID || '8453', 10),
};
//# sourceMappingURL=config.js.map