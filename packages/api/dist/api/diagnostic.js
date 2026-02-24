import { createPublicClient, http } from 'viem';
import { getNetworkConfig } from "../lib/getNetworkConfig.js";
export default async function handler(req, res) {
    const diagnosticResults = {
        step: 'Starting diagnostics',
        environment: process.env.NODE_ENV,
        envVarsExist: {
            PINATA_JWT: !!process.env.PINATA_JWT,
            PRIVATE_KEY: !!process.env.PRIVATE_KEY,
            WORLD_ADDRESS: !!process.env.WORLD_ADDRESS,
            INITIAL_BLOCK_NUMBER: !!process.env.INITIAL_BLOCK_NUMBER
        },
        networkConfig: null,
        blockchainConnection: null,
        worldContract: null,
        error: null
    };
    try {
        // Step 1: Try to load network config
        diagnosticResults.step = 'Loading network config';
        const networkConfig = await getNetworkConfig();
        diagnosticResults.networkConfig = {
            chainId: networkConfig.chainId,
            worldAddress: networkConfig.worldAddress ? '✓ Available' : '✗ Missing',
            initialBlockNumber: networkConfig.initialBlockNumber ? '✓ Available' : '✗ Missing',
            privateKey: networkConfig.privateKey ? '✓ Available' : '✗ Missing'
        };
        // Step 2: Try to connect to blockchain
        diagnosticResults.step = 'Testing blockchain connection';
        // Define the Pyrope chain manually since it may not be in the standard viem chains
        const pyropeChain = {
            id: 695569,
            name: 'Pyrope',
            network: 'pyrope',
            nativeCurrency: {
                name: 'Ether',
                symbol: 'ETH',
                decimals: 18
            },
            rpcUrls: {
                default: {
                    http: ['https://rpc.pyropechain.com']
                },
                public: {
                    http: ['https://rpc.pyropechain.com']
                }
            }
        };
        const publicClient = createPublicClient({
            chain: pyropeChain,
            transport: http('https://rpc.pyropechain.com')
        });
        const blockNumber = await publicClient.getBlockNumber();
        diagnosticResults.blockchainConnection = {
            connected: true,
            blockNumber: blockNumber.toString()
        };
        // Step 3: Check if we can access the world contract
        diagnosticResults.step = 'Testing world contract access';
        try {
            const code = await publicClient.getBytecode({
                address: networkConfig.worldAddress
            });
            diagnosticResults.worldContract = {
                exists: !!code,
                bytecodeSize: code ? code.length : 0
            };
        }
        catch (err) {
            const error = err;
            diagnosticResults.worldContract = {
                exists: false,
                error: error.message
            };
        }
        res.status(200).json(diagnosticResults);
    }
    catch (err) {
        const error = err;
        diagnosticResults.error = {
            step: diagnosticResults.step,
            message: error.message,
            stack: error.stack
        };
        res.status(500).json(diagnosticResults);
    }
}
