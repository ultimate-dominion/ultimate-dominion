import { VercelRequest, VercelResponse } from '@vercel/node';
import { Hex, createPublicClient, http } from 'viem';
import { getNetworkConfig } from "../lib/getNetworkConfig.js";

type DiagnosticResults = {
  step: string;
  environment: string | undefined;
  envVarsExist: {
    PINATA_JWT: boolean;
    PRIVATE_KEY: boolean;
    WORLD_ADDRESS: boolean;
    INITIAL_BLOCK_NUMBER: boolean;
  };
  networkConfig: {
    chainId: number;
    worldAddress: string;
    initialBlockNumber: string;
    privateKey: string;
  } | null;
  blockchainConnection: {
    connected: boolean;
    blockNumber: string;
  } | null;
  worldContract: {
    exists: boolean;
    bytecodeSize?: number;
    error?: string;
  } | null;
  error: {
    step: string;
    message: string;
    stack?: string;
  } | null;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const diagnosticResults: DiagnosticResults = {
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
        address: networkConfig.worldAddress as Hex
      });
      diagnosticResults.worldContract = {
        exists: !!code,
        bytecodeSize: code ? code.length : 0
      };
    } catch (err) {
      const error = err as Error;
      diagnosticResults.worldContract = {
        exists: false,
        error: error.message
      };
    }

    res.status(200).json(diagnosticResults);
  } catch (err) {
    const error = err as Error;
    diagnosticResults.error = {
      step: diagnosticResults.step,
      message: error.message,
      stack: error.stack
    };
    res.status(500).json(diagnosticResults);
  }
}
