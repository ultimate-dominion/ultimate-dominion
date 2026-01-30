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
import { Address, erc20Abi, maxUint256 } from 'viem';
import { useWalletClient } from 'wagmi';

import { useToast } from '../hooks/useToast';
import { ERC_1155_ABI } from '../utils/constants';
import { SystemToAllow } from '../utils/types';

import { useCharacter } from './CharacterContext';
import { useMUD } from './MUDContext';

type AllowanceContextType = {
  goldLootManagerAllowance: bigint;
  goldMarketplaceAllowance: bigint;
  goldShopAllowance: bigint;
  isApprovingGold: boolean;
  isApprovingItems: boolean;
  itemsLootManagerAllowance: boolean;
  itemsMarketplaceAllowance: boolean;
  itemsShopAllowance: boolean;
  onApproveGoldAllowance: (
    systemToAllow: SystemToAllow,
    allowanceAmount: bigint,
  ) => void;
  onApproveMaxGoldAllowance: (
    SystemToAllow: SystemToAllow,
    allowanceAmount: bigint,
  ) => void;
  onSetApprovalForAllItems: (systemToAllow: SystemToAllow) => void;
  refreshAllowances: () => void;
};

const defaultContextValue: AllowanceContextType = {
  goldLootManagerAllowance: 0n,
  goldMarketplaceAllowance: 0n,
  goldShopAllowance: 0n,
  isApprovingGold: false,
  isApprovingItems: false,
  itemsLootManagerAllowance: false,
  itemsMarketplaceAllowance: false,
  itemsShopAllowance: false,
  onApproveGoldAllowance: () => {},
  onApproveMaxGoldAllowance: () => {},
  onSetApprovalForAllItems: () => {},
  refreshAllowances: () => {},
};

const AllowanceContext = createContext<AllowanceContextType>(defaultContextValue);

