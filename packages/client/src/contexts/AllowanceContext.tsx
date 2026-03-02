import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Address, erc20Abi, maxUint256 } from 'viem';

import { useToast } from '../hooks/useToast';
import { useGameConfig } from '../lib/gameStore';
import { ERC_1155_ABI } from '../utils/constants';
import { SystemToAllow } from '../utils/types';

import { useAuth } from './AuthContext';
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

export const AllowanceProvider = ({
  children,
}: {
  children: ReactNode;
}): JSX.Element => {
  const { renderSuccess, renderError } = useToast();
  const { authMethod, embeddedWalletClient, externalWalletClient } = useAuth();
  const approvalClient = authMethod === 'embedded' ? embeddedWalletClient : externalWalletClient;
  const { network, isSynced } = useMUD();
  const { publicClient } = network;
  const { character, isRefreshing } = useCharacter();

  const configValue = useGameConfig('UltimateDominionConfig');
  const goldTokenAddress = (configValue?.goldToken as string) ?? null;
  const itemsAddress = (configValue?.items as string) ?? null;
  const lootManagerAddress = (configValue?.lootManager as string) ?? null;
  const marketplaceAddress = (configValue?.marketplace as string) ?? null;
  const shopAddress = (configValue?.shop as string) ?? null;

  const [goldMarketplaceAllowance, setGoldMarketplaceAllowance] = useState<bigint>(0n);
  const [itemsMarketplaceAllowance, setItemsMarketplaceAllowance] = useState<boolean>(false);
  const [goldLootManagerAllowance, setGoldLootManagerAllowance] = useState<bigint>(0n);
  const [itemsLootManagerAllowance, setItemsLootManagerAllowance] = useState<boolean>(false);
  const [goldShopAllowance, setGoldShopAllowance] = useState<bigint>(0n);
  const [itemsShopAllowance, setItemsShopAllowance] = useState<boolean>(false);

  const [isApprovingGold, setIsApprovingGold] = useState(false);
  const [isApprovingItems, setIsApprovingItems] = useState(false);

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

        if (!approvalClient) {
          throw new Error('No wallet client found.');
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

        const txHash = await approvalClient.writeContract(request);
        const { status } = await publicClient.waitForTransactionReceipt({
          hash: txHash,
        });

        if (status !== 'success') {
          throw new Error('Transaction failed.');
        }

        renderSuccess('Gold allowance successfully set!');
        await fetchAllowances();
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
      approvalClient,
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
      await onApproveGoldAllowance(systemToAllow, maxUint256);
    },
    [onApproveGoldAllowance],
  );

  const onSetApprovalForAllItems = useCallback(
    async (systemToAllow: SystemToAllow) => {
      try {
        setIsApprovingItems(true);

        if (!approvalClient) {
          throw new Error('No wallet client found.');
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

        const txHash = await approvalClient.writeContract(request);
        const { status } = await publicClient.waitForTransactionReceipt({
          hash: txHash,
        });

        if (status !== 'success') {
          throw new Error('Transaction failed.');
        }

        renderSuccess('Items allowance successfully set!');
        await fetchAllowances();
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
      approvalClient,
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

export const useAllowance = (): AllowanceContextType =>
  useContext(AllowanceContext);
