-- Ultimate Dominion: Player Growth
-- Uses MUD Store_SetRecord events on Characters table (UD systems bypass ERC721 puppet)
-- World: 0x99d01939F58B965E6E84a1D167E710Abdf5764b0
-- Characters tableId: 0x7462554400000000000000000000000043686172616374657273000000000000
--
-- Store_SetRecord data layout (single-key table):
--   keyTuple[0] (characterId): bytes 161-192
WITH char_creates AS (
  SELECT
    date_trunc('day', block_time) AS day,
    bytearray_substring(data, 161, 32) AS character_id
  FROM base.logs
  WHERE contract_address = 0x99d01939F58B965E6E84a1D167E710Abdf5764b0
    AND topic0 = 0x8dbb3a9672eebfd3773e72dd9c102393436816d832c7ba9e1e1ac8fcadcac7a9
    AND topic1 = 0x7462554400000000000000000000000043686172616374657273000000000000
),
-- Deduplicate: a character may have multiple SetRecord events (creation + updates)
-- Take the earliest event per character as the "creation" date
first_seen AS (
  SELECT
    character_id,
    min(day) AS creation_day
  FROM char_creates
  GROUP BY character_id
)
SELECT
  creation_day AS day,
  count(*) AS new_players,
  sum(count(*)) OVER (ORDER BY creation_day) AS total_players
FROM first_seen
GROUP BY creation_day
ORDER BY creation_day
