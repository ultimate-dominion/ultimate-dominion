import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
/**
 * Paymaster webhook for Thirdweb Account Abstraction.
 *
 * Thirdweb POSTs transaction details here; we respond with approve/deny.
 * - Level < 3 (or no character): approve sponsorship (new player onboarding)
 * - Level >= 3: deny (player uses GasStation auto-swap)
 * - "Mercy" clause: if Gold AND ETH are both 0 at level 3+, approve one tx
 */
const WORLD_ADDRESS = process.env.WORLD_ADDRESS;
const RPC_URL = process.env.RPC_HTTP_URL || 'https://mainnet.base.org';
const GAS_STATION_MIN_LEVEL = 3;
// ABI fragments for reading character data from the World contract
const worldAbi = [
    {
        name: 'UD__getCharacterOwner',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'owner', type: 'address' }],
        outputs: [
            { name: 'characterTokenId', type: 'uint256' },
            { name: 'characterId', type: 'bytes32' },
        ],
    },
    {
        name: 'UD__getStats',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'entityId', type: 'bytes32' }],
        outputs: [
            {
                name: '',
                type: 'tuple',
                components: [
                    { name: 'strength', type: 'int256' },
                    { name: 'agility', type: 'int256' },
                    { name: 'class', type: 'uint8' },
                    { name: 'intelligence', type: 'int256' },
                    { name: 'maxHp', type: 'int256' },
                    { name: 'currentHp', type: 'int256' },
                    { name: 'experience', type: 'uint256' },
                    { name: 'level', type: 'uint256' },
                    { name: 'powerSource', type: 'uint8' },
                    { name: 'race', type: 'uint8' },
                    { name: 'startingArmor', type: 'uint8' },
                    { name: 'advancedClass', type: 'uint8' },
                    { name: 'hasSelectedAdvancedClass', type: 'bool' },
                ],
            },
        ],
    },
];
// ABI for reading gold token address from World
const goldTokenAbi = [
    {
        name: 'UD__getGoldToken',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'address' }],
    },
];
// ERC20 balanceOf ABI for gold token
const erc20Abi = [
    {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
    },
];
const publicClient = createPublicClient({
    chain: base,
    transport: http(RPC_URL),
});
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
        const { senderAddress } = req.body;
        if (!senderAddress) {
            // Can't determine player — deny by default
            return res.status(200).json({ approved: false, reason: 'No sender address' });
        }
        const sender = senderAddress;
        // Try to look up the player's character
        let characterId = null;
        let level = 0n;
        try {
            const [, charId] = await publicClient.readContract({
                address: WORLD_ADDRESS,
                abi: worldAbi,
                functionName: 'UD__getCharacterOwner',
                args: [sender],
            });
            characterId = charId;
            if (charId !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
                const stats = await publicClient.readContract({
                    address: WORLD_ADDRESS,
                    abi: worldAbi,
                    functionName: 'UD__getStats',
                    args: [charId],
                });
                level = stats.level;
            }
        }
        catch {
            // No character found — approve (needed for character creation)
            return res.status(200).json({ approved: true, reason: 'No character — onboarding' });
        }
        // No character yet — approve for onboarding
        if (!characterId || characterId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
            return res.status(200).json({ approved: true, reason: 'No character — onboarding' });
        }
        // Level < 3 — sponsor gas
        if (level < BigInt(GAS_STATION_MIN_LEVEL)) {
            return res.status(200).json({ approved: true, reason: `Level ${level} — sponsored` });
        }
        // Level >= 3 — check mercy clause (both Gold and ETH are 0)
        try {
            const ethBalance = await publicClient.getBalance({ address: sender });
            if (ethBalance === 0n) {
                // Check gold balance too — only approve mercy if truly stuck (both 0)
                let goldBalance = 1n; // default non-zero so we deny if lookup fails
                try {
                    const goldToken = await publicClient.readContract({
                        address: WORLD_ADDRESS,
                        abi: goldTokenAbi,
                        functionName: 'UD__getGoldToken',
                    });
                    goldBalance = await publicClient.readContract({
                        address: goldToken,
                        abi: erc20Abi,
                        functionName: 'balanceOf',
                        args: [sender],
                    });
                }
                catch {
                    // If gold lookup fails, deny — player likely has gold and can use GasStation
                }
                if (goldBalance === 0n) {
                    return res.status(200).json({
                        approved: true,
                        reason: 'Mercy clause — zero ETH and zero Gold at level 3+',
                    });
                }
            }
        }
        catch {
            // If we can't check balance, deny to be safe
        }
        // Level >= 3 with ETH — use GasStation
        return res.status(200).json({
            approved: false,
            reason: `Level ${level} — use GasStation`,
        });
    }
    catch (error) {
        console.error('[paymasterWebhook] Error:', error);
        // On error, deny to prevent unexpected gas spending
        return res.status(200).json({ approved: false, reason: 'Internal error' });
    }
}
