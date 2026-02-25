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
    CombatOutcome,
    CombatOutcomeData,
    Position,
    SessionTimer,
    WorldStatusEffects,
    WorldEncounter,
    WorldEncounterData
} from "@codegen/index.sol";
import {RngRequestType, EncounterType} from "@codegen/common.sol";
import {Action} from "@interfaces/Structs.sol";
import {IRngSystem} from "../interfaces/IRngSystem.sol";
import {DEFAULT_MAX_TURNS, MAX_PARTY_SIZE} from "../../constants.sol";
import {Unauthorized, InvalidPvE, InvalidPvP, InvalidEncounter, ExpiredEncounter, NonCombatant, CannotEndTurn, NotCombatEncounter, EncounterAlreadyOver, InvalidEncounterType, InvalidWorldLocation, InvalidShopEncounter, AlreadyInEncounter, InvalidCombatEntity, InvalidGroupSize, CombatantHpZero} from "../Errors.sol";
import {PauseLib} from "../libraries/PauseLib.sol";

contract EncounterSystem is System {
    function createEncounter(EncounterType encounterType, bytes32[] memory group1, bytes32[] memory group2)
        public
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

        if (encounterType == EncounterType.PvE) {
            // higher agi attacks first
            (bytes32[] memory attackers, bytes32[] memory defenders) = _orderGroupsByAgi(group1, group2);

            (bool isValidPvE, bool attackersAreMobs) = IWorld(_world()).UD__isValidPvE(attackers, defenders, x, y);
            if (!isValidPvE) revert InvalidPvE();
            uint256 startTime = block.timestamp;
            encounterId = keccak256(abi.encode(encounterType, attackers, defenders, startTime));

            CombatEncounterData memory combatData = CombatEncounterData({
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
            });

            CombatEncounter.set(encounterId, combatData);
        } else if (encounterType == EncounterType.PvP) {
            // higher agi attacks first
            (bytes32[] memory attackers, bytes32[] memory defenders) = _orderGroupsByAgi(group1, group2);

            if (!IWorld(_world()).UD__isValidPvP(attackers, defenders, x, y)) revert InvalidPvP();

            // Validate all combatants have HP > 0
            for (uint256 i; i < attackers.length; i++) {
                if (Stats.getCurrentHp(attackers[i]) <= 0) revert CombatantHpZero();
            }
            for (uint256 i; i < defenders.length; i++) {
                if (Stats.getCurrentHp(defenders[i]) <= 0) revert CombatantHpZero();
            }

            uint256 startTime = block.timestamp;
            encounterId = keccak256(abi.encode(encounterType, attackers, defenders, startTime));

            CombatEncounterData memory combatData = CombatEncounterData({
                encounterType: encounterType,
                start: startTime,
                end: 0,
                rewardsDistributed: false,
                currentTurn: 1,
                currentTurnTimer: block.timestamp,
                maxTurns: DEFAULT_MAX_TURNS,
                attackersAreMobs: false,
                defenders: defenders,
                attackers: attackers
            });

            CombatEncounter.set(encounterId, combatData);
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

        EncounterEntityData memory tempEncounterEntityData;

        // set encounterId for group1
        for (uint256 i; i < group1.length; i++) {
            tempEncounterEntityData = EncounterEntity.get(group1[i]);
            // check that entity is not already in an encounter and is not dead
            if (tempEncounterEntityData.encounterId != bytes32(0) || tempEncounterEntityData.died) {
                revert InvalidCombatEntity();
            }
            tempEncounterEntityData.encounterId = encounterId;
            EncounterEntity.set(group1[i], tempEncounterEntityData);
        }

        // set encounterId for group2
        for (uint256 i; i < group2.length; i++) {
            tempEncounterEntityData = EncounterEntity.get(group2[i]);
            // check that entity is not already in an encounter and is not dead
            if (tempEncounterEntityData.encounterId != bytes32(0) || tempEncounterEntityData.died) {
                revert InvalidCombatEntity();
            }
            tempEncounterEntityData.encounterId = encounterId;
            EncounterEntity.set(group2[i], tempEncounterEntityData);
        }
    }

    /**
     * @param encounterId the bytes32 id of the encounter
     * @param attacks : for a pve the entity with the highest agi has their attacks calculated first
     */
    function endTurn(bytes32 encounterId, bytes32 playerId, Action[] memory attacks) public payable {
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
            // should be defender turn
            if (encounterData.currentTurn % 2 == 0) {
                // if timestamp is less than timeout
                if (encounterData.currentTurnTimer + 30 <= block.timestamp) {
                    if (!IWorld(_world()).UD__isParticipant(playerId, encounterId)) {
                        revert Unauthorized();
                    }
                    // if player is attacker add +1 to current turn
                    if (IWorld(_world()).UD__isParticipant(playerAddress, encounterData.attackers)) {
                        encounterData.currentTurn += 1;
                        CombatEncounter.setCurrentTurn(encounterId, encounterData.currentTurn);
                    }
                } else {
                    if (!IWorld(_world()).UD__isParticipant(playerAddress, encounterData.defenders)) {
                        revert CannotEndTurn();
                    }
                }
            } else {
                // should be attacker turn unless defender has timed out
                if (encounterData.currentTurnTimer + 30 <= block.timestamp) {
                    // allow either player to end the turn.
                    if (!IWorld(_world()).UD__isParticipant(playerId, encounterId)) {
                        revert Unauthorized();
                    }
                    // if player is attacker add +1 to current turn
                    if (IWorld(_world()).UD__isParticipant(playerAddress, encounterData.defenders)) {
                        encounterData.currentTurn += 1;
                        CombatEncounter.setCurrentTurn(encounterId, encounterData.currentTurn);
                    }
                } else {
                    // check that player action is for attacker
                    if (!IWorld(_world()).UD__isParticipant(playerAddress, encounterData.attackers)) {
                        revert CannotEndTurn();
                    }
                }
            }
        }
        _queueActions(encounterId, attacks);
    }

    function _endCombatEncounter(bytes32 encounterId, uint256 randomNumber, bool attackersWin) internal {
        CombatEncounterData memory encounterData = CombatEncounter.get(encounterId);
        if (CombatEncounter.getEnd(encounterId) != 0) revert EncounterAlreadyOver();

        CombatEncounter.setEnd(encounterId, block.timestamp);
        encounterData.end = block.timestamp;

        uint256 expAmount;
        uint256 goldAmount;
        uint256[] memory itemsDropped;
        CombatOutcomeData memory combatOutcome;

        if (encounterData.encounterType == EncounterType.PvE) {
            (expAmount, goldAmount, itemsDropped) = IWorld(_world()).UD__distributePveRewards(encounterId, randomNumber);
        } else if (encounterData.encounterType == EncounterType.PvP) {
            (expAmount, goldAmount, itemsDropped) = IWorld(_world()).UD__distributePvpRewards(encounterId, randomNumber);
        } else {
            revert InvalidEncounterType();
        }

        combatOutcome = CombatOutcomeData({
            endTime: block.timestamp,
            attackersWin: attackersWin,
            playerFled: false,
            expDropped: expAmount,
            goldDropped: goldAmount,
            itemsDropped: itemsDropped
        });

        bytes32 entityTemp;
        bytes32[] memory emptyArray = new bytes32[](0);

        for (uint256 i; i < encounterData.attackers.length; i++) {
            entityTemp = encounterData.attackers[i];
            EncounterEntity.setEncounterId(entityTemp, bytes32(0));
            EncounterEntity.setAppliedStatusEffects(entityTemp, emptyArray);
            if (EncounterEntity.getDied(entityTemp)) {
                IWorld(_world()).UD__removeEntityFromBoard(entityTemp);
                EncounterEntity.setDied(entityTemp, true);
                WorldStatusEffects.setAppliedStatusEffects(entityTemp, emptyArray);
            }
        }

        for (uint256 i; i < encounterData.defenders.length; i++) {
            entityTemp = encounterData.defenders[i];
            EncounterEntity.setEncounterId(entityTemp, bytes32(0));
            EncounterEntity.setAppliedStatusEffects(entityTemp, emptyArray);
            if (EncounterEntity.getDied(entityTemp)) {
                IWorld(_world()).UD__removeEntityFromBoard(entityTemp);
                EncounterEntity.setDied(entityTemp, true);
                WorldStatusEffects.setAppliedStatusEffects(entityTemp, emptyArray);
            }
        }

        CombatOutcome.set(encounterId, combatOutcome);

        // Check combat fragment triggers for the winning side
        (uint16 currentX, uint16 currentY) = Position.get(encounterData.attackers[0]);
        if (attackersWin) {
            IWorld(_world()).UD__checkCombatFragmentTriggersForGroup(encounterData.attackers, encounterData.defenders, currentX, currentY, encounterData.attackersAreMobs);
        } else {
            IWorld(_world()).UD__checkCombatFragmentTriggersForGroup(encounterData.defenders, encounterData.attackers, currentX, currentY, !encounterData.attackersAreMobs);
        }
    }

    function _endWorldEncounter(bytes32 encounterId) internal {
        WorldEncounterData memory encounterData = WorldEncounter.get(encounterId);
        if (encounterData.end != 0 || encounterData.start == 0) revert InvalidEncounter();

        encounterData.end = block.timestamp;
        EncounterEntity.setEncounterId(encounterData.character, bytes32(0));
        WorldEncounter.set(encounterId, encounterData);
    }

    function endEncounter(bytes32 encounterId, uint256 randomNumber, bool attackersWin) public {
        // Note: Access check removed to allow inter-system calls from PvESystem/PvPSystem
        EncounterType encounterType = IWorld(_world()).UD__getEncounterType(encounterId);
        if (encounterType == EncounterType.PvP || encounterType == EncounterType.PvE) {
            _endCombatEncounter(encounterId, randomNumber, attackersWin);
        } else if (encounterType == EncounterType.World) {
            _endWorldEncounter(encounterId);
        }
    }

    function _queueActions(bytes32 encounterId, Action[] memory attacks) internal {
        SessionTimer.set(attacks[0].attackerEntityId, block.timestamp);
        SystemSwitch.call(
            abi.encodeCall(IRngSystem.getRng, (encounterId, RngRequestType.Combat, abi.encode(encounterId, attacks)))
        );
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
