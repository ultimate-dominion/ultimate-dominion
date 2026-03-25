-- Ultimate Dominion: Player Level Distribution
-- Joins Characters table (for known player entities) with Stats table (for level data)
-- World: 0x99d01939F58B965E6E84a1D167E710Abdf5764b0
-- Characters tableId: 0x7462554400000000000000000000000043686172616374657273000000000000
-- Stats tableId: 0x7462554400000000000000000000000053746174730000000000000000000000
--
-- Store_SetRecord layout (single-key table):
--   keyTuple[0] at bytes 161-192
--   Stats staticData starts at byte 225; level at offset 193 → byte 418
WITH characters AS (
  -- All known player character entity IDs from Characters table
  SELECT DISTINCT
    bytearray_substring(data, 161, 32) AS entity_id
  FROM base.logs
  WHERE contract_address = 0x99d01939F58B965E6E84a1D167E710Abdf5764b0
    AND topic0 = 0x8dbb3a9672eebfd3773e72dd9c102393436816d832c7ba9e1e1ac8fcadcac7a9
    AND topic1 = 0x7462554400000000000000000000000043686172616374657273000000000000
),
stats_records AS (
  -- All Stats Store_SetRecord events (includes both players and mobs)
  SELECT
    block_number,
    index AS log_index,
    bytearray_substring(data, 161, 32) AS entity_id,
    bytearray_to_uint256(bytearray_substring(data, 418, 32)) AS level
  FROM base.logs
  WHERE contract_address = 0x99d01939F58B965E6E84a1D167E710Abdf5764b0
    AND topic0 = 0x8dbb3a9672eebfd3773e72dd9c102393436816d832c7ba9e1e1ac8fcadcac7a9
    AND topic1 = 0x7462554400000000000000000000000053746174730000000000000000000000
),
player_stats AS (
  -- Only Stats records for known player characters, latest per entity
  SELECT
    s.entity_id,
    s.level,
    ROW_NUMBER() OVER (PARTITION BY s.entity_id ORDER BY s.block_number DESC, s.log_index DESC) AS rn
  FROM stats_records s
  INNER JOIN characters c ON s.entity_id = c.entity_id
)
SELECT
  CAST(level AS integer) AS level,
  count(*) AS player_count
FROM player_stats
WHERE rn = 1
  AND level BETWEEN 1 AND 100
GROUP BY level
ORDER BY level
