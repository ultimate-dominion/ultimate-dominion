// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {SystemSwitch} from "@latticexyz/world-modules/src/utils/SystemSwitch.sol";
import {IWorld} from "@world/IWorld.sol";
import {Math} from "@libraries/Math.sol";
import {
    EncounterEntity,
    EncounterEntityData,
    Stats,
    Effects,
    Items,
    CombatEncounter,
    CombatEncounterData,
    CombatOutcome,
    CombatOutcomeData,
    Position,
    Mobs,
    SessionTimer,
    WorldStatusEffects,
    WorldEncounter,
    WorldEncounterData
} from "@codegen/index.sol";
import {RngRequestType, EncounterType} from "@codegen/common.sol";
import {Action} from "@interfaces/Structs.sol";
import {IRngSystem} from "../interfaces/IRngSystem.sol";
import {DEFAULT_MAX_TURNS} from "../../constants.sol";
import "forge-std/console.sol";

contract EncounterSystem is System {
    using Math for uint256;
    using Math for int256;

    function createEncounter(EncounterType encounterType, bytes32[] memory group1, bytes32[] memory group2)
        public
        returns (bytes32 encounterId)
    {
        require(
            IWorld(_world()).UD__isParticipant(_msgSender(), group1)
                || IWorld(_world()).UD__isParticipant(_msgSender(), group2),
            "ENCOUNTER SYSTEM: INVALID SENDER"
        );
        (uint16 x, uint16 y) = Position.get(group1[0]);

        if (encounterType == EncounterType.PvE) {
            // higher agi attacks first
            (bytes32[] memory attackers, bytes32[] memory defenders) = _orderGroupsByAgi(group1, group2);

            (bool isValidPvE, bool attackersAreMobs) = IWorld(_world()).UD__isValidPvE(attackers, defenders, x, y);
            require(isValidPvE, "ENCOUNTER SYSTEM: INVALID PVE");
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

            require(IWorld(_world()).UD__isValidPvP(attackers, defenders, x, y), "ENCOUNTER SYSTEM: INVALID PVP");

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

            require(IWorld(_world()).UD__isAtPosition(group2[0], group1X, group1Y), "Invalid World Location");
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
                revert("invalid shop encounter");
            }

            require(EncounterEntity.getEncounterId(characterId) == bytes32(0), "cannot start a new encounter");

            WorldEncounterData memory worldData =
                WorldEncounterData({character: characterId, entity: shopId, start: startTime, end: 0});

            WorldEncounter.set(encounterId, worldData);
            EncounterEntity.setEncounterId(characterId, encounterId);
            // exit function
            return encounterId;
        } else {
            revert("unrecognized encounter type");
        }

        EncounterEntityData memory tempEncounterEntityData;

        // set encounterId for group1
        for (uint256 i; i < group1.length; i++) {
            tempEncounterEntityData = EncounterEntity.get(group1[i]);
            // check that entity is not already in an encounter and is not dead
            require(
                tempEncounterEntityData.encounterId == bytes32(0) && !tempEncounterEntityData.died,
                "ENCOUNTER SYSTEM: INVALID ENTITY"
            );
            tempEncounterEntityData.encounterId = encounterId;
            EncounterEntity.set(group1[i], tempEncounterEntityData);
        }

        // set encounterId for group2
        for (uint256 i; i < group2.length; i++) {
            tempEncounterEntityData = EncounterEntity.get(group2[i]);
            // check that entity is not already in an encounter and is not dead
            require(
                tempEncounterEntityData.encounterId == bytes32(0) && !tempEncounterEntityData.died,
                "ENCOUNTER SYSTEM: INVALID ENTITY"
            );
            tempEncounterEntityData.encounterId = encounterId;
            EncounterEntity.set(group2[i], tempEncounterEntityData);
        }
    }

    /**
     * @param encounterId the bytes32 id of the encounter
     * @param attacks : for a pve the entity with the highest agi has their attacks calculated first
     */
    function endTurn(bytes32 encounterId, bytes32 playerId, Action[] memory attacks) public payable {
        CombatEncounterData memory encounterData = CombatEncounter.get(encounterId);
        address playerAddress = IWorld(_world()).UD__getOwnerAddress(playerId);
        require(
            encounterData.encounterType == EncounterType.PvP || encounterData.encounterType == EncounterType.PvE,
            "Not a combat enounter"
        );
        require(encounterData.start != 0 && encounterData.end == 0, "ENCOUNTER SYSTEM: INVALID ENCOUNTER");
        require(encounterData.currentTurn < encounterData.maxTurns, "ENCOUNTER SYSTEM: EXPIRED ENCOUNTER");
        require(
            playerAddress == _msgSender() && IWorld(_world()).UD__isParticipant(playerId, encounterId),
            "ENCOUNTER SYSTEM: NON-COMBATANT"
        );

        // is pvp
        if (encounterData.encounterType == EncounterType.PvP) {
            // should be defender turn
            if (encounterData.currentTurn % 2 == 0) {
                // if timestamp is less than timeout
                if (encounterData.currentTurnTimer + 30 <= block.timestamp) {
                    require(
                        IWorld(_world()).UD__isParticipant(playerId, encounterId), "ENCOUNTER SYSTEM: INVALID CALLER"
                    );
                    // if player is attacker add +1 to current turn
                    if (IWorld(_world()).UD__isParticipant(playerAddress, encounterData.attackers)) {
                        encounterData.currentTurn += 1;
                        CombatEncounter.setCurrentTurn(encounterId, encounterData.currentTurn);
                    }
                } else {
                    require(
                        IWorld(_world()).UD__isParticipant(playerAddress, encounterData.defenders),
                        "Cannot end defenders turn"
                    );
                }
            } else {
                // should be attacker turn unless defender has timed out
                if (encounterData.currentTurnTimer + 30 <= block.timestamp) {
                    // allow either player to end the turn.
                    require(
                        IWorld(_world()).UD__isParticipant(playerId, encounterId), "ENCOUNTER SYSTEM: INVALID CALLER"
                    );
                    // if playerId is of a defender added 1 to current turn
                    // if player is attacker add +1 to current turn
                    if (IWorld(_world()).UD__isParticipant(playerAddress, encounterData.defenders)) {
                        encounterData.currentTurn += 1;
                        CombatEncounter.setCurrentTurn(encounterId, encounterData.currentTurn);
                    }
                } else {
                    // check that player action is for attacker
                    require(
                        IWorld(_world()).UD__isParticipant(playerAddress, encounterData.attackers),
                        "Cannot end attackers turn"
                    );
                }
            }
        }
        _queueActions(encounterId, attacks);
    }

    function _endCombatEncounter(bytes32 encounterId, uint256 randomNumber, bool attackersWin) internal {
        CombatEncounterData memory encounterData = CombatEncounter.get(encounterId);
        require(CombatEncounter.getEnd(encounterId) == 0, "encounter already over");

        if (block.chainid == 31337) {
            CombatEncounter.setEnd(encounterId, block.number);
            encounterData.end = block.number;
        } else {
            CombatEncounter.setEnd(encounterId, block.timestamp);
            encounterData.end = block.timestamp;
        }

        uint256 expAmount;
        uint256 goldAmount;
        uint256[] memory itemsDropped;
        CombatOutcomeData memory combatOutcome;

        if (encounterData.encounterType == EncounterType.PvE) {
            (expAmount, goldAmount, itemsDropped) = IWorld(_world()).UD__distributePveRewards(encounterId, randomNumber);
        } else if (encounterData.encounterType == EncounterType.PvP) {
            (expAmount, goldAmount, itemsDropped) = IWorld(_world()).UD__distributePvpRewards(encounterId, randomNumber);
        } else {
            revert("unrecognized enocounter type");
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
            // clear encounterId
            EncounterEntity.setEncounterId(entityTemp, bytes32(0));
            // remove combat status effects
            EncounterEntity.setAppliedStatusEffects(entityTemp, emptyArray);
            if (EncounterEntity.getDied(entityTemp)) {
                IWorld(_world()).UD__removeEntityFromBoard(entityTemp);
                EncounterEntity.setDied(entityTemp, true);
                WorldStatusEffects.setAppliedStatusEffects(entityTemp, emptyArray);
            }
        }

        for (uint256 i; i < encounterData.defenders.length; i++) {
            entityTemp = encounterData.defenders[i];
            // clear encounter id
            EncounterEntity.setEncounterId(entityTemp, bytes32(0));
            // remove combat status effects
            EncounterEntity.setAppliedStatusEffects(entityTemp, emptyArray);
            if (EncounterEntity.getDied(entityTemp)) {
                IWorld(_world()).UD__removeEntityFromBoard(entityTemp);
                // removing entity from the board resets died to false so set it again here.
                EncounterEntity.setDied(entityTemp, true);
                // if entity died remove world stat bonuses
                WorldStatusEffects.setAppliedStatusEffects(entityTemp, emptyArray);
            }
        }

        CombatOutcome.set(encounterId, combatOutcome);
    }

    function _endWorldEncounter(bytes32 encounterId) internal {
        WorldEncounterData memory encounterData = WorldEncounter.get(encounterId);
        require(encounterData.end == 0 && encounterData.start != 0, "Encounter System: Invalid Encounter");

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

        // add up group1 agi
        for (uint256 i; i < _group1.length; i++) {
            group1TotalAgi += Stats.getAgility(_group1[i]);
        }

        for (uint256 i; i < _group2.length; i++) {
            group2TotalAgi += Stats.getAgility(_group2[i]);
        }

        if (group1TotalAgi > group2TotalAgi) {
            _attackers = _group1;
            _defenders = _group2;
        } else if (group2TotalAgi > group1TotalAgi) {
            _attackers = _group2;
            _defenders = _group1;
        } else {
            _attackers = _group1;
            _defenders = _group2;
        }
    }
}
