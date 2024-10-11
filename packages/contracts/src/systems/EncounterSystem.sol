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
    WorldStatusEffects
} from "@codegen/index.sol";
import {RngRequestType, EncounterType} from "@codegen/common.sol";
import {Action} from "@interfaces/Structs.sol";
import {_requireAccess} from "../utils.sol";
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
            isParticipant(_msgSender(), group1) || isParticipant(_msgSender(), group2),
            "ENCOUNTER SYSTEM: INVALID SENDER"
        );
        (uint16 x, uint16 y) = Position.get(group1[0]);

        // higher agi attacks first
        (bytes32[] memory attackers, bytes32[] memory defenders) = _orderGroupsByAgi(group1, group2);

        if (encounterType == EncounterType.PvE) {
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
        }

        if (encounterType == EncounterType.PvP) {
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
        }

        EncounterEntityData memory tempEncounterEntityData;

        // set encounterId for attackers
        for (uint256 i; i < attackers.length; i++) {
            tempEncounterEntityData = EncounterEntity.get(attackers[i]);
            // check that entity is not already in an encounter and is not dead
            require(
                tempEncounterEntityData.encounterId == bytes32(0) && !tempEncounterEntityData.died,
                "ENCOUNTER SYSTEM: INVALID ENTITY"
            );
            tempEncounterEntityData.encounterId = encounterId;
            EncounterEntity.set(attackers[i], tempEncounterEntityData);
        }

        // set encounterId for defenders
        for (uint256 i; i < defenders.length; i++) {
            tempEncounterEntityData = EncounterEntity.get(defenders[i]);
            // check that entity is not already in an encounter and is not dead
            require(
                tempEncounterEntityData.encounterId == bytes32(0) && !tempEncounterEntityData.died,
                "ENCOUNTER SYSTEM: INVALID ENTITY"
            );
            tempEncounterEntityData.encounterId = encounterId;
            EncounterEntity.set(defenders[i], tempEncounterEntityData);
        }
    }

    function checkForEncounterEnd(CombatEncounterData memory encounterData)
        public
        view
        returns (bool _encounterEnded, bool _attackersWin)
    {
        uint256 deadDefenderCounter;
        uint256 deadAttackerCounter;
        for (uint256 i; i < encounterData.defenders.length; i++) {
            if (IWorld(_world()).UD__getDied(encounterData.defenders[i])) {
                deadDefenderCounter++;
            }
        }
        for (uint256 i; i < encounterData.attackers.length; i++) {
            if (IWorld(_world()).UD__getDied(encounterData.attackers[i])) {
                deadAttackerCounter++;
            }
        }

        _encounterEnded = (
            deadAttackerCounter == encounterData.attackers.length
                || deadDefenderCounter == encounterData.defenders.length
                || encounterData.currentTurn == encounterData.maxTurns
        );

        _attackersWin = deadDefenderCounter == encounterData.defenders.length;
    }

    /**
     * @param encounterId the bytes32 id of the encounter
     * @param attacks : for a pve the entity with the highest agi has their attacks calculated first
     */
    function endTurn(bytes32 encounterId, bytes32 playerId, Action[] memory attacks) public payable {
        CombatEncounterData memory encounterData = CombatEncounter.get(encounterId);
        address playerAddress = IWorld(_world()).UD__getOwnerAddress(playerId);

        require(encounterData.start != 0 && encounterData.end == 0, "ENCOUNTER SYSTEM: INVALID ENCOUNTER");
        require(encounterData.currentTurn < encounterData.maxTurns, "ENCOUNTER SYSTEM: EXPIRED ENCOUNTER");
        require(
            playerAddress == _msgSender() && isParticipant(playerId, encounterId), "ENCOUNTER SYSTEM: NON-COMBATANT"
        );

        // is pvp
        if (encounterData.encounterType == EncounterType.PvP) {
            // should be defender turn
            if (encounterData.currentTurn % 2 == 0) {
                // if timestamp is less than timeout
                if (encounterData.currentTurnTimer + 30 <= block.timestamp) {
                    require(isParticipant(playerId, encounterId), "ENCOUNTER SYSTEM: INVALID CALLER");
                    // if player is attacker add +1 to current turn
                    if (isParticipant(playerAddress, encounterData.attackers)) {
                        encounterData.currentTurn += 1;
                        CombatEncounter.setCurrentTurn(encounterId, encounterData.currentTurn);
                    }
                } else {
                    require(isParticipant(playerAddress, encounterData.defenders), "Cannot end defenders turn");
                }
            } else {
                // should be attacker turn unless defender has timed out
                if (encounterData.currentTurnTimer + 30 <= block.timestamp) {
                    // allow either player to end the turn.
                    require(isParticipant(playerId, encounterId), "ENCOUNTER SYSTEM: INVALID CALLER");
                    // if playerId is of a defender added 1 to current turn
                    // if player is attacker add +1 to current turn
                    if (isParticipant(playerAddress, encounterData.defenders)) {
                        encounterData.currentTurn += 1;
                        CombatEncounter.setCurrentTurn(encounterId, encounterData.currentTurn);
                    }
                } else {
                    // check that player action is for attacker
                    require(isParticipant(playerAddress, encounterData.attackers), "Cannot end attackers turn");
                }
            }
        }
        _queueActions(encounterId, attacks);
    }

    function endEncounter(bytes32 encounterId, uint256 randomNumber, bool attackersWin) public {
        //make sure it's an authorized call
        _requireAccess(address(this), _msgSender());
        CombatEncounterData memory encounterData = CombatEncounter.get(encounterId);
        require(CombatEncounter.getEnd(encounterId) == 0, "encounter already over");

        if (block.chainid == 31337) {
            CombatEncounter.setEnd(encounterId, block.number);
            encounterData.end = block.number;
        } else {
            CombatEncounter.setEnd(encounterId, block.timestamp);
            encounterData.end = block.timestamp;
        }

        bytes32 entityTemp;

        uint256 expAmount;
        uint256 goldAmount;
        uint256[] memory itemsDropped;

        if (encounterData.encounterType == EncounterType.PvE) {
            (expAmount, goldAmount, itemsDropped) = IWorld(_world()).UD__distributePveRewards(encounterId, randomNumber);
        } else if (encounterData.encounterType == EncounterType.PvP) {
            (expAmount, goldAmount, itemsDropped) = IWorld(_world()).UD__distributePvpRewards(encounterId, randomNumber);
        } else {
            revert("unrecognized enocounter type");
        }

        CombatOutcomeData memory combatOutcome = CombatOutcomeData({
            endTime: block.timestamp,
            attackersWin: attackersWin,
            playerFled: false,
            expDropped: expAmount,
            goldDropped: goldAmount,
            itemsDropped: itemsDropped
        });

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

    function isParticipant(bytes32 playerId, bytes32 encounterId) public view returns (bool _isParticipant) {
        CombatEncounterData memory encounterData = CombatEncounter.get(encounterId);
        for (uint256 i; i < encounterData.attackers.length;) {
            if (playerId == encounterData.attackers[i]) {
                _isParticipant = true;
                break;
            }
            {
                i++;
            }
        }
        if (!_isParticipant) {
            for (uint256 i; i < encounterData.defenders.length;) {
                if (playerId == encounterData.defenders[i]) {
                    _isParticipant = true;
                    break;
                }
                {
                    i++;
                }
            }
        }
    }

    function isParticipant(address account, bytes32[] memory participants) public view returns (bool _isParticipant) {
        for (uint256 i; i < participants.length;) {
            if (account == IWorld(_world()).UD__getOwnerAddress(participants[i])) {
                _isParticipant = true;
                break;
            }
            {
                i++;
            }
        }
    }

    function isAttacker(bytes32 encounterId, bytes32 entityId) public returns (bool _isAttacker) {
        CombatEncounterData memory encounterData = CombatEncounter.get(encounterId);
        for (uint256 i; i < encounterData.attackers.length;) {
            if (entityId == encounterData.attackers[i]) {
                _isAttacker = true;
                break;
            }
            {
                i++;
            }
        }
    }

    function isDefender(bytes32 encounterId, bytes32 entityId) public returns (bool _isDefender) {
        CombatEncounterData memory encounterData = CombatEncounter.get(encounterId);
        for (uint256 i; i < encounterData.defenders.length;) {
            if (entityId == encounterData.defenders[i]) {
                _isDefender = true;
                break;
            }
            {
                i++;
            }
        }
    }

    function isInEncounter(bytes32 entityId) public view returns (bool) {
        return EncounterEntity.getEncounterId(entityId) != bytes32(0);
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
