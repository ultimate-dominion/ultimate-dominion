import { render, screen, act, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { MarketplaceRow } from './MarketplaceRow';
import { ItemType, OrderType, Rarity, TokenType } from '../utils/types';

// --- Mock state ---

const mockFulfillOrder = vi.fn().mockResolvedValue({ success: true, error: null });
const mockRefreshCharacter = vi.fn();
const mockRefreshOrders = vi.fn();
const mockNavigate = vi.fn();
const mockEnsureGoldAllowance = vi.fn().mockResolvedValue(true);
const mockExecute = vi.fn();

let characterState: Record<string, unknown> = {};
let authState: Record<string, unknown> = {};
let allowanceState: Record<string, unknown> = {};

vi.mock('../contexts/MUDContext', () => ({
  useMUD: () => ({
    systemCalls: { fulfillOrder: mockFulfillOrder },
  }),
}));

vi.mock('../contexts/CharacterContext', () => ({
  useCharacter: () => characterState,
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('../contexts/AllowanceContext', () => ({
  useAllowance: () => allowanceState,
}));

vi.mock('../contexts/OrdersContext', () => ({
  useOrders: () => ({ refreshOrders: mockRefreshOrders }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../hooks/useTransaction', () => ({
  useTransaction: () => ({
    execute: mockExecute,
    isLoading: false,
    statusMessage: '',
    status: 'idle',
    progress: { value: 0, status: 'idle' },
  }),
}));

vi.mock('../utils/itemImages', () => ({
  getItemImage: () => null,
}));

vi.mock('../utils/helpers', () => ({
  etherToFixedNumber: (val: bigint) => (Number(val) / 1e18).toFixed(2),
  getEmoji: () => '',
  removeEmoji: (s: string) => s,
}));

vi.mock('./SVGs/ForwardCaretSvg', () => ({
  ForwardCaretSvg: () => <span data-testid="caret">{'>'}</span>,
}));

vi.mock('@chakra-ui/react', async () => {
  const actual = await vi.importActual<typeof import('@chakra-ui/react')>('@chakra-ui/react');
  return {
    ...actual,
    useBreakpointValue: (values: Record<string, unknown>) => values.base ?? values.lg,
  };
});

const baseItem = {
  tokenId: '0x1',
  name: 'Iron Sword',
  description: 'A sturdy blade',
  image: '',
  minLevel: 1n,
  rarity: Rarity.Common,
  itemType: ItemType.Weapon as const,
  hpModifier: 0n,
  strModifier: 5n,
  agiModifier: 0n,
  intModifier: 0n,
  armorModifier: 0n,
  minDamage: 3n,
  maxDamage: 7n,
  mobId: '',
  statRestrictions: { minStrength: 0n, minAgility: 0n, minIntelligence: 0n },
};

const cheapestOrder = {
  orderHash: '0xorder1',
  orderStatus: 'active',
  offerer: '0xseller',
  offer: {
    amount: 1n,
    identifier: '0x1',
    token: '0xitems',
    tokenType: TokenType.ERC1155,
  },
  consideration: {
    amount: 100000000000000000000n, // 100 $GOLD
    identifier: '0',
    token: '0xgold',
    tokenType: TokenType.ERC20,
    recipient: '0xseller',
  },
};

const highestOfferOrder = {
  orderHash: '0xoffer1',
  orderStatus: 'active',
  offerer: '0xbuyer',
  offer: {
    amount: 50000000000000000000n, // 50 $GOLD
    identifier: '0',
    token: '0xgold',
    tokenType: TokenType.ERC20,
  },
  consideration: {
    amount: 1n,
    identifier: '0x1',
    token: '0xitems',
    tokenType: TokenType.ERC1155,
    recipient: '0xbuyer',
  },
};

function setDefaults() {
  characterState = {
    character: {
      owner: '0xplayer',
      externalGoldBalance: 500000000000000000000n, // 500 $GOLD
    },
    refreshCharacter: mockRefreshCharacter,
  };

  authState = { authMethod: 'embedded' };

  allowanceState = {
    ensureGoldAllowance: mockEnsureGoldAllowance,
    goldMarketplaceAllowance: 999999999999999999999999n, // plenty
  };

  mockExecute.mockImplementation(async (fn: () => Promise<unknown>) => {
    return await fn();
  });
}

describe('MarketplaceRow — Inline Buy', () => {
  beforeEach(() => {
    setDefaults();
    mockFulfillOrder.mockClear();
    mockRefreshCharacter.mockClear();
    mockRefreshOrders.mockClear();
    mockNavigate.mockClear();
    mockExecute.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows Buy button when there is a for-sale listing', () => {
    render(
      <MarketplaceRow
        {...baseItem}
        cheapestOrder={cheapestOrder}
        highestOffer="0"
        lowestPrice="100"
        orderType={OrderType.Buying}
      />,
    );

    expect(screen.getByText('Buy')).toBeTruthy();
  });

  it('does not show Buy button when no for-sale listing exists', () => {
    render(
      <MarketplaceRow
        {...baseItem}
        highestOffer="0"
        lowestPrice="0"
        orderType={OrderType.Buying}
      />,
    );

    expect(screen.queryByText('Buy')).toBeNull();
  });

  it('calls fulfillOrder when Buy is clicked', async () => {
    render(
      <MarketplaceRow
        {...baseItem}
        cheapestOrder={cheapestOrder}
        highestOffer="0"
        lowestPrice="100"
        orderType={OrderType.Buying}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Buy'));
    });

    expect(mockFulfillOrder).toHaveBeenCalledWith('0xorder1');
    expect(mockRefreshCharacter).toHaveBeenCalled();
    expect(mockRefreshOrders).toHaveBeenCalled();
  });

  it('does not navigate when Buy is clicked (stopPropagation)', async () => {
    render(
      <MarketplaceRow
        {...baseItem}
        cheapestOrder={cheapestOrder}
        highestOffer="0"
        lowestPrice="100"
        orderType={OrderType.Buying}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Buy'));
    });

    // Should NOT navigate to detail page
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not show Buy for own listing', () => {
    const ownOrder = { ...cheapestOrder, offerer: '0xplayer' };
    render(
      <MarketplaceRow
        {...baseItem}
        cheapestOrder={ownOrder}
        highestOffer="0"
        lowestPrice="100"
        orderType={OrderType.Buying}
      />,
    );

    // Should show caret instead of Buy (own listing)
    expect(screen.queryByText('Buy')).toBeNull();
  });

  it('shows Accept button on $GOLD Offers tab', () => {
    render(
      <MarketplaceRow
        {...baseItem}
        highestOffer="50"
        highestOfferOrder={highestOfferOrder}
        lowestPrice="0"
        orderType={OrderType.Selling}
      />,
    );

    expect(screen.getByText('Accept')).toBeTruthy();
  });

  it('calls fulfillOrder when Accept is clicked', async () => {
    render(
      <MarketplaceRow
        {...baseItem}
        highestOffer="50"
        highestOfferOrder={highestOfferOrder}
        lowestPrice="0"
        orderType={OrderType.Selling}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Accept'));
    });

    expect(mockFulfillOrder).toHaveBeenCalledWith('0xoffer1');
  });

  it('navigates to detail page when row body is clicked', () => {
    render(
      <MarketplaceRow
        {...baseItem}
        cheapestOrder={cheapestOrder}
        highestOffer="0"
        lowestPrice="100"
        orderType={OrderType.Buying}
      />,
    );

    // Click the item name (not the Buy button)
    fireEvent.click(screen.getByText('Iron Sword'));

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('/marketplace/items/0x1'),
    );
  });
});
