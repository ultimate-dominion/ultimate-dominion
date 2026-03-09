import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
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
  ensureGoldAllowance: (system: SystemToAllow, amount: bigint) => Promise<boolean>;
  ensureItemsAllowance: (system: SystemToAllow) => Promise<boolean>;
  goldLootManagerAllowance: bigint;
  goldMarketplaceAllowance: bigint;
  goldShopAllowance: bigint;
  isApprovingGold: boolean;
  isApprovingItems: boolean;
  isAutoApproving: boolean;
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
  ensureGoldAllowance: async () => false,
  ensureItemsAllowance: async () => false,
  goldLootManagerAllowance: 0n,
  goldMarketplaceAllowance: 0n,
  goldShopAllowance: 0n,
  isApprovingGold: false,
  isApprovingItems: false,
  isAutoApproving: false,
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
  const [isAutoApproving, setIsAutoApproving] = useState(false);
  const hasAutoApprovedRef = useRef(false);

  const fetchAllowances = useCallback(async () => {
    if (!character) return;
    if (!goldTokenAddress || !itemsAddress) return;

    try {
      if (marketplaceAddress) {
        const [goldAllowance, itemsApproval] = await Promise.all([
          publicClient.readContract({
            address: goldTokenAddress as Address,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [character.owner as Address, marketplaceAddress as Address],
          }),
          publicClient.readContract({
            address: itemsAddress as Address,
            abi: ERC_1155_ABI,
            functionName: 'isApprovedForAll',
            args: [character.owner as Address, marketplaceAddress as Address],
          }) as Promise<boolean>,
        ]);
        setGoldMarketplaceAllowance(goldAllowance);
        setItemsMarketplaceAllowance(itemsApproval);
      }

      if (lootManagerAddress) {
        const [goldAllowance, itemsApproval] = await Promise.all([
          publicClient.readContract({
            address: goldTokenAddress as Address,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [character.owner as Address, lootManagerAddress as Address],
          }),
          publicClient.readContract({
            address: itemsAddress as Address,
            abi: ERC_1155_ABI,
            functionName: 'isApprovedForAll',
            args: [character.owner as Address, lootManagerAddress as Address],
          }) as Promise<boolean>,
        ]);
        setGoldLootManagerAllowance(goldAllowance);
        setItemsLootManagerAllowance(itemsApproval);
      }

      if (shopAddress) {
        const [goldAllowance, itemsApproval] = await Promise.all([
          publicClient.readContract({
            address: goldTokenAddress as Address,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [character.owner as Address, shopAddress as Address],
          }),
          publicClient.readContract({
            address: itemsAddress as Address,
            abi: ERC_1155_ABI,
            functionName: 'isApprovedForAll',
            args: [character.owner as Address, shopAddress as Address],
          }) as Promise<boolean>,
        ]);
        setGoldShopAllowance(goldAllowance);
        setItemsShopAllowance(itemsApproval);
      }
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

    const init = async () => {
      await fetchAllowances();

      // Auto-approve all allowances for embedded wallet users on first load
      if (authMethod !== 'embedded') return;
      if (!approvalClient) return;
      if (hasAutoApprovedRef.current) return;
      if (!goldTokenAddress || !itemsAddress) return;
      hasAutoApprovedRef.current = true;
      setIsAutoApproving(true);

      try {
        const approveGoldIfNeeded = async (spender: string) => {
          const current = await publicClient.readContract({
            address: goldTokenAddress as Address,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [character.owner as Address, spender as Address],
          });
          if (current > 0n) return;
          const { request } = await publicClient.simulateContract({
            address: goldTokenAddress as Address,
            abi: erc20Abi,
            functionName: 'approve',
            args: [spender as Address, maxUint256],
          });
          const txHash = await approvalClient.writeContract(request);
          await publicClient.waitForTransactionReceipt({ hash: txHash });
        };

        const approveItemsIfNeeded = async (spender: string) => {
          const current = await publicClient.readContract({
            address: itemsAddress as Address,
            abi: ERC_1155_ABI,
            functionName: 'isApprovedForAll',
            args: [character.owner as Address, spender as Address],
          }) as boolean;
          if (current) return;
          const { request } = await publicClient.simulateContract({
            address: itemsAddress as Address,
            abi: ERC_1155_ABI,
            functionName: 'setApprovalForAll',
            args: [spender as Address, true],
          });
          const txHash = await approvalClient.writeContract(request);
          await publicClient.waitForTransactionReceipt({ hash: txHash });
        };

        // Run approvals sequentially to avoid nonce collisions.
        // Each writeContract call needs the previous tx confirmed
        // so the provider picks up the correct next nonce.
        const spenders = [shopAddress, lootManagerAddress, marketplaceAddress].filter(Boolean) as string[];
        for (const spender of spenders) {
          try { await approveGoldIfNeeded(spender); } catch {}
          try { await approveItemsIfNeeded(spender); } catch {}
        }

        await fetchAllowances();
      } catch {
        // Silent — auto-approve is best-effort
      } finally {
        setIsAutoApproving(false);
      }
    };

    init();
  }, [
    approvalClient,
    authMethod,
    character,
    fetchAllowances,
    goldTokenAddress,
    isRefreshing,
    isSynced,
    itemsAddress,
    lootManagerAddress,
    marketplaceAddress,
    publicClient,
    shopAddress,
  ]);

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

  const ensureGoldAllowance = useCallback(
    async (system: SystemToAllow, _amount: bigint): Promise<boolean> => {
      if (authMethod !== 'embedded') return false;
      const systemAddress = getSystemAddress(system);
      if (!systemAddress || !approvalClient || !goldTokenAddress) return false;

      setIsApprovingGold(true);
      try {
        const { request } = await publicClient.simulateContract({
          address: goldTokenAddress as Address,
          abi: erc20Abi,
          functionName: 'approve',
          args: [systemAddress as Address, maxUint256],
        });
        const txHash = await approvalClient.writeContract(request);
        const { status } = await publicClient.waitForTransactionReceipt({
          hash: txHash,
        });
        if (status !== 'success') return false;
        await fetchAllowances();
        return true;
      } catch {
        return false;
      } finally {
        setIsApprovingGold(false);
      }
    },
    [
      approvalClient,
      authMethod,
      fetchAllowances,
      getSystemAddress,
      goldTokenAddress,
      publicClient,
    ],
  );

  const ensureItemsAllowance = useCallback(
    async (system: SystemToAllow): Promise<boolean> => {
      if (authMethod !== 'embedded') return false;
      const systemAddress = getSystemAddress(system);
      if (!systemAddress || !approvalClient || !itemsAddress) return false;

      setIsApprovingItems(true);
      try {
        const { request } = await publicClient.simulateContract({
          address: itemsAddress as Address,
          abi: ERC_1155_ABI,
          functionName: 'setApprovalForAll',
          args: [systemAddress as Address, true],
        });
        const txHash = await approvalClient.writeContract(request);
        const { status } = await publicClient.waitForTransactionReceipt({
          hash: txHash,
        });
        if (status !== 'success') return false;
        await fetchAllowances();
        return true;
      } catch {
        return false;
      } finally {
        setIsApprovingItems(false);
      }
    },
    [
      approvalClient,
      authMethod,
      fetchAllowances,
      getSystemAddress,
      itemsAddress,
      publicClient,
    ],
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
        ensureGoldAllowance,
        ensureItemsAllowance,
        goldLootManagerAllowance,
        goldMarketplaceAllowance,
        goldShopAllowance,
        isApprovingGold,
        isApprovingItems,
        isAutoApproving,
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
