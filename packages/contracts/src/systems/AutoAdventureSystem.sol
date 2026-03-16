// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {IWorld} from "@world/IWorld.sol";
import {
    Characters,
    CharacterEquipment,
    CombatEncounter,
    CombatEncounterData,
    EncounterEntity,
    EntitiesAtPosition,
    MapConfig,
    Position,
    SessionTimer,
    Spawned,
    Stats,
    AutoAdventureCooldown
} from "../codegen/index.sol";
import {EncounterType} from "@codegen/common.sol";
import {Action} from "@interfaces/Structs.sol";
import {DEFAULT_MAX_TURNS} from "../../constants.sol";
import {UserDelegationControl} from "@latticexyz/world/src/codegen/tables/UserDelegationControl.sol";
import {OnlyCharacters, Unauthorized, NotSpawned, InEncounter, OutOfBounds, InvalidMove, EntityNotAtPosition, NoWeaponsEquipped} from "../Errors.sol";
import {PauseLib} from "../libraries/PauseLib.sol";

/// @title AutoAdventureSystem
/// @notice Single-tx move + combat for grind mode. Delegates combat to existing PvESystem
///         so all MUD table writes (ActionOutcome, CombatOutcome, etc.) happen through the
///         same code path as manual combat. Receipt log decoding works unchanged.
contract AutoAdventureSystem is System {
    uint256 constant AUTO_ADVENTURE_COOLDOWN = 5;
    uint256 constant MAX_AUTO_COMBAT_ROUNDS = 15;

    error AutoAdventureCooldownActive();

    function autoAdventure(bytes32 cid, uint16 x, uint16 y)
        public
        returns (bool combatOccurred, bool playerWon, bool playerDied, uint256 xpGained, uint256 goldGained, bytes32 encounterId)
    {
        PauseLib.requireNotPaused();

        // Validate
        address owner = Characters.getOwner(cid);
        if (!IWorld(_world()).UD__isValidCharacterId(cid)) revert OnlyCharacters();
        if (_msgSender() != owner) {
            ResourceId did = UserDelegationControl.getDelegationControlId(owner, _msgSender());
            if (ResourceId.unwrap(did) == bytes32(0)) revert Unauthorized();
        }
        if (!Spawned.getSpawned(cid)) revert NotSpawned();
        if (EncounterEntity.getEncounterId(cid) != bytes32(0)) revert InEncounter();

        // Cooldown
        uint256 lt = AutoAdventureCooldown.getLastTime(cid);
        if (lt != 0 && block.timestamp < lt + AUTO_ADVENTURE_COOLDOWN) revert AutoAdventureCooldownActive();
        AutoAdventureCooldown.setLastTime(cid, block.timestamp);

        // Move (inlined — can't delegate because SystemSwitch changes _msgSender)
        {
            (uint16 cx, uint16 cy) = Position.get(cid);
            (uint16 h, uint16 w) = MapConfig.get();
            if (x >= w) revert OutOfBounds();
            if (y >= h) revert OutOfBounds();
            uint16 dx = cx > x ? cx - x : x - cx;
            uint16 dy = cy > y ? cy - y : y - cy;
            if (dx + dy != 1) revert InvalidMove();

            bytes32[] memory old = EntitiesAtPosition.getEntities(cx, cy);
            bool found;
            for (uint256 i; i < old.length; i++) {
                if (old[i] == cid) {
                    found = true;
                    EntitiesAtPosition.updateEntities(cx, cy, i, old[old.length - 1]);
                    EntitiesAtPosition.popEntities(cx, cy);
                    break;
                }
            }
            if (!found) revert EntityNotAtPosition();
            SessionTimer.set(cid, block.timestamp);
            Position.set(cid, x, y);
            EntitiesAtPosition.pushEntities(x, y, cid);
        }

        // Spawn mobs
        IWorld(_world()).UD__spawnOnTileEnter(x, y);

        // Find first living mob
        bytes32 mid;
        {
            bytes32[] memory ents = EntitiesAtPosition.getEntities(x, y);
            for (uint256 i; i < ents.length; i++) {
                if (ents[i] != cid && !IWorld(_world()).UD__isValidCharacterId(ents[i])) {
                    if (Stats.getCurrentHp(ents[i]) > 0 && Spawned.getSpawned(ents[i])) {
                        mid = ents[i];
                        break;
                    }
                }
            }
        }
        if (mid == bytes32(0)) return (false, false, false, 0, 0, bytes32(0));

        // Weapons check
        uint256 pw;
        {
            uint256 wc = CharacterEquipment.lengthEquippedWeapons(cid);
            uint256 sc = CharacterEquipment.lengthEquippedSpells(cid);
            if (wc + sc == 0) revert NoWeaponsEquipped();
            pw = wc > 0 ? CharacterEquipment.getItemEquippedWeapons(cid, 0) : CharacterEquipment.getItemEquippedSpells(cid, 0);
        }

        // Create encounter (same logic as EncounterSystem.createEncounter for PvE)
        combatOccurred = true;
        bytes32[] memory players = new bytes32[](1);
        players[0] = cid;
        bytes32[] memory mobs = new bytes32[](1);
        mobs[0] = mid;

        bytes32[] memory attackers;
        bytes32[] memory defenders;
        bool attackersAreMobs;
        if (Stats.getAgility(mid) > Stats.getAgility(cid)) {
            attackers = mobs; defenders = players; attackersAreMobs = true;
        } else {
            attackers = players; defenders = mobs;
        }

        encounterId = keccak256(abi.encode(EncounterType.PvE, attackers, defenders, block.timestamp));
        CombatEncounter.set(encounterId, CombatEncounterData({
            encounterType: EncounterType.PvE, start: block.timestamp, end: 0,
            rewardsDistributed: false, currentTurn: 1, currentTurnTimer: block.timestamp,
            maxTurns: DEFAULT_MAX_TURNS, attackersAreMobs: attackersAreMobs,
            defenders: defenders, attackers: attackers
        }));
        EncounterEntity.setEncounterId(cid, encounterId);
        EncounterEntity.setEncounterId(mid, encounterId);

        // Execute combat via existing PvESystem — it handles the full turn loop,
        // ActionOutcome writes, encounter end check, reward distribution, and cleanup.
        // This reuses the exact same code path as manual endTurn → RngSystem → PvESystem.
        {
            Action[] memory actions = new Action[](1);
            actions[0] = Action({attackerEntityId: cid, defenderEntityId: mid, itemId: pw});
            uint256 rng = uint256(keccak256(abi.encode(block.prevrandao, cid, block.timestamp)));

            // Run combat rounds until resolved
            for (uint256 r; r < MAX_AUTO_COMBAT_ROUNDS; r++) {
                if (CombatEncounter.getEnd(encounterId) != 0) break;
                // executePvECombat does: attacker turn → check end → defender turn → check end
                // It calls endEncounter internally when someone dies.
                IWorld(_world()).UD__executePvECombat(rng, encounterId, actions);
                rng = uint256(keccak256(abi.encode(rng, r)));
            }

            // Safety net: if combat didn't resolve within MAX_AUTO_COMBAT_ROUNDS,
            // force-end the encounter so the character doesn't get stuck.
            if (CombatEncounter.getEnd(encounterId) == 0) {
                // Treat unresolved combat as a draw — player doesn't win or die,
                // no rewards. Just clean up the encounter state.
                IWorld(_world()).UD__endEncounter(encounterId, rng, false);
            }
        }

        // Read results
        playerDied = EncounterEntity.getDied(cid);
        playerWon = !playerDied;
        if (playerDied) Spawned.set(cid, false);

        // xpGained/goldGained are in CombatOutcome (written by endEncounter → distributePveRewards)
        // Return 0 here — client reads from CombatOutcome table via receipt decoding
    }
}
