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

// v2.2.23 table format: tables need `label`, `type`, `key` (array), and
// `schema` (merged key+value fields with { type, internalType } shape).
export const externalTables = {
  CharactersBalances: {
    label: 'CharactersBalances',
    type: 'table' as const,
    namespace: CHARACTERS_NAMESPACE,
    name: 'Balances',
    tableId: CharactersBalancesTableId,
    key: ['account'] as const,
    schema: {
      account: { type: 'address' as const, internalType: 'address' as const },
      value: { type: 'uint256' as const, internalType: 'uint256' as const },
    },
  },
  CharactersTokenURI: {
    label: 'CharactersTokenURI',
    type: 'table' as const,
    namespace: CHARACTERS_NAMESPACE,
    name: 'TokenURI',
    tableId: CharactersTokenURITableId,
    key: ['tokenId'] as const,
    schema: {
      tokenId: { type: 'uint256' as const, internalType: 'uint256' as const },
      tokenURI: { type: 'string' as const, internalType: 'string' as const },
    },
  },
  GoldBalances: {
    label: 'GoldBalances',
    type: 'table' as const,
    namespace: GOLD_NAMESPACE,
    name: 'Balances',
    tableId: GoldBalancesTableId,
    key: ['account'] as const,
    schema: {
      account: { type: 'address' as const, internalType: 'address' as const },
      value: { type: 'uint256' as const, internalType: 'uint256' as const },
    },
  },
  ItemsBaseURI: {
    label: 'ItemsBaseURI',
    type: 'table' as const,
    namespace: ITEMS_NAMESPACE,
    name: 'MetadataURI',
    tableId: ItemsBaseURITableId,
    key: [] as const,
    schema: {
      uri: { type: 'string' as const, internalType: 'string' as const },
    },
  },
  ItemsOwners: {
    label: 'ItemsOwners',
    type: 'table' as const,
    namespace: ITEMS_NAMESPACE,
    name: 'Owners',
    tableId: ItemsOwnersTableId,
    key: ['owner', 'tokenId'] as const,
    schema: {
      owner: { type: 'address' as const, internalType: 'address' as const },
      tokenId: { type: 'uint256' as const, internalType: 'uint256' as const },
      balance: { type: 'uint256' as const, internalType: 'uint256' as const },
    },
  },
  ItemsTokenURI: {
    label: 'ItemsTokenURI',
    type: 'table' as const,
    namespace: ITEMS_NAMESPACE,
    name: 'URIStorage',
    tableId: ItemsTokenURITableId,
    key: ['tokenId'] as const,
    schema: {
      tokenId: { type: 'uint256' as const, internalType: 'uint256' as const },
      uri: { type: 'string' as const, internalType: 'string' as const },
    },
  },
};
