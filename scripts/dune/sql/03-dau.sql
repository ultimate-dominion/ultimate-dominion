-- Ultimate Dominion: Daily Active Users
-- Counts distinct character entities with SessionTimer updates per day
-- World: 0x99d01939F58B965E6E84a1D167E710Abdf5764b0
-- SessionTimer tableId: 0x7462554400000000000000000000000053657373696f6e54696d657200000000
--
-- MUD event data layout for entity extraction:
--   Store_SpliceStaticData: keyTuple[0] at bytes 129-160
--   Store_SetRecord: keyTuple[0] at bytes 161-192
WITH session_events AS (
  -- Store_SpliceStaticData events (most common — triggered on every session touch)
  SELECT
    date_trunc('day', block_time) AS day,
    bytearray_substring(data, 129, 32) AS entity_id
  FROM base.logs
  WHERE contract_address = 0x99d01939F58B965E6E84a1D167E710Abdf5764b0
    AND topic0 = 0x8c0b5119d4cec7b284c6b1b39252a03d1e2f2d7451a5895562524c113bb952be
    AND topic1 = 0x7462554400000000000000000000000053657373696f6e54696d657200000000

  UNION ALL

  -- Store_SetRecord events (initial session creation)
  SELECT
    date_trunc('day', block_time) AS day,
    bytearray_substring(data, 161, 32) AS entity_id
  FROM base.logs
  WHERE contract_address = 0x99d01939F58B965E6E84a1D167E710Abdf5764b0
    AND topic0 = 0x8dbb3a9672eebfd3773e72dd9c102393436816d832c7ba9e1e1ac8fcadcac7a9
    AND topic1 = 0x7462554400000000000000000000000053657373696f6e54696d657200000000
)
SELECT
  day,
  count(DISTINCT entity_id) AS dau
FROM session_events
GROUP BY day
ORDER BY day
