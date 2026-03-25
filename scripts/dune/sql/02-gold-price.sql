-- Ultimate Dominion: Gold Price in ETH
-- Derived from sqrtPriceX96 in Uniswap V3 Swap events
-- Pool: 0xE09639634Ba44B86c59dA7703aA9796f88082526 (Gold/WETH, 1% fee)
-- token0 = Gold (0x0F046E...), token1 = WETH (0x4200...)
-- price = (sqrtPriceX96 / 2^96)^2 = WETH per Gold
WITH swaps AS (
  SELECT
    block_time,
    date_trunc('hour', block_time) AS hour,
    -- Swap event data layout: amount0(32) | amount1(32) | sqrtPriceX96(32) | liquidity(32) | tick(32)
    bytearray_to_uint256(bytearray_substring(data, 65, 32)) AS sqrtPriceX96,
    bytearray_to_int256(bytearray_substring(data, 1, 32)) AS amount0_raw,
    bytearray_to_int256(bytearray_substring(data, 33, 32)) AS amount1_raw
  FROM base.logs
  WHERE contract_address = 0xE09639634Ba44B86c59dA7703aA9796f88082526
    AND topic0 = 0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67
)
SELECT
  hour,
  -- WETH per Gold (will be a small number like 0.000001)
  avg(power(CAST(sqrtPriceX96 AS double) / power(2, 96), 2)) AS price_eth_per_gold,
  -- Gold per ETH (inverse, more intuitive)
  avg(1.0 / NULLIF(power(CAST(sqrtPriceX96 AS double) / power(2, 96), 2), 0)) AS gold_per_eth,
  -- Volume in Gold (absolute amount0)
  sum(abs(CAST(amount0_raw AS double)) / 1e18) AS volume_gold,
  count(*) AS swap_count
FROM swaps
GROUP BY hour
ORDER BY hour
