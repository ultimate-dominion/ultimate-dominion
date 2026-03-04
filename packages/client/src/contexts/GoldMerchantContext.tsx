import { createContext, ReactNode, useContext, useMemo } from 'react';
import { useDisclosure } from '@chakra-ui/react';

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
