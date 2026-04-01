import { Button, HStack, Text } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';

import { base } from '../lib/mud/supportedChains';

function formatAddress(address?: string): string {
  if (!address) return 'Connected';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export const ConnectWalletButton: React.FC = () => {
  const { t } = useTranslation('ui');
  const { address, chainId, isConnected, isConnecting } = useAccount();
  const { connect, connectors, isPending: isConnectingWallet } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();

  const injectedConnector = connectors[0];

  if (!isConnected) {
    return (
      <Button
        isDisabled={!injectedConnector}
        isLoading={isConnecting || isConnectingWallet}
        onClick={() => injectedConnector && connect({ connector: injectedConnector })}
        type="button"
      >
        {injectedConnector ? t('connectWalletBtn.signInWithWallet') : 'Wallet unavailable'}
      </Button>
    );
  }

  if (chainId !== base.id) {
    return (
      <Button
        isLoading={isSwitchingChain}
        onClick={() => switchChain({ chainId: base.id })}
        type="button"
      >
        {t('connectWalletBtn.wrongNetwork')}
      </Button>
    );
  }

  return (
    <Button onClick={() => disconnect()} type="button">
      <HStack>
        <Text>{formatAddress(address)}</Text>
      </HStack>
    </Button>
  );
};
