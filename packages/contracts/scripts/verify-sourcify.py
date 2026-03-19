#!/usr/bin/env python3
"""
Verify all Ultimate Dominion system contracts on Sourcify.
Runs automatically after deploy. Sourcify verifications appear on Basescan.

Usage:
  cd packages/contracts
  python3 scripts/verify-sourcify.py

Env vars (set by sourcing .env.mainnet or .env.testnet):
  WORLD_ADDRESS  — deployed world address
  RPC_URL        — RPC endpoint
  ETHERSCAN_API_KEY — for forge standard JSON generation
"""

import json
import subprocess
import os
import sys
import time

CHAIN_ID = "8453"
COMPILER_VERSION = "v0.8.24+commit.e11b9ed9"
SOURCIFY_API = "https://sourcify.dev/server/v2/verify"

# Script directory (packages/contracts/scripts/)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONTRACTS_DIR = os.path.dirname(SCRIPT_DIR)  # packages/contracts/
CLIENT_DIR = os.path.join(CONTRACTS_DIR, "..", "client")  # packages/client/

# Contract name -> (registered MUD name, source path)
CONTRACTS = {
    "EquipmentCore": ("EquipmentCore", "src/systems/equipment/EquipmentCore.sol"),
    "CharacterCore": ("CharacterCore", "src/systems/character/CharacterCore.sol"),
    "CharacterEnterSystem": ("CharEnterSys", "src/systems/character/CharacterEnterSystem.sol"),
    "StatSystem": ("StatSystem", "src/systems/character/StatSystem.sol"),
    "LevelSystem": ("LevelSystem", "src/systems/character/LevelSystem.sol"),
    "ImplicitClassSystem": ("ImplicitClassSys", "src/systems/ImplicitClassSystem.sol"),
    "WeaponSystem": ("WeaponSystem", "src/systems/equipment/WeaponSystem.sol"),
    "ArmorSystem": ("ArmorSystem", "src/systems/equipment/ArmorSystem.sol"),
    "ConsumableSystem": ("ConsumableSystem", "src/systems/equipment/ConsumableSystem.sol"),
    "AccessorySystem": ("AccessorySystem", "src/systems/equipment/AccessorySystem.sol"),
    "PhysicalCombat": ("PhysicalCombat", "src/systems/combat/PhysicalCombat.sol"),
    "MagicCombat": ("MagicCombat", "src/systems/combat/MagicCombat.sol"),
    "StatusEffects": ("StatusEffects", "src/systems/combat/StatusEffects.sol"),
    "WorldActionSystem": ("WorldActionSys", "src/systems/WorldActionSystem.sol"),
    "FragmentSystem": ("FragmentSystem", "src/systems/FragmentSystem.sol"),
    "FragmentCombatSystem": ("FragCombatSys", "src/systems/FragmentCombatSystem.sol"),
    "AdminShopSystem": ("AdminShopSys", "src/systems/AdminShopSystem.sol"),
    "PvpRewardSystem": ("PvpRewardSystem", "src/systems/PvpRewardSystem.sol"),
    "MapSpawnSystem": ("MapSpawnSystem", "src/systems/MapSpawnSystem.sol"),
    "ItemCreationSystem": ("ItemCreationSys", "src/systems/ItemCreationSystem.sol"),
    "EffectDataSystem": ("EffectDataSys", "src/systems/EffectDataSystem.sol"),
    "PveRewardSystem": ("PveRewardSystem", "src/systems/PveRewardSystem.sol"),
    "PauseSystem": ("PauseSystem", "src/systems/PauseSystem.sol"),
    "AdminSystem": ("AdminSystem", "src/systems/AdminSystem.sol"),
    "AdminEntitySystem": ("AdminEntSys", "src/systems/AdminEntitySystem.sol"),
    "AdminContentSystem": ("AdminContSys", "src/systems/AdminContentSystem.sol"),
    "AdminTuningSystem": ("AdminTuningSys", "src/systems/AdminTuningSystem.sol"),
    "UltimateDominionConfigSystem": ("UDConfigSys", "src/systems/UltimateDominionConfigSystem.sol"),
    "MapSystem": ("MapSystem", "src/systems/MapSystem.sol"),
    "MapRemovalSystem": ("MapRemovalSys", "src/systems/MapRemovalSystem.sol"),
    "ShopSystem": ("ShopSystem", "src/systems/ShopSystem.sol"),
    "MarketplaceSystem": ("MarketplaceSys", "src/systems/MarketplaceSystem.sol"),
    "EncounterSystem": ("EncounterSys", "src/systems/EncounterSystem.sol"),
    "EncounterResolveSystem": ("EncounterResSys", "src/systems/EncounterResolveSystem.sol"),
    "EquipmentSystem": ("EquipmentSystem", "src/systems/EquipmentSystem.sol"),
    "PvPSystem": ("PvPSystem", "src/systems/PvPSystem.sol"),
    "PvESystem": ("PvESystem", "src/systems/PvESystem.sol"),
    "CombatSystem": ("CombatSystem", "src/systems/CombatSystem.sol"),
    "LootManagerSystem": ("LootManagerSyste", "src/systems/LootManagerSystem.sol"),
    "MobSystem": ("MobSystem", "src/systems/MobSystem.sol"),
    "ItemsSystem": ("ItemsSystem", "src/systems/ItemsSystem.sol"),
    "EffectsSystem": ("EffectsSystem", "src/systems/EffectsSystem.sol"),
    "UtilsSystem": ("UtilsSystem", "src/systems/UtilsSystem.sol"),
    "GasStationSystem": ("GasStationSys", "src/systems/GasStationSystem.sol"),
}


