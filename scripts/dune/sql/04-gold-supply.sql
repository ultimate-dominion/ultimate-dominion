-- Ultimate Dominion: Gold Total Supply
-- Tracks cumulative Gold ERC20 mints (from 0x0) and burns (to 0x0)
-- Gold token: 0x0F046E538926760A737761b555fe1074b6B1e16A
WITH supply_changes AS (
  SELECT
    date_trunc('day', block_time) AS day,
    CASE
      -- Mint: from = 0x0
      WHEN topic1 = 0x0000000000000000000000000000000000000000000000000000000000000000
        THEN CAST(bytearray_to_uint256(data) AS double) / 1e18
      -- Burn: to = 0x0
      WHEN topic2 = 0x0000000000000000000000000000000000000000000000000000000000000000
        THEN -CAST(bytearray_to_uint256(data) AS double) / 1e18
    END AS supply_change
  FROM base.logs
  WHERE contract_address = 0x0F046E538926760A737761b555fe1074b6B1e16A
    AND topic0 = 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
    AND (
      topic1 = 0x0000000000000000000000000000000000000000000000000000000000000000
      OR topic2 = 0x0000000000000000000000000000000000000000000000000000000000000000
    )
)
SELECT
  day,
  sum(supply_change) AS daily_minted,
  sum(sum(supply_change)) OVER (ORDER BY day) AS total_supply
FROM supply_changes
GROUP BY day
ORDER BY day
