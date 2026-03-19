#!/bin/bash
# Fix missing WeaponStats/ArmorStats for BalancePatchV3 items (tokens 76-82)
# Uses cast send to call World.setRecord directly

set -euo pipefail
cd "$(dirname "$0")/../.."
source .env.mainnet

WORLD="0x99d01939F58B965E6E84a1D167E710Abdf5764b0"
WS_TABLE="0x74625544000000000000000000000000576561706f6e53746174730000000000"
AS_TABLE="0x74625544000000000000000000000000000041726d6f7253746174730000000000"

# WeaponStats field layout: 7 static int256/uint256 fields = 224 bytes (0x00e0)
# ArmorStats field layout: 6 static fields + 1 uint8 = 193 bytes (0x00c1)

# Helper: encode WeaponStats static data (7 x int256/uint256, each 32 bytes)
encode_weapon_static() {
    local agi=$1 int=$2 hp=$3 maxd=$4 mind=$5 minlvl=$6 str=$7
    cast abi-encode "f(int256,int256,int256,int256,int256,uint256,int256)" \
        "$agi" "$int" "$hp" "$maxd" "$mind" "$minlvl" "$str" | cut -c3-
}

# Helper: encode effects array as packed bytes32[]
encode_effects() {
    local result=""
    for eff in "$@"; do
        result="${result}${eff:2}" # strip 0x
    done
    echo "0x${result}"
}

# Helper: encode MUD EncodedLengths for a single dynamic field
# MUD v2: least-significant 7 bytes = total, then 5-byte chunks for each field
encode_lengths_single() {
    local byte_len=$1
    # encoded = (field0_len << 56) | total_len
    python3 -c "
bl = $byte_len
encoded = (bl << 56) | bl
print('0x' + hex(encoded)[2:].zfill(64))
"
}

set_weapon() {
    local id=$1 agi=$2 int=$3 hp=$4 maxd=$5 mind=$6 minlvl=$7 str=$8 name=$9
    shift 9
    local effects=("$@")

    local key=$(cast --to-bytes32 "$id")
    local static_data="0x$(encode_weapon_static "$agi" "$int" "$hp" "$maxd" "$mind" "$minlvl" "$str")"
    local dynamic=$(encode_effects "${effects[@]}")
    local dyn_len=$(( (${#dynamic} - 2) / 2 )) # byte length
    local encoded_lengths=$(encode_lengths_single $dyn_len)

    echo "Setting WeaponStats for token $id ($name)..."
    cast send "$WORLD" \
        "setRecord(bytes32,bytes32[],bytes,bytes32,bytes)" \
        "$WS_TABLE" \
        "[$key]" \
        "$static_data" \
        "$encoded_lengths" \
        "$dynamic" \
        --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" 2>&1
    echo "  Done: $name"
}

# Effect IDs
PHYS="0xbeeab8b096ac11af000000000000000000000000000000000000000000000000"
MAGIC="0xeee09063621624b3000000000000000000000000000000000000000000000000"
WEAKEN="0x98562f2b32aeb98f000000000000000000000000000000000000000000000000"
POISON="0x02994e830bd997a6000000000000000000000000000000000000000000000000"
BLIND="0xd2812fe9b0b2cad2000000000000000000000000000000000000000000000000"
STUPIFY="0x54a7e38986f19669000000000000000000000000000000000000000000000000"
PETRIFY="0x056c2744282a177f000000000000000000000000000000000000000000000000"
PETRIGAZE="0x667ea11c140dca69000000000000000000000000000000000000000000000000"

echo "=== Fixing BalancePatchV3 WeaponStats ==="

# Token 76: Trollhide Cleaver — agi=3 int=0 hp=5 max=9 min=6 lvl=0 str=3
set_weapon 76 3 0 5 9 6 0 3 "Trollhide Cleaver" "$PHYS" "$WEAKEN"

# Token 77: Phasefang — agi=4 int=3 hp=5 max=8 min=4 lvl=0 str=0
set_weapon 77 4 3 5 8 4 0 0 "Phasefang" "$MAGIC" "$POISON" "$BLIND"

# Token 78: Drakescale Staff — agi=0 int=3 hp=5 max=8 min=5 lvl=0 str=2
set_weapon 78 0 3 5 8 5 0 2 "Drakescale Staff" "$MAGIC" "$STUPIFY"

# Token 79: Dire Rat Bite — agi=0 int=0 hp=0 max=4 min=2 lvl=0 str=0
set_weapon 79 0 0 0 4 2 0 0 "Dire Rat Bite" "$PHYS" "$POISON"

# Token 80: Basilisk Fang — agi=0 int=0 hp=0 max=5 min=3 lvl=0 str=0
set_weapon 80 0 0 0 5 3 0 0 "Basilisk Fang" "$PHYS" "$PETRIFY"

# Token 81: Basilisk Gaze — agi=0 int=0 hp=0 max=14 min=8 lvl=0 str=0
set_weapon 81 0 0 0 14 8 0 0 "Basilisk Gaze" "$MAGIC" "$PETRIGAZE"

echo ""
echo "=== Fixing Drake's Cowl ArmorStats ==="
# Token 82: Drake's Cowl — agi=0 armor=6 hp=0 int=5 minlvl=1 str=0 type=Cloth(1)
AS_TABLE_ID=$(grep "ResourceId constant _tableId" src/codegen/tables/ArmorStats.sol | sed 's/.*wrap(\(0x[0-9a-fA-F]*\)).*/\1/')
KEY82=$(cast --to-bytes32 82)
# ArmorStats: int256 agi, int256 armor, int256 hp, int256 int, uint256 minLevel, int256 str, uint8 armorType
# Static = 6*32 + 1 = 193 bytes, no dynamic fields
STATIC82="0x$(cast abi-encode "f(int256,int256,int256,int256,uint256,int256)" 0 6 0 5 1 0 | cut -c3-)01"
# encodedLengths = 0 (no dynamic fields)
ENC_LEN_ZERO="0x0000000000000000000000000000000000000000000000000000000000000000"

echo "Setting ArmorStats for token 82 (Drake's Cowl)..."
cast send "$WORLD" \
    "setRecord(bytes32,bytes32[],bytes,bytes32,bytes)" \
    "$AS_TABLE_ID" \
    "[$KEY82]" \
    "$STATIC82" \
    "$ENC_LEN_ZERO" \
    "0x" \
    --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" 2>&1
echo "  Done: Drake's Cowl"

echo ""
echo "=== Verifying ==="
for ID in 76 77 78 79 80 81; do
    KEY=$(cast --to-bytes32 $ID)
    DYN=$(cast call "$WORLD" "getDynamicField(bytes32,bytes32[],uint8)(bytes)" "$WS_TABLE" "[$KEY]" 0 --rpc-url "$RPC_URL" 2>&1)
    if [ "$DYN" = "0x" ]; then
        echo "  Token $ID: STILL EMPTY"
    else
        echo "  Token $ID: effects written (${#DYN} hex chars)"
    fi
done

echo "All done."
