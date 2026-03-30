// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {IWorld} from "@world/IWorld.sol";
import {
    Characters,
    CharacterEquipment,
    CharacterZone,
    CombatEncounter,
    CombatEncounterData,
    EncounterEntity,
    ZoneEntitiesAtPos,
    PositionV2,
    SessionTimer,
    Spawned,
    Stats,
    AutoAdventureCooldown,
    Counters,
    WorldBossV2,
    ZoneMapConfig
} from "../codegen/index.sol";
import {EncounterType} from "@codegen/common.sol";
import {Action} from "@interfaces/Structs.sol";
import {DEFAULT_MAX_TURNS, ZONE_WINDY_PEAKS, WIND_GUST_EFFECT_ID, PEAK_RIDGE_RELATIVE_Y, WORLD_BOSS_COUNTER_ID} from "../../constants.sol";
import {UserDelegationControl} from "@latticexyz/world/src/codegen/tables/UserDelegationControl.sol";
import {OnlyCharacters, Unauthorized, NotSpawned, InEncounter, OutOfBounds, InvalidMove, EntityNotAtPosition, NoWeaponsEquipped, InvalidCombatEntity} from "../Errors.sol";
import {PauseLib} from "../libraries/PauseLib.sol";

/// @title AutoAdventureSystem
/// @notice Single-tx move + combat for auto adventure. Delegates combat to existing PvESystem
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
        uint256 zoneId;
        {
            uint16 cx; uint16 cy;
            (zoneId, cx, cy) = PositionV2.get(cid);
            uint16 zoneWidth = ZoneMapConfig.getWidth(zoneId);
            uint16 zoneHeight = ZoneMapConfig.getHeight(zoneId);
            if (zoneWidth > 0) {
                if (x >= zoneWidth) revert OutOfBounds();
                if (y >= zoneHeight) revert OutOfBounds();
            }
            uint16 dx = cx > x ? cx - x : x - cx;
            uint16 dy = cy > y ? cy - y : y - cy;
            if (dx + dy != 1) revert InvalidMove();

            bytes32[] memory old = ZoneEntitiesAtPos.getEntities(zoneId, cx, cy);
            bool found;
            for (uint256 i; i < old.length; i++) {
                if (old[i] == cid) {
                    found = true;
                    ZoneEntitiesAtPos.updateEntities(zoneId, cx, cy, i, old[old.length - 1]);
                    ZoneEntitiesAtPos.popEntities(zoneId, cx, cy);
                    break;
                }
            }
            if (!found) revert EntityNotAtPosition();
            SessionTimer.set(cid, block.timestamp);
            PositionV2.set(cid, zoneId, x, y);
            ZoneEntitiesAtPos.pushEntities(zoneId, x, y, cid);
        }

        // Spawn mobs
        IWorld(_world()).UD__spawnOnTileEnter(zoneId, x, y);

        // Find first living mob
        bytes32 mid;
        {
            bytes32[] memory ents = ZoneEntitiesAtPos.getEntities(zoneId, x, y);
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

        // Apply wind gust environmental effect on Windy Peaks peak ridge
        if (_isPeakTile(zoneId, y)) {
            bool isBoss = _isWorldBossFight(players, mobs);
            _applyWindGust(players, isBoss);
            _applyWindGust(mobs, isBoss);
        }

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

    /// @notice Single-tx targeted combat for auto adventure mode. No movement — player clicks a
    ///         specific monster on their current tile and the entire fight resolves in one tx.
    ///         No cooldown — gas cost is the natural rate limiter for rapid farming.
    function autoFight(bytes32 cid, bytes32 monsterId, uint256 weaponId)
        public
        returns (bool playerWon, bool playerDied, bytes32 encounterId)
    {
        PauseLib.requireNotPaused();

        // Validate character
        address owner = Characters.getOwner(cid);
        if (!IWorld(_world()).UD__isValidCharacterId(cid)) revert OnlyCharacters();
        if (_msgSender() != owner) {
            ResourceId did = UserDelegationControl.getDelegationControlId(owner, _msgSender());
            if (ResourceId.unwrap(did) == bytes32(0)) revert Unauthorized();
        }
        if (!Spawned.getSpawned(cid)) revert NotSpawned();
        if (EncounterEntity.getEncounterId(cid) != bytes32(0)) revert InEncounter();

        // Validate monster: same tile, is a mob, alive
        (uint256 fightZoneId, uint16 cx, uint16 cy) = PositionV2.get(cid);
        (, uint16 mx, uint16 my) = PositionV2.get(monsterId);
        if (cx != mx || cy != my) revert EntityNotAtPosition();
        if (IWorld(_world()).UD__isValidCharacterId(monsterId)) revert InvalidCombatEntity();
        if (Stats.getCurrentHp(monsterId) <= 0 || !Spawned.getSpawned(monsterId)) revert InvalidCombatEntity();

        // Update session timer (prevents idle timeout during auto adventure)
        SessionTimer.set(cid, block.timestamp);

        // Validate weapon is equipped (in weapons or spells slots)
        uint256 pw = weaponId;
        {
            bool found;
            uint256 wc = CharacterEquipment.lengthEquippedWeapons(cid);
            for (uint256 i; i < wc; i++) {
                if (CharacterEquipment.getItemEquippedWeapons(cid, i) == weaponId) { found = true; break; }
            }
            if (!found) {
                uint256 sc = CharacterEquipment.lengthEquippedSpells(cid);
                for (uint256 i; i < sc; i++) {
                    if (CharacterEquipment.getItemEquippedSpells(cid, i) == weaponId) { found = true; break; }
                }
            }
            if (!found) revert NoWeaponsEquipped();
        }

        // Create encounter
        bytes32[] memory players = new bytes32[](1);
        players[0] = cid;
        bytes32[] memory mobs = new bytes32[](1);
        mobs[0] = monsterId;

        bytes32[] memory attackers;
        bytes32[] memory defenders;
        bool attackersAreMobs;
        if (Stats.getAgility(monsterId) > Stats.getAgility(cid)) {
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
        EncounterEntity.setEncounterId(monsterId, encounterId);

        // Apply wind gust environmental effect on Windy Peaks peak ridge
        if (_isPeakTile(fightZoneId, cy)) {
            bool isBoss = _isWorldBossFight(players, mobs);
            _applyWindGust(players, isBoss);
            _applyWindGust(mobs, isBoss);
        }

        // Execute combat loop — same path as autoAdventure
        {
            Action[] memory actions = new Action[](1);
            actions[0] = Action({attackerEntityId: cid, defenderEntityId: monsterId, itemId: pw});
            uint256 rng = uint256(keccak256(abi.encode(block.prevrandao, cid, block.timestamp)));

            for (uint256 r; r < MAX_AUTO_COMBAT_ROUNDS; r++) {
                if (CombatEncounter.getEnd(encounterId) != 0) break;
                IWorld(_world()).UD__executePvECombat(rng, encounterId, actions);
                rng = uint256(keccak256(abi.encode(rng, r)));
            }

            if (CombatEncounter.getEnd(encounterId) == 0) {
                IWorld(_world()).UD__endEncounter(encounterId, rng, false);
            }
        }

        // Read results
        playerDied = EncounterEntity.getDied(cid);
        playerWon = !playerDied;
        if (playerDied) Spawned.set(cid, false);
    }

    // ---- Wind Gust environmental effect helpers ----

    function _isPeakTile(uint256 zoneId, uint16 y) internal pure returns (bool) {
        return zoneId == ZONE_WINDY_PEAKS && y >= PEAK_RIDGE_RELATIVE_Y;
    }

    function _isWorldBossFight(bytes32[] memory group1, bytes32[] memory group2) internal view returns (bool) {
        uint256 totalBosses = Counters.getCounter(_world(), WORLD_BOSS_COUNTER_ID);
        for (uint256 i = 1; i <= totalBosses; i++) {
            bytes32 bossEntityId = WorldBossV2.getEntityId(i);
            if (bossEntityId == bytes32(0)) continue;
            for (uint256 j; j < group1.length; j++) {
                if (group1[j] == bossEntityId) return true;
            }
            for (uint256 j; j < group2.length; j++) {
                if (group2[j] == bossEntityId) return true;
            }
        }
        return false;
    }

    function _applyWindGust(bytes32[] memory entities, bool isBossFight) internal {
        for (uint256 i; i < entities.length; i++) {
            IWorld(_world()).UD__applyStatusEffect(entities[i], WIND_GUST_EFFECT_ID);
            if (isBossFight) {
                IWorld(_world()).UD__applyStatusEffect(entities[i], WIND_GUST_EFFECT_ID);
            }
        }
    }
}
