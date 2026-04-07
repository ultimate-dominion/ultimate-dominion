import { config } from './config.js';

export function needsPlayerTopUp(balance: bigint): boolean {
  return balance < config.minPlayerBalance;
}

export function getPlayerTopUpAmount(balance: bigint): bigint {
  if (balance >= config.targetPlayerBalance) return 0n;
  return config.targetPlayerBalance - balance;
}
