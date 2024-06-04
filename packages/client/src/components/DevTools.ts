import mudConfig from 'contracts/mud.config';
import { useEffect } from 'react';

import { useMUD } from '../contexts/MUDContext';

// Displays dev-tools connected to the burner wallet
export function DevTools(): null {
  const { network } = useMUD();

  useEffect(() => {
    let unmount: (() => void) | undefined;

    import('@latticexyz/dev-tools')
      .then(({ mount }) =>
        mount({
          config: mudConfig,
          publicClient: network.publicClient,
          walletClient: network.walletClient,
          latestBlock$: network.latestBlock$,
          storedBlockLogs$: network.storedBlockLogs$,
          worldAddress: network.worldContract.address,
          worldAbi: network.worldContract.abi,
          write$: network.write$,
          recsWorld: network.world,
        }),
      )
      .then(result => {
        unmount = result;
      });

    return () => {
      if (unmount) {
        unmount();
      }
    };
  }, [network]);

  return null;
}
