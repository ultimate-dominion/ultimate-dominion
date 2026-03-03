/**
 * Relayer Gold → ETH Swap Script
 *
 * Reads the relayer wallet's gold balance from the gold ERC20 puppet.
 * If above a configurable threshold, swaps gold for ETH on the Uniswap V3 GOLD/WETH pool.
 *
 * Intended to run as a cron job (e.g., every hour) or when gold balance crosses a threshold.
 *
 * Usage:
 *   npx tsx scripts/swap-gold.ts
 *
 * Required env vars:
 *   RELAYER_PRIVATE_KEY - Relayer wallet private key
 *   RPC_URL - Base RPC endpoint
 *   GOLD_TOKEN_ADDRESS - Gold ERC20 puppet address
 *
 * Optional env vars:
 *   SWAP_THRESHOLD - Min gold balance to trigger swap (default: 1000e18 = 1000 gold)
 *   POOL_FEE - Uniswap V3 pool fee tier (default: 10000 = 1%)
 */

import 'dotenv/config';
import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  type Hex,
  formatEther,
} from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Base Mainnet addresses
const WETH = '0x4200000000000000000000000000000000000006' as const;
const SWAP_ROUTER = '0x2626664c2603336E57B271c5C0b26F421741e481' as const;

// ABIs (minimal)
const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

const swapRouterAbi = parseAbi([
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)',
]);

const wethAbi = parseAbi([
  'function withdraw(uint256 amount)',
]);

async function main() {
  const privateKey = process.env.RELAYER_PRIVATE_KEY as Hex;
  const rpcUrl = process.env.RPC_URL;
  const goldTokenAddress = process.env.GOLD_TOKEN_ADDRESS as Hex;

  if (!privateKey || !rpcUrl || !goldTokenAddress) {
    console.error('Missing required env vars: RELAYER_PRIVATE_KEY, RPC_URL, GOLD_TOKEN_ADDRESS');
    process.exit(1);
  }

  const swapThreshold = BigInt(process.env.SWAP_THRESHOLD || String(1000n * 10n ** 18n));
  const poolFee = parseInt(process.env.POOL_FEE || '10000', 10);

  const account = privateKeyToAccount(privateKey);
  console.log(`Relayer address: ${account.address}`);

  const publicClient = createPublicClient({
    chain: base,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(rpcUrl),
  });

  // Check gold balance
  const goldBalance = await publicClient.readContract({
    address: goldTokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account.address],
  });

  console.log(`Gold balance: ${formatEther(goldBalance)} GOLD`);
  console.log(`Swap threshold: ${formatEther(swapThreshold)} GOLD`);

  if (goldBalance < swapThreshold) {
    console.log('Below threshold — skipping swap.');
    return;
  }

  // Check ETH balance before
  const ethBefore = await publicClient.getBalance({ address: account.address });
  console.log(`ETH balance before: ${formatEther(ethBefore)} ETH`);

  // Approve SwapRouter to spend gold
  console.log(`Approving ${formatEther(goldBalance)} GOLD for SwapRouter...`);
  const approveHash = await walletClient.writeContract({
    address: goldTokenAddress,
    abi: erc20Abi,
    functionName: 'approve',
    args: [SWAP_ROUTER, goldBalance],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });
  console.log(`Approve tx: ${approveHash}`);

  // Swap gold → WETH
  console.log(`Swapping ${formatEther(goldBalance)} GOLD → WETH...`);
  const swapHash = await walletClient.writeContract({
    address: SWAP_ROUTER,
    abi: swapRouterAbi,
    functionName: 'exactInputSingle',
    args: [
      {
        tokenIn: goldTokenAddress,
        tokenOut: WETH,
        fee: poolFee,
        recipient: account.address,
        amountIn: goldBalance,
        amountOutMinimum: 1n, // Accept any amount — relayer swaps are small
        sqrtPriceLimitX96: 0n,
      },
    ],
  });
  const swapReceipt = await publicClient.waitForTransactionReceipt({ hash: swapHash });
  console.log(`Swap tx: ${swapHash} (status: ${swapReceipt.status})`);

  // Check WETH balance and unwrap
  const wethBalance = await publicClient.readContract({
    address: WETH,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account.address],
  });

  if (wethBalance > 0n) {
    console.log(`Unwrapping ${formatEther(wethBalance)} WETH → ETH...`);
    const unwrapHash = await walletClient.writeContract({
      address: WETH,
      abi: wethAbi,
      functionName: 'withdraw',
      args: [wethBalance],
    });
    await publicClient.waitForTransactionReceipt({ hash: unwrapHash });
    console.log(`Unwrap tx: ${unwrapHash}`);
  }

  // Final ETH balance
  const ethAfter = await publicClient.getBalance({ address: account.address });
  console.log(`ETH balance after: ${formatEther(ethAfter)} ETH`);
  console.log(`ETH gained: ${formatEther(ethAfter - ethBefore)} ETH`);
  console.log('Done.');
}

main().catch((e) => {
  console.error('Swap failed:', e);
  process.exit(1);
});
