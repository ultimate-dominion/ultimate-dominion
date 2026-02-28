// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {SystemSwitch} from "@latticexyz/world-modules/src/utils/SystemSwitch.sol";
import {IWorld} from "@world/IWorld.sol";
import {
    EncounterEntity,
    EncounterEntityData,
    Stats,
    CombatEncounter,
    CombatEncounterData,
    Position,
    SessionTimer,
    WorldEncounter,
    WorldEncounterData
} from "@codegen/index.sol";
import {RngRequestType, EncounterType} from "@codegen/common.sol";
import {Action} from "@interfaces/Structs.sol";
import {IRngSystem} from "../interfaces/IRngSystem.sol";
import {DEFAULT_MAX_TURNS, MAX_PARTY_SIZE} from "../../constants.sol";
import {Unauthorized, InvalidPvE, InvalidPvP, InvalidEncounter, ExpiredEncounter, NonCombatant, CannotEndTurn, NotCombatEncounter, InvalidEncounterType, InvalidWorldLocation, InvalidShopEncounter, AlreadyInEncounter, InvalidCombatEntity, InvalidGroupSize, CombatantHpZero} from "../Errors.sol";
import {PauseLib} from "../libraries/PauseLib.sol";

contract EncounterSystem is System {
    function createEncounter(EncounterType encounterType, bytes32[] calldata group1, bytes32[] calldata group2)
        external
        returns (bytes32 encounterId)
    {
        PauseLib.requireNotPaused();
        if (group1.length == 0 || group1.length > MAX_PARTY_SIZE) revert InvalidGroupSize();
        if (group2.length == 0 || group2.length > MAX_PARTY_SIZE) revert InvalidGroupSize();
        if (!IWorld(_world()).UD__isParticipant(_msgSender(), group1)
                && !IWorld(_world()).UD__isParticipant(_msgSender(), group2)) {
            revert Unauthorized();
        }
        (uint16 x, uint16 y) = Position.get(group1[0]);

        if (encounterType == EncounterType.PvE || encounterType == EncounterType.PvP) {
            (bytes32[] memory attackers, bytes32[] memory defenders) = _orderGroupsByAgi(group1, group2);

            bool attackersAreMobs;
            if (encounterType == EncounterType.PvE) {
                bool isValidPvE;
                (isValidPvE, attackersAreMobs) = IWorld(_world()).UD__isValidPvE(attackers, defenders, x, y);
                if (!isValidPvE) revert InvalidPvE();
            } else {
                if (!IWorld(_world()).UD__isValidPvP(attackers, defenders, x, y)) revert InvalidPvP();
                for (uint256 i; i < attackers.length; i++) {
                    if (Stats.getCurrentHp(attackers[i]) <= 0) revert CombatantHpZero();
                }
                for (uint256 i; i < defenders.length; i++) {
                    if (Stats.getCurrentHp(defenders[i]) <= 0) revert CombatantHpZero();
                }
            }

            uint256 startTime = block.timestamp;
            encounterId = keccak256(abi.encode(encounterType, attackers, defenders, startTime));

            CombatEncounter.set(encounterId, CombatEncounterData({
                encounterType: encounterType,
                start: startTime,
                end: 0,
                rewardsDistributed: false,
                currentTurn: 1,
                currentTurnTimer: block.timestamp,
                maxTurns: DEFAULT_MAX_TURNS,
                attackersAreMobs: attackersAreMobs,
                defenders: defenders,
                attackers: attackers
            }));
        } else if (encounterType == EncounterType.World) {
            (uint16 group1X, uint16 group1Y) = IWorld(_world()).UD__getEntityPosition(group1[0]);

            if (!IWorld(_world()).UD__isAtPosition(group2[0], group1X, group1Y)) revert InvalidWorldLocation();
            uint256 startTime = block.timestamp;
            encounterId = keccak256(abi.encode(group1, group2, startTime));

            bytes32 shopId;
            bytes32 characterId;

            if (IWorld(_world()).UD__isShop(group1[0])) {
                shopId = group1[0];
                characterId = group2[0];
            } else if (IWorld(_world()).UD__isShop(group2[0])) {
                shopId = group2[0];
                characterId = group1[0];
            } else {
                revert InvalidShopEncounter();
            }

            if (EncounterEntity.getEncounterId(characterId) != bytes32(0)) revert AlreadyInEncounter();

            WorldEncounterData memory worldData =
                WorldEncounterData({character: characterId, entity: shopId, start: startTime, end: 0});

            WorldEncounter.set(encounterId, worldData);
            EncounterEntity.setEncounterId(characterId, encounterId);
            // exit function
            return encounterId;
        } else {
            revert InvalidEncounterType();
        }

        _registerEntities(group1, encounterId);
        _registerEntities(group2, encounterId);
    }

    /**
     * @param encounterId the bytes32 id of the encounter
     * @param attacks : for a pve the entity with the highest agi has their attacks calculated first
     */
    function endTurn(bytes32 encounterId, bytes32 playerId, Action[] calldata attacks) external payable {
        PauseLib.requireNotPaused();
        CombatEncounterData memory encounterData = CombatEncounter.get(encounterId);
        address playerAddress = IWorld(_world()).UD__getOwnerAddress(playerId);
        if (encounterData.encounterType != EncounterType.PvP && encounterData.encounterType != EncounterType.PvE) {
            revert NotCombatEncounter();
        }
        if (encounterData.start == 0 || encounterData.end != 0) revert InvalidEncounter();
        if (encounterData.currentTurn >= encounterData.maxTurns) revert ExpiredEncounter();
        if (playerAddress != _msgSender() || !IWorld(_world()).UD__isParticipant(playerId, encounterId)) {
            revert NonCombatant();
        }

        // is pvp
        if (encounterData.encounterType == EncounterType.PvP) {
            // Determine active team based on turn parity (even = defenders, odd = attackers)
            bytes32[] memory activeTeam;
            bytes32[] memory otherTeam;
            if (encounterData.currentTurn % 2 == 0) {
                activeTeam = encounterData.defenders;
                otherTeam = encounterData.attackers;
            } else {
                activeTeam = encounterData.attackers;
                otherTeam = encounterData.defenders;
            }

            if (encounterData.currentTurnTimer + 30 <= block.timestamp) {
                // Timer expired — allow either player; skip turn if other team acts
                if (IWorld(_world()).UD__isParticipant(playerAddress, otherTeam)) {
                    encounterData.currentTurn += 1;
                    CombatEncounter.setCurrentTurn(encounterId, encounterData.currentTurn);
                }
            } else {
                // Active team must act
                if (!IWorld(_world()).UD__isParticipant(playerAddress, activeTeam)) revert CannotEndTurn();
            }
        }
        _queueActions(encounterId, attacks);
    }

    function _queueActions(bytes32 encounterId, Action[] memory attacks) internal {
        SessionTimer.set(attacks[0].attackerEntityId, block.timestamp);
        SystemSwitch.call(
            abi.encodeCall(IRngSystem.getRng, (encounterId, RngRequestType.Combat, abi.encode(encounterId, attacks)))
        );
    }

    function _registerEntities(bytes32[] memory group, bytes32 encounterId) internal {
        for (uint256 i; i < group.length; i++) {
            EncounterEntityData memory data = EncounterEntity.get(group[i]);
            if (data.encounterId != bytes32(0) || data.died) revert InvalidCombatEntity();
            data.encounterId = encounterId;
            EncounterEntity.set(group[i], data);
        }
    }

    function _orderGroupsByAgi(bytes32[] memory _group1, bytes32[] memory _group2)
        internal
        view
        returns (bytes32[] memory _attackers, bytes32[] memory _defenders)
    {
        int256 group1TotalAgi;
        int256 group2TotalAgi;

        for (uint256 i; i < _group1.length; i++) {
            group1TotalAgi += Stats.getAgility(_group1[i]);
        }

        for (uint256 i; i < _group2.length; i++) {
            group2TotalAgi += Stats.getAgility(_group2[i]);
        }

        if (group2TotalAgi > group1TotalAgi) {
            _attackers = _group2;
            _defenders = _group1;
        } else {
            _attackers = _group1;
            _defenders = _group2;
        }
    }
}
