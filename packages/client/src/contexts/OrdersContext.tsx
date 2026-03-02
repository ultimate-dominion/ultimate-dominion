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
import { toBigInt, useGameConfig, useGameTable } from '../lib/gameStore';
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

export const OrdersProvider = ({
  children,
}: {
  children: ReactNode;
}): JSX.Element => {
  const { isSynced } = useMUD();
  const { renderError } = useToast();

  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const ordersTable = useGameTable('Orders');
  const offersTable = useGameTable('Offers');
  const considerationsTable = useGameTable('Considerations');
  const configRow = useGameConfig('UltimateDominionConfig');

  const goldToken = configRow?.goldToken as string | undefined ?? null;

  const fetchOrders = useCallback(() => {
    try {
      setIsLoading(true);

      const _activeOrders: Order[] = Object.entries(ordersTable)
        .filter(([, orderRow]) => {
          return Number(orderRow.orderStatus) === OrderStatus.Active;
        })
        .filter(([orderHash]) => {
          return orderHash in offersTable && orderHash in considerationsTable;
        })
        .map(([orderHash, orderRow]) => {
          const offerRow = offersTable[orderHash];
          const considerationRow = considerationsTable[orderHash];

          return {
            consideration: {
              amount: toBigInt(considerationRow.amount),
              identifier: String(considerationRow.identifier),
              token: String(considerationRow.token),
              tokenType: Number(considerationRow.tokenType),
              recipient: String(considerationRow.recipient),
            } as ConsiderationData,
            offer: {
              amount: toBigInt(offerRow.amount),
              identifier: String(offerRow.identifier),
              token: String(offerRow.token),
              tokenType: Number(offerRow.tokenType),
            } as OfferData,
            offerer: String(orderRow.offerer),
            orderHash,
            orderStatus: String(orderRow.orderStatus),
          } as Order;
        });

      setActiveOrders(_activeOrders);
    } catch (e) {
      renderError((e as Error)?.message ?? 'Failed to get order data.', e);
    } finally {
      setIsLoading(false);
    }
  }, [ordersTable, offersTable, considerationsTable, renderError]);

  useEffect(() => {
    if (!isSynced) return;
    fetchOrders();
  }, [fetchOrders, isSynced]);

  const lowestPrices = useMemo(() => {
    const result: { [key: string]: bigint } = {};

    activeOrders.forEach(order => {
      const price = result[order.offer.identifier.toString()];
      if (order.consideration.token !== goldToken) return;
      if (!price || order.consideration.amount < price) {
        result[order.offer.identifier.toString()] = order.consideration.amount;
      }
    });

    return result;
  }, [activeOrders, goldToken]);

  const highestOffers = useMemo(() => {
    const result: { [key: string]: bigint } = {};

    activeOrders.forEach(order => {
      const offer = result[order.consideration.identifier.toString()];
      if (order.offer.token !== goldToken) return;
      if (!offer || order.offer.amount > offer) {
        result[order.consideration.identifier.toString()] = order.offer.amount;
      }
    });

    return result;
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

export const useOrders = (): OrdersContextType => useContext(OrdersContext);
