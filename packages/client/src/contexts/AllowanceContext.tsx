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
import { AllowanceType } from '../utils/types';
import { useCharacter } from './CharacterContext';
import { useMUD } from './MUDContext';

type AllowanceContextType = {
  goldAllowanceMarketplace: bigint;
  goldAllowanceShops: bigint;
  isApprovingGoldMarketplace: boolean;
  isApprovingGoldShops: boolean;
  isApprovingItemsMarketplace: boolean;
  isApprovingItemsShops: boolean;
  itemsAllowanceMarketplace: boolean;
  itemsAllowanceShops: boolean;
  onApproveGoldAllowance: (
    allowanceAmount: string,
    allowanceType: AllowanceType,
  ) => void;
  onSetApprovalForAllItems: (allowanceType: AllowanceType) => void;
  refreshAllowances: () => void;
};

const AllowanceContext = createContext<AllowanceContextType>({
  goldAllowanceMarketplace: 0n,
  goldAllowanceShops: 0n,
  isApprovingGoldMarketplace: false,
  isApprovingGoldShops: false,
  isApprovingItemsMarketplace: false,
  isApprovingItemsShops: false,
  itemsAllowanceMarketplace: false,
  itemsAllowanceShops: false,
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

  const [goldAllowanceMarketplace, setGoldAllowanceMarketplace] =
    useState<bigint>(0n);
  const [itemsAllowanceMarketplace, setItemsAllowanceMarketplace] =
    useState<boolean>(false);
  const [isApprovingGoldMarketplace, setIsApprovingGoldMarketplace] =
    useState(false);
  const [isApprovingItemsMarketplace, setIsApprovingItemsMarketplace] =
    useState(false);

  const [goldAllowanceShops, setGoldAllowanceShops] = useState<bigint>(0n);
  const [itemsAllowanceShops, setItemsAllowanceShops] =
    useState<boolean>(false);
  const [isApprovingGoldShops, setIsApprovingGoldShops] = useState(false);
  const [isApprovingItemsShops, setIsApprovingItemsShops] = useState(false);

  const {
    goldToken: goldTokenAddress,
    items: itemsAddress,
    marketplace: marketplaceAddress,
    shop: shopAddress,
  } = useComponentValue(UltimateDominionConfig, singletonEntity) ?? {
    goldToken: null,
    items: null,
    marketplace: null,
    shop: null,
  };

  const fetchAllowances = useCallback(async () => {
    if (!character) return;

    try {
      const _goldAllowanceMarketplace = await publicClient.readContract({
        address: goldTokenAddress as Address,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [character.owner as Address, marketplaceAddress as Address],
      });

      const _itemsAllowanceMarketplace = (await publicClient.readContract({
        address: itemsAddress as Address,
        abi: ERC_1155_ABI,
        functionName: 'isApprovedForAll',
        args: [character.owner as Address, marketplaceAddress as Address],
      })) as boolean;

      setGoldAllowanceMarketplace(_goldAllowanceMarketplace);
      setItemsAllowanceMarketplace(_itemsAllowanceMarketplace);

      const _goldAllowanceShops = await publicClient.readContract({
        address: goldTokenAddress as Address,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [character.owner as Address, shopAddress as Address],
      });

      const _itemsAllowanceShops = (await publicClient.readContract({
        address: itemsAddress as Address,
        abi: ERC_1155_ABI,
        functionName: 'isApprovedForAll',
        args: [character.owner as Address, shopAddress as Address],
      })) as boolean;

      setGoldAllowanceShops(_goldAllowanceShops);
      setItemsAllowanceShops(_itemsAllowanceShops);
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
    shopAddress,
  ]);

  useEffect(() => {
    if (!isSynced) return;
    if (isRefreshing) return;
    if (!character) return;

    fetchAllowances();
  }, [character, fetchAllowances, isRefreshing, isSynced]);

  const onApproveGoldAllowance = useCallback(
    async (allowanceAmount: string, allowanceType: AllowanceType) => {
      if (!externalWalletClient) {
        throw new Error('No external wallet client found.');
      }
      if (!allowanceAmount || parseEther(allowanceAmount) <= 0) {
        throw new Error('Amount must be greater than 0.');
      }
      try {
        switch (allowanceType) {
          default:
            throw new Error('No allowance type');
          case AllowanceType.Marketplace: {
            setIsApprovingGoldMarketplace(true);
            const { request: marketplaceRequest } =
              await publicClient.simulateContract({
                address: goldTokenAddress as Address,
                abi: erc20Abi,
                functionName: 'approve',
                args: [
                  marketplaceAddress as Address,
                  parseEther(allowanceAmount),
                ],
              });
            const txHash =
              await externalWalletClient.writeContract(marketplaceRequest);
            const { status } = await publicClient.waitForTransactionReceipt({
              hash: txHash,
            });

            if (status !== 'success') {
              throw new Error('Transaction failed.');
            }

            break;
          }
          case AllowanceType.Shop: {
            setIsApprovingGoldShops(true);
            const { request: shopRequest } =
              await publicClient.simulateContract({
                address: goldTokenAddress as Address,
                abi: erc20Abi,
                functionName: 'approve',
                args: [shopAddress as Address, parseEther(allowanceAmount)],
              });
            const txHash =
              await externalWalletClient.writeContract(shopRequest);
            const { status } = await publicClient.waitForTransactionReceipt({
              hash: txHash,
            });

            if (status !== 'success') {
              throw new Error('Transaction failed.');
            }
          }
        }

        renderSuccess('Gold allowance successfully set!');
        fetchAllowances();
      } catch (e) {
        renderError(
          (e as Error)?.message ?? 'Error setting gold allowance.',
          e,
        );
      } finally {
        setIsApprovingGoldMarketplace(false);
        setIsApprovingGoldShops(false);
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
      shopAddress,
    ],
  );

  const onSetApprovalForAllItems = useCallback(
    /**
     *
     * @param allowanceType 0 for marketplace, 1 for shops
     */
    async (allowanceType: AllowanceType) => {
      try {
        if (!externalWalletClient) {
          throw new Error('No external wallet client found.');
        }
        switch (allowanceType) {
          default: {
            throw new Error('No allowance type');
          }
          case AllowanceType.Marketplace: {
            setIsApprovingItemsMarketplace(true);
            if (!marketplaceAddress) {
              throw new Error('No Marketplace address found.');
            }
            const { request: marketplaceRequest } =
              await publicClient.simulateContract({
                address: itemsAddress as Address,
                abi: ERC_1155_ABI,
                functionName: 'setApprovalForAll',
                args: [marketplaceAddress, true],
              });
            const txHashMarketplace =
              await externalWalletClient.writeContract(marketplaceRequest);
            const { status: marketplaceStatus } =
              await publicClient.waitForTransactionReceipt({
                hash: txHashMarketplace,
              });

            if (marketplaceStatus !== 'success') {
              throw new Error('Transaction failed.');
            }
            break;
          }
          case AllowanceType.Shop: {
            setIsApprovingItemsShops(true);

            if (!shopAddress) {
              throw new Error('No Marketplace address found.');
            }

            const { request: shopRequest } =
              await publicClient.simulateContract({
                address: itemsAddress as Address,
                abi: ERC_1155_ABI,
                functionName: 'setApprovalForAll',
                args: [shopAddress, true],
              });

            const txHashShops =
              await externalWalletClient.writeContract(shopRequest);
            const { status: shopStatus } =
              await publicClient.waitForTransactionReceipt({
                hash: txHashShops,
              });
            if (shopStatus !== 'success') {
              throw new Error('Transaction failed.');
            }
          }
        }

        renderSuccess('Items allowance successfully set!');
        fetchAllowances();
      } catch (e) {
        renderError(
          (e as Error)?.message ?? 'Error setting item allowance.',
          e,
        );
      } finally {
        setIsApprovingItemsMarketplace(false);
        setIsApprovingItemsShops(false);
      }
    },
    [
      externalWalletClient,
      fetchAllowances,
      itemsAddress,
      marketplaceAddress,
      publicClient,
      renderError,
      renderSuccess,
      shopAddress,
    ],
  );

  return (
    <AllowanceContext.Provider
      value={{
        goldAllowanceMarketplace,
        goldAllowanceShops,
        isApprovingGoldMarketplace,
        isApprovingGoldShops,
        isApprovingItemsMarketplace,
        isApprovingItemsShops,
        itemsAllowanceMarketplace,
        itemsAllowanceShops,
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
