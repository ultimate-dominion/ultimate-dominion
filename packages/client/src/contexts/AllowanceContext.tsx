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
import { Address, erc20Abi, parseEther } from 'viem';
import { useWalletClient } from 'wagmi';

import { useToast } from '../hooks/useToast';
import { ERC_1155_ABI } from '../utils/constants';
import { useCharacter } from './CharacterContext';
import { useMUD } from './MUDContext';

type AllowanceContextType = {
  goldAllowance: bigint;
  isApprovingGold: boolean;
  isApprovingItems: boolean;
  itemsAllowance: boolean;
  onApproveGoldAllowance: (allowanceAmount: string) => void;
  onSetApprovalForAllItems: () => void;
  refreshAllowances: () => void;
};

const AllowanceContext = createContext<AllowanceContextType>({
  goldAllowance: 0n,
  isApprovingGold: false,
  isApprovingItems: false,
  itemsAllowance: false,
  onApproveGoldAllowance: () => {},
  onSetApprovalForAllItems: () => {},
  refreshAllowances: () => {},
});

export const AllowanceProvider = ({
  children,
}: {
  children: ReactNode;
}): JSX.Element => {
  const { renderSuccess, renderError } = useToast();
  const { data: externalWalletClient } = useWalletClient();
  const {
    components: { UltimateDominionConfig },
    isSynced,
    network: { publicClient },
  } = useMUD();
  const { character, isRefreshing } = useCharacter();

  const [goldAllowance, setGoldAllowance] = useState<bigint>(0n);
  const [itemsAllowance, setItemsAllowance] = useState<boolean>(false);
  const [isApprovingGold, setIsApprovingGold] = useState(false);
  const [isApprovingItems, setIsApprovingItems] = useState(false);

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

  const onApproveGoldAllowance = useCallback(
    async (allowanceAmount: string) => {
      try {
        setIsApprovingGold(true);

        if (!externalWalletClient) {
          throw new Error('No external wallet client found.');
        }

        if (!marketplaceAddress) {
          throw new Error('No Marketplace address found.');
        }

        if (!allowanceAmount || parseEther(allowanceAmount) <= 0) {
          throw new Error('Amount must be greater than 0.');
        }

        const { request } = await publicClient.simulateContract({
          address: goldTokenAddress as Address,
          abi: erc20Abi,
          functionName: 'approve',
          args: [marketplaceAddress as Address, parseEther(allowanceAmount)],
        });

        const txHash = await externalWalletClient.writeContract(request);
        const { status } = await publicClient.waitForTransactionReceipt({
          hash: txHash,
        });

        if (status !== 'success') {
          throw new Error('Transaction failed.');
        }

        renderSuccess('Gold allowance successfully set!');
        fetchAllowances();
      } catch (e) {
        renderError(
          (e as Error)?.message ?? 'Error setting gold allowance.',
          e,
        );
      } finally {
        setIsApprovingGold(false);
      }
    },
    [
      externalWalletClient,
      fetchAllowances,
      goldTokenAddress,
      marketplaceAddress,
      publicClient,
      renderError,
      renderSuccess,
    ],
  );

  const onSetApprovalForAllItems = useCallback(async () => {
    try {
      setIsApprovingItems(true);

      if (!externalWalletClient) {
        throw new Error('No external wallet client found.');
      }

      if (!marketplaceAddress) {
        throw new Error('No Marketplace address found.');
      }

      const { request } = await publicClient.simulateContract({
        address: itemsAddress as Address,
        abi: ERC_1155_ABI,
        functionName: 'setApprovalForAll',
        args: [marketplaceAddress, true],
      });

      const txHash = await externalWalletClient.writeContract(request);
      const { status } = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });

      if (status !== 'success') {
        throw new Error('Transaction failed.');
      }

      renderSuccess('Items allowance successfully set!');
      fetchAllowances();
    } catch (e) {
      renderError((e as Error)?.message ?? 'Error setting item allowance.', e);
    } finally {
      setIsApprovingItems(false);
    }
  }, [
    externalWalletClient,
    fetchAllowances,
    itemsAddress,
    marketplaceAddress,
    publicClient,
    renderError,
    renderSuccess,
  ]);

  return (
    <AllowanceContext.Provider
      value={{
        goldAllowance,
        isApprovingGold,
        isApprovingItems,
        itemsAllowance,
        onApproveGoldAllowance,
        onSetApprovalForAllItems,
        refreshAllowances: fetchAllowances,
      }}
    >
      {children}
    </AllowanceContext.Provider>
  );
};

export const useAllowance = (): AllowanceContextType =>
  useContext(AllowanceContext);
