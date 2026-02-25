/**
 * Create a token-gated Push Protocol group for Ultimate Dominion chat
 *
 * This script creates a Push Protocol group that requires ownership of
 * the Adventurer badge (Token ID 1xxx...) to join.
 *
 * Usage:
 *   PRIVATE_KEY=0x... PUSH_ENV=prod CHAIN_ID=84532 npx ts-node scripts/create-chat-group.ts
 *
 * PUSH_ENV: 'prod' for production Push backend, 'staging' (default) for dev
 * After running, set VITE_PUSH_GROUP_CHAT_ID env var to the output chat ID
 */

import { CONSTANTS, PushAPI } from '@pushprotocol/restapi';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { anvil, baseSepolia } from 'viem/chains';

const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
const BADGE_CONTRACT = process.env.BADGE_CONTRACT;
const CHAIN_ID = process.env.CHAIN_ID || '31337';
const PUSH_ENV = process.env.PUSH_ENV === 'prod' ? CONSTANTS.ENV.PROD : CONSTANTS.ENV.STAGING;

if (!PRIVATE_KEY) {
  console.error('Please set PRIVATE_KEY environment variable');
  process.exit(1);
}

// Map chain IDs to viem chains
const chains: Record<string, typeof anvil> = {
  '31337': anvil,
  '84532': baseSepolia,
};

async function createTokenGatedGroup() {
  const account = privateKeyToAccount(PRIVATE_KEY);
  const chain = chains[CHAIN_ID] || anvil;

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(),
  });

  console.log('Initializing Push Protocol...');
  console.log('  Account:', account.address);
  console.log('  Chain ID:', CHAIN_ID);
  console.log('  Push Env:', PUSH_ENV === CONSTANTS.ENV.PROD ? 'PROD' : 'STAGING');
  console.log('  Badge Contract:', BADGE_CONTRACT || 'Not set (public group)');

  const user = await PushAPI.initialize(walletClient, {
    env: PUSH_ENV,
  });

  console.log('\nCreating chat group...');

  // Build group options
  const groupOptions: any = {
    description: 'Ultimate Dominion game chat - Adventurer badge required',
    image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    members: [],
    admins: [],
    private: false, // Public visibility, but gated entry
  };

  // Add token gating rules if badge contract is provided
  if (BADGE_CONTRACT) {
    groupOptions.rules = {
      entry: {
        conditions: {
          any: [
            {
              type: 'PUSH',
              category: 'ERC721',
              subcategory: 'holder',
              data: {
                contract: `eip155:${CHAIN_ID}:${BADGE_CONTRACT}`,
                comparison: '>=',
                amount: 1,
              },
            },
          ],
        },
      },
    };
    console.log('  Token gating enabled for badge holders');
  } else {
    console.log('  No token gating (public group)');
  }

  try {
    const groupResponse = await user.chat.group.create('Ultimate Dominion', groupOptions);

    console.log('\n✅ Group created successfully!\n');
    console.log('Group Chat ID:', groupResponse.chatId);
    console.log('\nUpdate GROUP_CHAT_ID in src/contexts/ChatContext.tsx:');
    console.log(`const GROUP_CHAT_ID = '${groupResponse.chatId}';`);

    if (BADGE_CONTRACT) {
      console.log(`\nAlso update BADGE_CONTRACT_ADDRESS:`);
      console.log(`const BADGE_CONTRACT_ADDRESS = '${BADGE_CONTRACT}';`);
    }
  } catch (error: any) {
    console.error('\n❌ Failed to create group:', error.message);
    if (error.message.includes('already exists')) {
      console.log('\nTip: A group with this name may already exist. Try a different name.');
    }
  }
}

createTokenGatedGroup().catch(console.error);
