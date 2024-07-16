import { resourceToHex } from '@latticexyz/common';

const CHARACTERS_NAMESPACE = 'Characters';
const GOLD_NAMESPACE = 'Gold';
const ITEMS_NAMESPACE = 'Items';

const CharactersBalancesTableId = resourceToHex({
  type: 'table',
  namespace: CHARACTERS_NAMESPACE,
  name: 'Balances',
});

const CharactersTokenURITableId = resourceToHex({
  type: 'table',
  namespace: CHARACTERS_NAMESPACE,
  name: 'TokenURI',
});

const GoldBalancesTableId = resourceToHex({
  type: 'table',
  namespace: GOLD_NAMESPACE,
  name: 'Balances',
});

const ItemsBaseURITableId = resourceToHex({
  type: 'table',
  namespace: ITEMS_NAMESPACE,
  name: 'MetadataURI',
});

const ItemsOwnersTableId = resourceToHex({
  type: 'table',
  namespace: ITEMS_NAMESPACE,
  name: 'Owners',
});

const ItemsTokenURITableId = resourceToHex({
  type: 'table',
  namespace: ITEMS_NAMESPACE,
  name: 'URIStorage',
});

export const externalTables = {
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
  CharactersTokenURI: {
    namespace: CHARACTERS_NAMESPACE,
    name: 'TokenURI',
    tableId: CharactersTokenURITableId,
    keySchema: {
      tokenId: { type: 'uint256' },
    },
    valueSchema: {
      tokenURI: { type: 'string' },
    },
  },
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
  ItemsBaseURI: {
    namespace: ITEMS_NAMESPACE,
    name: 'MetadataURI',
    tableId: ItemsBaseURITableId,
    keySchema: {},
    valueSchema: {
      uri: { type: 'string' },
    },
  },
  ItemsOwners: {
    namespace: ITEMS_NAMESPACE,
    name: 'Owners',
    tableId: ItemsOwnersTableId,
    keySchema: {
      owner: { type: 'address' },
      tokenId: { type: 'uint256' },
    },
    valueSchema: {
      balance: { type: 'uint256' },
    },
  },
  ItemsTokenURI: {
    namespace: ITEMS_NAMESPACE,
    name: 'URIStorage',
    tableId: ItemsTokenURITableId,
    keySchema: {
      tokenId: { type: 'uint256' },
    },
    valueSchema: {
      uri: { type: 'string' },
    },
  },
} as const;
