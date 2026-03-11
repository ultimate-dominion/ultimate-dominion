// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Script.sol";

interface INonfungiblePositionManager {
    struct DecreaseLiquidityParams {
        uint256 tokenId;
        uint128 liquidity;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
    }

    struct CollectParams {
        uint256 tokenId;
        address recipient;
        uint128 amount0Max;
        uint128 amount1Max;
    }

    function decreaseLiquidity(DecreaseLiquidityParams calldata params)
        external
        payable
        returns (uint256 amount0, uint256 amount1);

    function collect(CollectParams calldata params)
        external
        payable
        returns (uint256 amount0, uint256 amount1);
}

interface IWETH {
    function balanceOf(address account) external view returns (uint256);
    function withdraw(uint256 wad) external;
}

contract WithdrawLiquidity is Script {
    INonfungiblePositionManager constant POSITION_MANAGER =
        INonfungiblePositionManager(0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1);

    IWETH constant WETH = IWETH(0x4200000000000000000000000000000000000006);

    uint256 constant TOKEN_ID_1 = 4773259;
    uint128 constant LIQUIDITY_1 = 100000000000000000000; // 100e18

    uint256 constant TOKEN_ID_2 = 4773413;
    uint128 constant LIQUIDITY_2 = 150000000000000004080;

    function run() external {
        vm.startBroadcast();

        // --- Position 1 ---
        console.log("--- Position 1 (tokenId: %s) ---", TOKEN_ID_1);

        (uint256 amount0_1, uint256 amount1_1) = POSITION_MANAGER.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: TOKEN_ID_1,
                liquidity: LIQUIDITY_1,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp + 300
            })
        );
        console.log("  decreaseLiquidity -> amount0: %s, amount1: %s", amount0_1, amount1_1);

        (uint256 collected0_1, uint256 collected1_1) = POSITION_MANAGER.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: TOKEN_ID_1,
                recipient: msg.sender,
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );
        console.log("  collected -> amount0: %s, amount1: %s", collected0_1, collected1_1);

        // --- Position 2 ---
        console.log("--- Position 2 (tokenId: %s) ---", TOKEN_ID_2);

        (uint256 amount0_2, uint256 amount1_2) = POSITION_MANAGER.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: TOKEN_ID_2,
                liquidity: LIQUIDITY_2,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp + 300
            })
        );
        console.log("  decreaseLiquidity -> amount0: %s, amount1: %s", amount0_2, amount1_2);

        (uint256 collected0_2, uint256 collected1_2) = POSITION_MANAGER.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: TOKEN_ID_2,
                recipient: msg.sender,
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );
        console.log("  collected -> amount0: %s, amount1: %s", collected0_2, collected1_2);

        // --- Unwrap WETH ---
        uint256 wethBalance = WETH.balanceOf(msg.sender);
        console.log("--- Unwrapping WETH: %s ---", wethBalance);
        if (wethBalance > 0) {
            WETH.withdraw(wethBalance);
        }

        vm.stopBroadcast();

        console.log("Done. All liquidity withdrawn and WETH unwrapped.");
    }
}
