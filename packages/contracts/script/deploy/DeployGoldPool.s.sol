// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";

import {IWorld} from "@world/IWorld.sol";
import {UltimateDominionConfig} from "@codegen/index.sol";
import {IERC20Mintable} from "@latticexyz/world-modules/src/modules/erc20-puppet/IERC20Mintable.sol";
import {BASE_WETH, DEFAULT_POOL_FEE} from "../../constants.sol";

/// @notice Uniswap V3 Factory interface (minimal)
interface IUniswapV3Factory {
    function createPool(address tokenA, address tokenB, uint24 fee) external returns (address pool);
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool);
}

/// @notice Uniswap V3 Pool interface (minimal)
interface IUniswapV3Pool {
    function initialize(uint160 sqrtPriceX96) external;
    function token0() external view returns (address);
    function token1() external view returns (address);
}

/// @notice Uniswap V3 NonfungiblePositionManager interface (minimal)
interface INonfungiblePositionManager {
    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }

    function mint(MintParams calldata params)
        external
        payable
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);
}

interface IWETH9 {
    function deposit() external payable;
    function approve(address spender, uint256 amount) external returns (bool);
}

/**
 * @title DeployGoldPool
 * @notice Creates and seeds a Uniswap V3 GOLD/WETH pool on Base.
 * @dev Run with:
 *   source .env.testnet && forge script DeployGoldPool --broadcast --sig "run(address)" <WORLD_ADDRESS>
 *
 * Prerequisites:
 * - World must be deployed with gold token configured
 * - Deployer must hold both gold and ETH for initial liquidity
 *
 * Base Mainnet addresses:
 * - Uniswap V3 Factory: 0x33128a8fC17869897dcE68Ed026d694621f6FDfD
 * - NonfungiblePositionManager: 0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1
 * - WETH: 0x4200000000000000000000000000000000000006
 */
contract DeployGoldPool is Script {
    // Base Mainnet Uniswap V3 addresses
    address constant UNISWAP_V3_FACTORY = 0x33128a8fC17869897dcE68Ed026d694621f6FDfD;
    address constant POSITION_MANAGER = 0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1;
    address constant WETH = BASE_WETH;
    uint24 immutable POOL_FEE;

    constructor() {
        POOL_FEE = uint24(vm.envOr("POOL_FEE", uint256(DEFAULT_POOL_FEE)));
    }

    function run(address worldAddress) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        StoreSwitch.setStoreAddress(worldAddress);

        // Read gold token address from world config
        address goldToken = UltimateDominionConfig.getGoldToken();
        console.log("Gold token:", goldToken);
        console.log("WETH:", WETH);
        console.log("Deployer:", deployer);

        // Read configurable amounts from env (defaults: 500K gold + 0.5 ETH)
        uint256 goldAmount = vm.envOr("POOL_GOLD_AMOUNT", uint256(500_000e18));
        uint256 ethAmount = vm.envOr("POOL_ETH_AMOUNT", uint256(0.5 ether));

        console.log("Gold for liquidity:", goldAmount / 1e18, "GOLD");
        console.log("ETH for liquidity:", ethAmount / 1e15, "finney");

        // Determine token ordering (Uniswap requires token0 < token1)
        (address token0, address token1) = goldToken < WETH
            ? (goldToken, WETH)
            : (WETH, goldToken);
        bool goldIsToken0 = (token0 == goldToken);

        console.log("token0:", token0);
        console.log("token1:", token1);
        console.log("Gold is token0:", goldIsToken0);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Check if pool already exists
        IUniswapV3Factory factory = IUniswapV3Factory(UNISWAP_V3_FACTORY);
        address existingPool = factory.getPool(goldToken, WETH, POOL_FEE);

        address pool;
        if (existingPool != address(0)) {
            console.log("Pool already exists:", existingPool);
            pool = existingPool;
        } else {
            // 2. Create pool
            pool = factory.createPool(goldToken, WETH, POOL_FEE);
            console.log("Pool created:", pool);

            // 3. Initialize pool with starting price
            // Target: ~$0.001/gold at ~$2500/ETH → 1 ETH = 1,000,000 gold
            // sqrtPriceX96 = sqrt(price) * 2^96
            // price = token1/token0 in Uniswap V3
            //
            // If gold is token0: price = WETH/GOLD = 1/1000000
            //   sqrtPriceX96 = sqrt(1/1000000) * 2^96 = (1/1000) * 2^96
            // If WETH is token0: price = GOLD/WETH = 1000000 → sqrt(1000000) * 2^96
            //
            // We use a configurable sqrtPriceX96 from env, with a reasonable default
            uint160 sqrtPriceX96;
            if (goldIsToken0) {
                // price = WETH/GOLD = 1/1000000 (very small number, gold is cheap vs WETH)
                // sqrt(1/1000000) * 2^96 = (1/1000) * 2^96 ≈ 79228162514264337593543950
                sqrtPriceX96 = uint160(vm.envOr("SQRT_PRICE_X96", uint256(79228162514264337593543950)));
            } else {
                // price = GOLD/WETH = 1000000 (large number)
                // sqrt(1000000) * 2^96 = 1000 * 2^96 ≈ 79228162514264337593543950336000
                sqrtPriceX96 = uint160(vm.envOr("SQRT_PRICE_X96", uint256(79228162514264337593543950336000)));
            }

            IUniswapV3Pool(pool).initialize(sqrtPriceX96);
            console.log("Pool initialized with sqrtPriceX96:", uint256(sqrtPriceX96));
        }

        // 4. Wrap ETH → WETH for liquidity provision
        IWETH9(WETH).deposit{value: ethAmount}();
        console.log("Wrapped ETH to WETH");

        // 5. Approve position manager to spend tokens
        IERC20Mintable(goldToken).approve(POSITION_MANAGER, goldAmount);
        IWETH9(WETH).approve(POSITION_MANAGER, ethAmount);

        // 6. Mint liquidity position
        // ±20% range around initial price for concentrated liquidity
        // Tick spacing depends on fee tier: 100→1, 500→10, 3000→60, 10000→200
        int24 tickSpacing = POOL_FEE == 10000 ? int24(200) : POOL_FEE == 3000 ? int24(60) : POOL_FEE == 500 ? int24(10) : int24(1);
        // Full range for initial seeding; production should use tighter range for capital efficiency
        int24 tickLower = (-887272 / tickSpacing) * tickSpacing;
        int24 tickUpper = (887272 / tickSpacing) * tickSpacing;

        (uint256 amount0Desired, uint256 amount1Desired) = goldIsToken0
            ? (goldAmount, ethAmount)
            : (ethAmount, goldAmount);

        (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1) = INonfungiblePositionManager(POSITION_MANAGER).mint(
            INonfungiblePositionManager.MintParams({
                token0: token0,
                token1: token1,
                fee: POOL_FEE,
                tickLower: tickLower,
                tickUpper: tickUpper,
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
                amount0Min: 0, // Accept any amount for initial seeding
                amount1Min: 0,
                recipient: deployer,
                deadline: block.timestamp + 300
            })
        );

        vm.stopBroadcast();

        console.log("=== Liquidity Position Created ===");
        console.log("  NFT Token ID:", tokenId);
        console.log("  Liquidity:", uint256(liquidity));
        console.log("  Amount0 used:", amount0);
        console.log("  Amount1 used:", amount1);
        console.log("  Pool address:", pool);
    }
}
