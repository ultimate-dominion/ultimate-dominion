import mudConfig from 'contracts/mud.config';
import auctionSystemAbi from 'contracts/out/AuctionSystem.sol/AuctionSystem.abi.json';
import characterSystemAbi from 'contracts/out/CharacterSystem.sol/CharacterSystem.abi.json';
import combatSystemAbi from 'contracts/out/CombatSystem.sol/CombatSystem.abi.json';
import equipmentSystemAbi from 'contracts/out/EquipmentSystem.sol/EquipmentSystem.abi.json';
import worldAbi from 'contracts/out/IWorld.sol/IWorld.abi.json';
import mapSystemAbi from 'contracts/out/MapSystem.sol/MapSystem.abi.json';
import { useEffect, useMemo } from 'react';

import { useMUD } from '../contexts/MUDContext';

// Displays dev-tools connected to the burner wallet
export function DevTools(): null {
  const { delegatorAddress, network } = useMUD();

  const allAbi = useMemo(
    () => [
      ...network.worldContract.abi,
      ...characterSystemAbi,
      ...combatSystemAbi,
      ...equipmentSystemAbi,
      ...mapSystemAbi,
      ...auctionSystemAbi,
      ...worldAbi,
    ],
    [network.worldContract.abi],
  );

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
          worldAbi: allAbi,
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
  }, [allAbi, delegatorAddress, network]);

  return null;
}
