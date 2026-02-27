import { useComponentValue } from '@latticexyz/react';
import {
  getComponentValueStrict,
  Has,
  HasValue,
  runQuery,
} from '@latticexyz/recs';
import { singletonEntity } from '@latticexyz/store-sync/recs';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useToast } from '../hooks/useToast';
import {
  type ConsiderationData,
  type OfferData,
  type Order,
  OrderStatus,
} from '../utils/types';

import { useMUD } from './MUDContext';

type OrdersContextType = {
  activeOrders: Order[];
  highestOffers: { [key: string]: bigint };
  isLoading: boolean;
  lowestPrices: { [key: string]: bigint };
  refreshOrders: () => void;
};

const OrdersContext = createContext<OrdersContextType>({
  activeOrders: [],
  highestOffers: {},
  isLoading: false,
  lowestPrices: {},
  refreshOrders: () => {},
});

// Inner component that uses the hooks - only rendered when components are ready
const OrdersProviderInner = ({
  children,
  components,
  isSynced,
}: {
  children: ReactNode;
  components: any;
  isSynced: boolean;
}): JSX.Element => {
  const { renderError } = useToast();

  const { Considerations, Offers, Orders, UltimateDominionConfig } = components;

  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const configValue = useComponentValue(
    UltimateDominionConfig,
    singletonEntity,
  );
  const goldToken = configValue?.goldToken ?? null;

  const fetchOrders = useCallback(() => {
    if (!Considerations || !Offers || !Orders) return;

    try {
      setIsLoading(true);

      const _activeOrders = Array.from(
        runQuery([
          Has(Considerations),
          Has(Offers),
          Has(Orders),
          HasValue(Orders, { orderStatus: OrderStatus.Active }),
        ]),
      ).map(orderHash => {
        const considerationData = getComponentValueStrict(
          Considerations,
          orderHash,
        );
        const orderData = getComponentValueStrict(Orders, orderHash);
        const offerData = getComponentValueStrict(Offers, orderHash);
        const orderStatus = getComponentValueStrict(
          Orders,
          orderHash,
        ).orderStatus;

        return {
          consideration: {
            amount: considerationData.amount,
            identifier: considerationData.identifier.toString(),
            token: considerationData.token,
            tokenType: considerationData.tokenType,
            recipient: considerationData.recipient,
          } as ConsiderationData,
          offer: {
            amount: offerData.amount,
            identifier: offerData.identifier.toString(),
            token: offerData.token,
            tokenType: offerData.tokenType,
          } as OfferData,
          offerer: orderData.offerer.toString(),
          orderHash: orderHash.toString(),
          orderStatus: orderStatus.toString(),
        } as Order;
      });

      setActiveOrders(_activeOrders);
    } catch (e) {
      renderError((e as Error)?.message ?? 'Failed to get order data.', e);
    } finally {
      setIsLoading(false);
    }
  }, [Considerations, Offers, Orders, renderError]);

  useEffect(() => {
    if (!isSynced) return;
    fetchOrders();
  }, [fetchOrders, isSynced]);

  const lowestPrices = useMemo(() => {
    const lowestPrices: { [key: string]: bigint } = {};

    activeOrders.forEach(order => {
      const price = lowestPrices[order.offer.identifier.toString()];
      if (order.consideration.token !== goldToken) return;
      if (!price || order.consideration.amount < BigInt(price)) {
        lowestPrices[order.offer.identifier.toString()] =
          order.consideration.amount;
      }
    });

    return lowestPrices;
  }, [activeOrders, goldToken]);

  const highestOffers = useMemo(() => {
    const highestOffers: { [key: string]: bigint } = {};

    activeOrders.forEach(order => {
      const offer = highestOffers[order.consideration.identifier.toString()];
      if (order.offer.token !== goldToken) return;
      if (!offer || order.offer.amount > BigInt(offer)) {
        highestOffers[order.consideration.identifier.toString()] =
          order.offer.amount;
      }
    });

    return highestOffers;
  }, [activeOrders, goldToken]);

  return (
    <OrdersContext.Provider
      value={{
        activeOrders,
        highestOffers,
        isLoading,
        lowestPrices,
        refreshOrders: fetchOrders,
      }}
    >
      {children}
    </OrdersContext.Provider>
  );
};

export const OrdersProvider = ({
  children,
}: {
  children: ReactNode;
}): JSX.Element => {
  const { components, isSynced } = useMUD();

  // Check if required components are available
  const componentsReady = !!(
    components?.Considerations &&
    components?.Offers &&
    components?.Orders &&
    components?.UltimateDominionConfig
  );

  // If components aren't ready, render with default context
  if (!componentsReady) {
    return (
      <OrdersContext.Provider
        value={{
          activeOrders: [],
          highestOffers: {},
          isLoading: true,
          lowestPrices: {},
          refreshOrders: () => {},
        }}
      >
        {children}
      </OrdersContext.Provider>
    );
  }

  return (
    <OrdersProviderInner components={components} isSynced={isSynced}>
      {children}
    </OrdersProviderInner>
  );
};

export const useOrders = (): OrdersContextType => useContext(OrdersContext);