def get_system_addresses(world_address: str, rpc_url: str) -> dict[str, str]:
    """Query all system addresses from MUD world."""
    systems_json = json.dumps({name: reg for name, (reg, _) in CONTRACTS.items()})
    script = f"""
    import {{ resourceToHex }} from '@latticexyz/common';
    import {{ createPublicClient, http }} from 'viem';
    import {{ base }} from 'viem/chains';

    const WORLD = '{world_address}';
    const client = createPublicClient({{ chain: base, transport: http('{rpc_url}') }});
    const tableId = resourceToHex({{ type: 'table', namespace: 'world', name: 'Systems' }});
    const abi = [{{
      name: 'getRecord', type: 'function', stateMutability: 'view',
      inputs: [{{ name: 'tableId', type: 'bytes32' }}, {{ name: 'keyTuple', type: 'bytes32[]' }}],
      outputs: [{{ name: 'staticData', type: 'bytes' }}, {{ name: 'encodedLengths', type: 'bytes32' }}, {{ name: 'dynamicData', type: 'bytes' }}]
    }}];

    const systems = {systems_json};
    const results = {{}};
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    for (const [contractName, regName] of Object.entries(systems)) {{
      const sysId = resourceToHex({{ type: 'system', namespace: 'UD', name: regName }});
      try {{
        const data = await client.readContract({{
          address: WORLD, abi, functionName: 'getRecord',
          args: [tableId, [sysId]]
        }});
        const [staticData] = data;
        if (staticData && staticData !== '0x') {{
          results[contractName] = '0x' + staticData.slice(2, 42);
        }}
      }} catch(e) {{
        console.error('Error querying ' + contractName + ': ' + e.message?.slice(0, 80));
      }}
      await sleep(100);
    }}
    console.log(JSON.stringify(results));
    """

    result = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        capture_output=True, text=True, timeout=120,
        cwd=CLIENT_DIR
    )
    if result.returncode != 0:
        print(f"Error querying addresses: {result.stderr[:500]}", file=sys.stderr)
        sys.exit(1)

    for line in reversed(result.stdout.strip().split('\n')):
        try:
            return json.loads(line)
        except json.JSONDecodeError:
            continue
    print("Failed to parse address query output", file=sys.stderr)
    sys.exit(1)


def get_needed_sources(contract_name: str, source_path: str) -> set[str] | None:
    """Get the set of source files actually needed by a contract from its compilation artifact."""
    # source_path like "src/systems/equipment/EquipmentCore.sol"
    # artifact at "out/EquipmentCore.sol/EquipmentCore.json"
    artifact_dir = os.path.basename(source_path)  # EquipmentCore.sol
    artifact_path = os.path.join(CONTRACTS_DIR, "out", artifact_dir, f"{contract_name}.json")

    try:
        with open(artifact_path) as f:
            artifact = json.load(f)
        metadata = json.loads(artifact["rawMetadata"])
        return set(metadata["sources"].keys())
    except (FileNotFoundError, KeyError, json.JSONDecodeError) as e:
        print(f"(artifact error: {e}) ", end="", flush=True)
        return None


def generate_standard_json(source_path: str, contract_name: str, address: str) -> dict | None:
    """Generate standard JSON input via forge, trimmed to only needed sources.

    The via_ir pipeline produces different bytecode when extra source files are
    present (Sourcify extra_file_input_bug). We trim the standard JSON to only
    include files the contract actually depends on.
    """
    env = {**os.environ}
    if 'ETHERSCAN_API_KEY' not in env:
        env['ETHERSCAN_API_KEY'] = 'dummy'

    contract_identifier = f"{source_path}:{contract_name}"
    result = subprocess.run(
        ["forge", "verify-contract", "--show-standard-json-input",
         "--rpc-url", "https://mainnet.base.org",
         address, contract_identifier],
        capture_output=True, text=True, timeout=60, env=env,
        cwd=CONTRACTS_DIR
    )

    output = result.stdout
    if not output:
        return None

    # Forge mixes ANSI log lines into stdout before the JSON.
    json_start = output.find('{')
    if json_start == -1:
        return None

    try:
        std_json = json.loads(output[json_start:])
    except json.JSONDecodeError:
        return None

    # Trim sources to only those needed by this contract
    needed = get_needed_sources(contract_name, source_path)
    if needed and "sources" in std_json:
        original_count = len(std_json["sources"])
        std_json["sources"] = {
            k: v for k, v in std_json["sources"].items() if k in needed
        }
        trimmed_count = len(std_json["sources"])
        print(f"({trimmed_count}/{original_count} sources) ", end="", flush=True)

    return std_json


