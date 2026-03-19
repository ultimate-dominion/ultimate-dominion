#!/bin/bash
# Fix Phasefang (token 77) effects array in WeaponStats table.
#
# Root cause: BalancePatchV3 deployment wrote corrupted effect IDs for Phasefang.
#   - effects[0] is MagicDamage (0xeee09063) instead of PhysicalDamage (0xbeeab8b0)
#   - effects[1] is orphan ID (0xfa5efa09, effectExists=false) instead of poison_dot (0x02994e83)
#   - effects[2] is correct (blind, 0xd2812fe9)
#
# The previous fix script (fix-v3-weapon-stats.sh) used `cast --to-bytes32` which
# encodes as left-aligned bytes, not right-aligned uint256. MUD keys use
# bytes32(uint256(itemId)), so that script wrote to wrong storage slots.
#
# This script uses cast abi-encode for correct key encoding and setDynamicField
# to overwrite only the effects array (dynamic field index 0), preserving static data.

set -euo pipefail
cd "$(dirname "$0")/../.."
source .env.mainnet

WORLD="0x99d01939F58B965E6E84a1D167E710Abdf5764b0"
WS_TABLE="0x74625544000000000000000000000000576561706f6e53746174730000000000"

# Correct effect IDs
PHYS="0xbeeab8b096ac11af000000000000000000000000000000000000000000000000"
POISON_DOT="0x02994e830bd997a6000000000000000000000000000000000000000000000000"
BLIND="0xd2812fe9b0b2cad2000000000000000000000000000000000000000000000000"

# MUD key for token 77: bytes32(uint256(77)) — right-aligned, NOT cast --to-bytes32
KEY77=$(cast abi-encode "f(uint256)" 77)

# Encode effects as tightly packed bytes32[] (3 x 32 bytes = 96 bytes)
EFFECTS="0x${PHYS:2}${POISON_DOT:2}${BLIND:2}"

echo "=== Fix Phasefang (token 77) effects ==="
echo "Key:     $KEY77"
echo "Effects: PHYS + poison_dot + blind"
echo ""

echo "--- Pre-fix verification ---"
echo "Current effects:"
cast call "$WORLD" "UD__getItemEffects(uint256)(bytes32[])" 77 --rpc-url "$RPC_URL"
echo ""

echo "Sending setDynamicField..."
cast send "$WORLD" \
    "setDynamicField(bytes32,bytes32[],uint8,bytes)" \
    "$WS_TABLE" \
    "[$KEY77]" \
    0 \
    "$EFFECTS" \
    --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" 2>&1
echo ""

echo "--- Post-fix verification ---"
echo "Updated effects:"
cast call "$WORLD" "UD__getItemEffects(uint256)(bytes32[])" 77 --rpc-url "$RPC_URL"

echo ""
echo "Verifying each effect exists in Effects table..."
for label_id in "PHYS:$PHYS" "poison_dot:$POISON_DOT" "blind:$BLIND"; do
    label="${label_id%%:*}"
    eid="${label_id#*:}"
    EXISTS=$(cast call "$WORLD" "UD__checkItemEffect(uint256,bytes32)(bool)" 77 "$eid" --rpc-url "$RPC_URL" 2>&1)
    echo "  $label ($eid): checkItemEffect=$EXISTS"
done

echo ""
echo "Done. Phasefang should now work in combat."
