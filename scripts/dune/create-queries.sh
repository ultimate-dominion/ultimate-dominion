#!/usr/bin/env bash
# Create Phase 1 Dune dashboard queries for Ultimate Dominion
# Usage: DUNE_API_KEY=<key> bash scripts/dune/create-queries.sh

set -euo pipefail

API_KEY="${DUNE_API_KEY:?Set DUNE_API_KEY}"
BASE="https://api.dune.com/api/v1"

create_query() {
  local name="$1"
  local description="$2"
  local sql_file="$3"

  local sql
  sql=$(cat "$sql_file")

  local response
  response=$(curl -s -X POST "$BASE/query" \
    -H "X-Dune-Api-Key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
      --arg name "$name" \
      --arg desc "$description" \
      --arg sql "$sql" \
      '{name: $name, description: $desc, query_sql: $sql, is_private: false}')")

  local query_id
  query_id=$(echo "$response" | jq -r '.query_id // empty')

  if [ -z "$query_id" ]; then
    echo "FAILED to create '$name': $response" >&2
    return 1
  fi

  echo "$query_id"
}

execute_query() {
  local query_id="$1"
  curl -s -X POST "$BASE/query/$query_id/execute" \
    -H "X-Dune-Api-Key: $API_KEY" \
    -H "Content-Type: application/json" | jq -r '.execution_id // empty'
}

DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Creating Phase 1 Dune Queries ==="
echo ""

declare -A QUERIES
QUERIES["UD: Player Growth"]="Character ERC721 mints — daily new players and cumulative total|$DIR/sql/01-player-growth.sql"
QUERIES["UD: Gold Price (ETH)"]="Gold/WETH price derived from Uniswap V3 swap events|$DIR/sql/02-gold-price.sql"
QUERIES["UD: Daily Active Users"]="DAU from SessionTimer MUD Store events|$DIR/sql/03-dau.sql"
QUERIES["UD: Gold Total Supply"]="Cumulative Gold ERC20 mints minus burns|$DIR/sql/04-gold-supply.sql"
QUERIES["UD: Player Level Distribution"]="Current player levels from Stats MUD table|$DIR/sql/05-level-distribution.sql"

QUERY_IDS=""

for name in "UD: Player Growth" "UD: Gold Price (ETH)" "UD: Daily Active Users" "UD: Gold Total Supply" "UD: Player Level Distribution"; do
  IFS='|' read -r desc sql_file <<< "${QUERIES[$name]}"
  echo -n "Creating '$name'... "
  qid=$(create_query "$name" "$desc" "$sql_file")
  echo "query_id=$qid"
  QUERY_IDS="$QUERY_IDS$name=$qid\n"

  echo -n "  Executing... "
  eid=$(execute_query "$qid")
  echo "execution_id=$eid"
  echo ""
done

echo "=== All queries created ==="
echo ""
echo -e "$QUERY_IDS"
echo ""
echo "View at: https://dune.com/browse/queries (search 'UD:')"
