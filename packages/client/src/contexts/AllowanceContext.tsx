import { useComponentValue } from '@latticexyz/react';
import { singletonEntity } from '@latticexyz/store-sync/recs';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Address, erc20Abi } from 'viem';

import { useToast } from '../hooks/useToast';
import { ERC_1155_ABI } from '../utils/constants';
import { useCharacter } from './CharacterContext';
import { useMUD } from './MUDContext';

type AllowanceContextType = {
  goldAllowance: bigint;
  itemsAllowance: boolean;
  refreshAllowances: () => void;
};

const AllowanceContext = createContext<AllowanceContextType>({
  goldAllowance: 0n,
  itemsAllowance: false,
  refreshAllowances: () => {},
});

export const AllowanceProvider = ({
  children,
}: {
  children: ReactNode;
}): JSX.Element => {
  const { renderError } = useToast();
  const {
    components: { UltimateDominionConfig },
    isSynced,
    network: { publicClient },
  } = useMUD();
  const { character, isRefreshing } = useCharacter();

  const [goldAllowance, setGoldAllowance] = useState<bigint>(0n);
  const [itemsAllowance, setItemsAllowance] = useState<boolean>(false);

  const {
    marketplace: marketplaceAddress,
    goldToken: goldTokenAddress,
    items: itemsAddress,
  } = useComponentValue(UltimateDominionConfig, singletonEntity) ?? {
    marketplace: null,
    goldToken: null,
    items: null,
  };

  const fetchAllowances = useCallback(async () => {
    if (!character) return;

    try {
      const _goldAllowance = await publicClient.readContract({
        address: goldTokenAddress as Address,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [character.owner as Address, marketplaceAddress as Address],
      });

      const _itemsAllowance = (await publicClient.readContract({
        address: itemsAddress as Address,
        abi: ERC_1155_ABI,
        functionName: 'isApprovedForAll',
        args: [character.owner as Address, marketplaceAddress as Address],
      })) as boolean;

      setGoldAllowance(_goldAllowance);
      setItemsAllowance(_itemsAllowance);
    } catch (e) {
      renderError((e as Error)?.message ?? 'Could not get allowances', e);
    }
  }, [
    character,
    goldTokenAddress,
    itemsAddress,
    marketplaceAddress,
    publicClient,
    renderError,
  ]);

  useEffect(() => {
    if (!isSynced) return;
    if (isRefreshing) return;
    if (!character) return;

    fetchAllowances();
  }, [character, fetchAllowances, isRefreshing, isSynced]);

  return (
    <AllowanceContext.Provider
      value={{
        goldAllowance,
        itemsAllowance,
        refreshAllowances: fetchAllowances,
      }}
    >
      {children}
    </AllowanceContext.Provider>
  );
};

export const useAllowance = (): AllowanceContextType =>
  useContext(AllowanceContext);
