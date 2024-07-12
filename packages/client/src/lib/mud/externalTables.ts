import { resourceToHex } from '@latticexyz/common';

const GOLD_NAMESPACE = 'Gold';
const CHARACTERS_NAMESPACE = 'Characters';
const ITEMS_NAMESPACE = 'Items';

const GoldBalancesTableId = resourceToHex({
  type: 'table',
  namespace: GOLD_NAMESPACE,
  name: 'Balances',
});
const CharactersBalancesTableId = resourceToHex({
  type: 'table',
  namespace: CHARACTERS_NAMESPACE,
  name: 'Balances',
});
const ItemsBalancesTableId = resourceToHex({
  type: 'table',
  namespace: ITEMS_NAMESPACE,
  name: 'Owners',
});

export const externalTables = {
  GoldBalances: {
    namespace: GOLD_NAMESPACE,
    name: 'Balances',
    tableId: GoldBalancesTableId,
    keySchema: {
      account: { type: 'address' },
    },
    valueSchema: {
      value: { type: 'uint256' },
    },
  },
  CharactersBalances: {
    namespace: CHARACTERS_NAMESPACE,
    name: 'Balances',
    tableId: CharactersBalancesTableId,
    keySchema: {
      account: { type: 'address' },
    },
    valueSchema: {
      value: { type: 'uint256' },
    },
  },
  ItemsOwners: {
    namespace: ITEMS_NAMESPACE,
    name: 'Owners',
    tableId: ItemsBalancesTableId,
    keySchema: {
      account: { type: 'address' },
      tokenId: { type: 'uint256' },
    },
    valueSchema: {
      balance: { type: 'uint256' },
    },
  },
} as const;
