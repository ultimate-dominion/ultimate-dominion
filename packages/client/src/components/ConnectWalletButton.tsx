import { Button, Flex, HStack, Text } from '@chakra-ui/react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useTranslation } from 'react-i18next';

export const ConnectWalletButton: React.FC = () => {
  const { t } = useTranslation('ui');
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const connected = mounted && account && chain;

        return (
          <Flex
            {...(!mounted && {
              'aria-hidden': true,
              style: {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <Button onClick={openConnectModal} type="button">
                    {t('connectWalletBtn.signInWithWallet')}
                  </Button>
                );
              }

              if (chain.unsupported) {
                return (
                  <Button onClick={openChainModal} type="button">
                    {t('connectWalletBtn.wrongNetwork')}
                  </Button>
                );
              }
              return (
                <Button onClick={openAccountModal} type="button">
                  <HStack>
                    <Text>{account.displayName}</Text>
                  </HStack>
                </Button>
              );
            })()}
          </Flex>
        );
      }}
    </ConnectButton.Custom>
  );
};