// Inner component that uses hooks - only rendered when components are ready
const AllowanceProviderInner = ({
  children,
  UltimateDominion,
  publicClient,
  isSynced,
}: {
  children: ReactNode;
  UltimateDominion: any;
  publicClient: any;
  isSynced: boolean;
}): JSX.Element => {
  const { renderSuccess, renderError } = useToast();
  const { data: externalWalletClient } = useWalletClient();
  const { character, isRefreshing } = useCharacter();

  const [goldMarketplaceAllowance, setGoldMarketplaceAllowance] =
    useState<bigint>(0n);
  const [itemsMarketplaceAllowance, setItemsMarketplaceAllowance] =
    useState<boolean>(false);
  const [goldLootManagerAllowance, setGoldLootManagerAllowance] =
    useState<bigint>(0n);
  const [itemsLootManagerAllowance, setItemsLootManagerAllowance] =
    useState<boolean>(false);
  const [goldShopAllowance, setGoldShopAllowance] = useState<bigint>(0n);
  const [itemsShopAllowance, setItemsShopAllowance] = useState<boolean>(false);

  const [isApprovingGold, setIsApprovingGold] = useState(false);
  const [isApprovingItems, setIsApprovingItems] = useState(false);

  const configValue = useComponentValue(
    UltimateDominion,
    singletonEntity,
  );
  const goldTokenAddress = configValue?.goldToken ?? null;
  const itemsAddress = configValue?.items ?? null;
  const lootManagerAddress = configValue?.lootManager ?? null;
  const marketplaceAddress = configValue?.marketplace ?? null;
  const shopAddress = configValue?.shop ?? null;

  const fetchAllowances = useCallback(async () => {
    if (!character) return;
    if (!goldTokenAddress || !itemsAddress || !marketplaceAddress || !lootManagerAddress || !shopAddress) return;

    try {
      const _goldMarketplaceAllowance = await publicClient.readContract({
        address: goldTokenAddress as Address,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [character.owner as Address, marketplaceAddress as Address],
      });

      const _itemsMarketplaceAllowance = (await publicClient.readContract({
        address: itemsAddress as Address,
        abi: ERC_1155_ABI,
        functionName: 'isApprovedForAll',
        args: [character.owner as Address, marketplaceAddress as Address],
      })) as boolean;

      const _goldLootManagerAllowance = await publicClient.readContract({
        address: goldTokenAddress as Address,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [character.owner as Address, lootManagerAddress as Address],
      });
      const _itemsLootManagerAllowance = (await publicClient.readContract({
        address: itemsAddress as Address,
        abi: ERC_1155_ABI,
        functionName: 'isApprovedForAll',
        args: [character.owner as Address, lootManagerAddress as Address],
      })) as boolean;

      const _goldShopAllowance = await publicClient.readContract({
        address: goldTokenAddress as Address,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [character.owner as Address, shopAddress as Address],
      });
      const _itemsShopAllowance = (await publicClient.readContract({
        address: itemsAddress as Address,
        abi: ERC_1155_ABI,
        functionName: 'isApprovedForAll',
        args: [character.owner as Address, shopAddress as Address],
      })) as boolean;

      setGoldMarketplaceAllowance(_goldMarketplaceAllowance);
      setItemsMarketplaceAllowance(_itemsMarketplaceAllowance);
      setGoldLootManagerAllowance(_goldLootManagerAllowance);
      setItemsLootManagerAllowance(_itemsLootManagerAllowance);
      setGoldShopAllowance(_goldShopAllowance);
      setItemsShopAllowance(_itemsShopAllowance);
    } catch (e) {
      renderError((e as Error)?.message ?? 'Could not get allowances', e);
    }
  }, [
    character,
    goldTokenAddress,
    itemsAddress,
    lootManagerAddress,
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

  const getSystemAddress = useCallback(
    (systemToAllow: SystemToAllow) => {
      switch (systemToAllow) {
        case SystemToAllow.LootManager:
          return lootManagerAddress;
        case SystemToAllow.Marketplace:
          return marketplaceAddress;
        case SystemToAllow.Shop:
          return shopAddress;
        default:
          return null;
      }
    },
    [lootManagerAddress, marketplaceAddress, shopAddress],
  );

  const onApproveGoldAllowance = useCallback(
    async (systemToAllow: SystemToAllow, allowanceAmount: bigint) => {
      try {
        setIsApprovingGold(true);

        if (!externalWalletClient) {
          throw new Error('No external wallet client found.');
        }

        const systemAddress = getSystemAddress(systemToAllow);

        if (!systemAddress) {
          throw new Error('No system address found.');
        }

        if (!allowanceAmount || allowanceAmount <= 0) {
          throw new Error('Amount must be greater than 0.');
        }

        const { request } = await publicClient.simulateContract({
          address: goldTokenAddress as Address,
          abi: erc20Abi,
          functionName: 'approve',
          args: [systemAddress as Address, allowanceAmount],
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
      getSystemAddress,
      goldTokenAddress,
      publicClient,
      renderError,
      renderSuccess,
    ],
  );

  const onApproveMaxGoldAllowance = useCallback(
    async (systemToAllow: SystemToAllow) => {
      onApproveGoldAllowance(systemToAllow, maxUint256);
    },
    [onApproveGoldAllowance],
  );

  const onSetApprovalForAllItems = useCallback(
    async (systemToAllow: SystemToAllow) => {
      try {
        setIsApprovingItems(true);

        if (!externalWalletClient) {
          throw new Error('No external wallet client found.');
        }

        const systemAddress = getSystemAddress(systemToAllow);

        if (!systemAddress) {
          throw new Error('No system address found.');
        }

        const { request } = await publicClient.simulateContract({
          address: itemsAddress as Address,
          abi: ERC_1155_ABI,
          functionName: 'setApprovalForAll',
          args: [systemAddress, true],
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
        renderError(
          (e as Error)?.message ?? 'Error setting item allowance.',
          e,
        );
      } finally {
        setIsApprovingItems(false);
      }
    },
    [
      externalWalletClient,
      fetchAllowances,
      getSystemAddress,
      itemsAddress,
      publicClient,
      renderError,
      renderSuccess,
    ],
  );

  return (
    <AllowanceContext.Provider
      value={{
        goldLootManagerAllowance,
        goldMarketplaceAllowance,
        goldShopAllowance,
        isApprovingGold,
        isApprovingItems,
        itemsLootManagerAllowance,
        itemsMarketplaceAllowance,
        itemsShopAllowance,
        onApproveGoldAllowance,
        onApproveMaxGoldAllowance,
        onSetApprovalForAllItems,
        refreshAllowances: fetchAllowances,
      }}
    >
      {children}
    </AllowanceContext.Provider>
  );
};

export const AllowanceProvider = ({
  children,
}: {
  children: ReactNode;
}): JSX.Element => {
  const { components, isSynced, network } = useMUD();
  const { publicClient } = network;
  const UltimateDominion = components?.UltimateDominion;

  // If component isn't ready, render with default context
  if (!UltimateDominion) {
    return (
      <AllowanceContext.Provider value={defaultContextValue}>
        {children}
      </AllowanceContext.Provider>
    );
  }

  return (
    <AllowanceProviderInner
      UltimateDominion={UltimateDominion}
      publicClient={publicClient}
      isSynced={isSynced}
    >
      {children}
    </AllowanceProviderInner>
  );
};

export const useAllowance = (): AllowanceContextType =>
  useContext(AllowanceContext);
