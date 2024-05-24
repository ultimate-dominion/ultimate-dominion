import { Button, Flex, HStack, Text } from '@chakra-ui/react';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export const ConnectWalletButton: React.FC = () => {
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
                    Connect
                  </Button>
                );
              }

              if (chain.unsupported) {
                return (
                  <Button onClick={openChainModal} type="button">
                    Wrong Network
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
