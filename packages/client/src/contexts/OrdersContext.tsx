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
import { formatEther, parseEther } from 'viem';

import { useToast } from '../hooks/useToast';
import {
  type ConsiderationData,
  type OfferData,
  type Order,
  OrderStatus,
  TokenType,
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
  const { renderError } = useToast();
  const {
    components: { Considerations, Offers, Orders, UltimateDominionConfig },
    isSynced,
  } = useMUD();

  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const { goldToken } = useComponentValue(
    UltimateDominionConfig,
    singletonEntity,
  ) ?? { goldToken: null };

  const fetchOrders = useCallback(() => {
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
            amount:
              considerationData.tokenType === TokenType.ERC20
                ? formatEther(considerationData.amount)
                : considerationData.amount.toString(),
            identifier: considerationData.identifier.toString(),
            token: considerationData.token.toString(),
            tokenType: considerationData.tokenType,
            recipient: considerationData.recipient.toString(),
          } as ConsiderationData,
          offer: {
            amount:
              offerData.tokenType === TokenType.ERC20
                ? formatEther(offerData.amount)
                : offerData.amount.toString(),
            identifier: offerData.identifier.toString(),
            token: offerData.token.toString(),
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
      const price = lowestPrices[order.offer.identifier];
      if (order.consideration.token !== goldToken) return;
      if (!price || parseEther(order.consideration.amount) < BigInt(price)) {
        lowestPrices[order.offer.identifier] = parseEther(
          order.consideration.amount,
        );
      }
    });

    return lowestPrices;
  }, [activeOrders, goldToken]);

  const highestOffers = useMemo(() => {
    const highestOffers: { [key: string]: bigint } = {};

    activeOrders.forEach(order => {
      const offer = highestOffers[order.consideration.identifier];
      if (order.offer.token !== goldToken) return;
      if (!offer || parseEther(order.offer.amount) > BigInt(offer)) {
        highestOffers[order.consideration.identifier] = parseEther(
          order.offer.amount,
        );
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

export const useOrders = (): OrdersContextType => useContext(OrdersContext);