def submit_to_sourcify(address: str, contract_identifier: str, std_json: dict) -> dict:
    """Submit a contract to Sourcify for verification."""
    payload = json.dumps({
        "stdJsonInput": std_json,
        "compilerVersion": COMPILER_VERSION,
        "contractIdentifier": contract_identifier,
    })

    result = subprocess.run(
        ["curl", "-s", "-w", "\n%{http_code}", "-X", "POST",
         f"{SOURCIFY_API}/{CHAIN_ID}/{address}",
         "-H", "Content-Type: application/json",
         "-d", "@-"],
        input=payload, capture_output=True, text=True, timeout=120
    )

    lines = result.stdout.strip().split('\n')
    http_code = int(lines[-1])
    body = '\n'.join(lines[:-1])

    try:
        response = json.loads(body)
    except json.JSONDecodeError:
        response = {"error": body[:200]}

    return {"http_code": http_code, **response}


def poll_verification(verification_id: str, max_wait: int = 120) -> dict:
    """Poll Sourcify for verification completion."""
    start = time.time()
    while time.time() - start < max_wait:
        time.sleep(10)
        result = subprocess.run(
            ["curl", "-s", "--max-time", "30", f"{SOURCIFY_API}/{verification_id}"],
            capture_output=True, text=True, timeout=45
        )
        try:
            status = json.loads(result.stdout)
            if status.get("isJobCompleted"):
                return status
        except json.JSONDecodeError:
            pass
    return {"error": "timeout"}


def classify_result(response: dict, name: str, results: dict) -> None:
    """Classify a Sourcify submission response."""
    if response.get("http_code") == 202:
        vid = response.get("verificationId")
        print(f"queued ({vid[:8]}...)", flush=True)

        status = poll_verification(vid)
        contract_info = status.get("contract", {})
        match = contract_info.get("runtimeMatch") or contract_info.get("match")
        error = status.get("error", {})

        if match:
            print(f"    -> VERIFIED ({match})")
            results["verified"].append(name)
        elif isinstance(error, dict) and error.get("customCode") == "already_verified":
            print(f"    -> already verified")
            results["already_verified"].append(name)
        else:
            msg = error.get("message", str(error))[:120] if isinstance(error, dict) else str(error)[:120]
            print(f"    -> FAILED: {msg}")
            results["failed"].append(name)
    elif response.get("http_code") == 200:
        print("already verified")
        results["already_verified"].append(name)
    else:
        error = response.get("error") or response.get("message", "unknown error")
        if isinstance(error, dict):
            error = error.get("message", str(error))
        if "already_verified" in str(error):
            print("already verified")
            results["already_verified"].append(name)
        else:
            print(f"ERROR (HTTP {response.get('http_code')}): {str(error)[:120]}")
            results["errors"].append(name)


def main():
    world_address = os.environ.get("WORLD_ADDRESS")
    rpc_url = os.environ.get("RPC_URL", "https://mainnet.base.org")

    if not world_address:
        print("Error: WORLD_ADDRESS env var required", file=sys.stderr)
        sys.exit(1)

    print(f"Verifying contracts for world {world_address}")
    print(f"Querying system addresses...", flush=True)
    addresses = get_system_addresses(world_address, rpc_url)
    print(f"Found {len(addresses)} deployed systems\n")

    results = {"verified": [], "already_verified": [], "failed": [], "errors": []}

    for name, (reg_name, source_path) in CONTRACTS.items():
        address = addresses.get(name)
        if not address:
            print(f"  SKIP {name}: not deployed")
            results["errors"].append(name)
            continue

        contract_identifier = f"{source_path}:{name}"
        print(f"  {name} ({address[:10]}...): ", end="", flush=True)

        print("json...", end=" ", flush=True)
        std_json = generate_standard_json(source_path, name, address)
        if not std_json:
            print("FAILED (forge error)")
            results["errors"].append(name)
            continue

        print("submit...", end=" ", flush=True)
        response = submit_to_sourcify(address, contract_identifier, std_json)
        classify_result(response, name, results)

        time.sleep(2)

    # Summary
    total = len(results["verified"]) + len(results["already_verified"])
    print(f"\n{'='*50}")
    print(f"SOURCIFY VERIFICATION COMPLETE")
    print(f"{'='*50}")
    print(f"Verified:         {len(results['verified'])} (new)")
    print(f"Already verified: {len(results['already_verified'])}")
    print(f"Total verified:   {total}/{len(CONTRACTS)}")
    if results["failed"]:
        print(f"Failed:           {len(results['failed'])} — {', '.join(results['failed'])}")
    if results["errors"]:
        print(f"Errors:           {len(results['errors'])} — {', '.join(results['errors'])}")

    if total == len(CONTRACTS):
        print("\nAll contracts verified!")
    return 0 if total == len(CONTRACTS) else 1


if __name__ == "__main__":
    sys.exit(main())
