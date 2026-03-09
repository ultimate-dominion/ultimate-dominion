import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useDisclosure } from '@chakra-ui/react';
import { useToast } from '../hooks/useToast';

type GoldMerchantContextType = {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
};

const GoldMerchantContext = createContext<GoldMerchantContextType | null>(null);

export const GoldMerchantProvider = ({
  children,
}: {
  children: ReactNode;
}): JSX.Element => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { renderSuccess } = useToast();
  const [hasChecked, setHasChecked] = useState(false);

  // Detect ?gold_purchase=success on return from Stripe
  useEffect(() => {
    if (hasChecked) return;
    setHasChecked(true);

    const params = new URLSearchParams(window.location.search);
    const goldPurchase = params.get('gold_purchase');

    if (goldPurchase === 'success') {
      renderSuccess('Gold purchased! It will arrive in your wallet shortly.');
      // Clean up URL
      params.delete('gold_purchase');
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    } else if (goldPurchase === 'cancelled') {
      params.delete('gold_purchase');
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [hasChecked, renderSuccess]);

  const value = useMemo(
    () => ({ isOpen, onOpen, onClose }),
    [isOpen, onOpen, onClose],
  );

  return (
    <GoldMerchantContext.Provider value={value}>
      {children}
    </GoldMerchantContext.Provider>
  );
};

export const useGoldMerchant = (): GoldMerchantContextType => {
  const ctx = useContext(GoldMerchantContext);
  if (!ctx) {
    throw new Error('useGoldMerchant must be used within a GoldMerchantProvider');
  }
  return ctx;
};
