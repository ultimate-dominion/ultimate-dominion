// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {SystemSwitch} from "@latticexyz/world-modules/src/utils/SystemSwitch.sol";
import {IWorld} from "@world/IWorld.sol";
import {Math} from "@libraries/Math.sol";
import {LibChunks} from "@libraries/LibChunks.sol";
import {ArrayManagers} from "@libraries/ArrayManagers.sol";
import {
    RandomNumbers,
    EncounterEntity,
    EncounterEntityData,
    Stats,
    StatsData,
    Actions,
    ActionsData,
    Items,
    CharacterEquipment,
    CharacterEquipmentData,
    CombatEncounter,
    CombatEncounterData,
    CombatOutcome,
    CombatOutcomeData,
    Position,
    Mobs,
    Spawned,
    MobsData,
    Counters,
    ActionOutcome,
    ActionOutcomeData
} from "@codegen/index.sol";
import {RngRequestType, MobType, Alignment, EncounterType} from "@codegen/common.sol";
import {
    MonsterStats,
    WeaponStats,
    NPCStats,
    Action,
    PhysicalAttackStats,
    AdjustedCombatStats
} from "@interfaces/Structs.sol";
import {_requireOwner, _requireAccess} from "../utils.sol";
import {UltimateDominionConfig} from "@codegen/index.sol";
import {IRngSystem} from "../interfaces/IRngSystem.sol";
import {
    DEFAULT_MAX_TURNS,
    TO_HIT_MODIFIER,
    DEFENSE_MODIFIER,
    ATTACK_MODIFIER,
    CRIT_MODIFIER,
    BASE_GOLD_DROP
} from "../../constants.sol";
import "forge-std/console2.sol";

contract EncounterSystem is System {
    using Math for uint256;
    using Math for int256;
    // in pve the attackers are always players and the defenders are always mobs since there is no aggro system

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

        if (uint256(encounterType) == 1) {
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

        if (uint8(encounterType) == 0) {
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
     * @param actions : for a pve encounter player actions are calculated first and the mobs.
     */
    function endTurn(bytes32 encounterId, bytes32 playerId, Action[] memory actions) public payable {
        CombatEncounterData memory encounterData = CombatEncounter.get(encounterId);
        address playerAddress = IWorld(_world()).UD__getOwnerAddress(playerId);

        require(encounterData.start != 0 && encounterData.end == 0, "ENCOUNTER SYSTEM: INVALID ENCOUNTER");
        require(encounterData.currentTurn < encounterData.maxTurns, "ENCOUNTER SYSTEM: EXPIRED ENCOUNTER");
        require(
            playerAddress == _msgSender() && isParticipant(playerId, encounterId), "ENCOUNTER SYSTEM: NON-COMBATANT"
        );

        // check valid pvp turns
        if (uint8(encounterData.encounterType) == 0) {
            // should be defender turn
            if (encounterData.currentTurn % 2 == 0) {
                // if timestamp is less than timeout
                if (encounterData.currentTurnTimer + 30 <= block.timestamp) {
                    // check that player action is for defender
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
        console2.log("Queue actions");
        _queueActions(encounterId, actions);
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
        for (uint256 i; i < encounterData.defenders.length; i++) {
            entityTemp = encounterData.defenders[i];
            if (EncounterEntity.getDied(entityTemp)) {
                IWorld(_world()).UD__removeEntityFromBoard(entityTemp);
            }
        }
        for (uint256 i; i < encounterData.attackers.length; i++) {
            entityTemp = encounterData.attackers[i];
            if (EncounterEntity.getDied(entityTemp)) {
                IWorld(_world()).UD__removeEntityFromBoard(entityTemp);
            }
        }
        uint256 expAmount;
        uint256 goldAmount;
        uint256[] memory itemsDropped;
        if (uint8(encounterData.encounterType) == uint8(1)) {
            (expAmount, goldAmount, itemsDropped) = IWorld(_world()).UD__distributePveRewards(encounterId, randomNumber);
        } else {}
        CombatOutcomeData memory combatOutcome = CombatOutcomeData({
            endTime: block.timestamp,
            attackersWin: attackersWin,
            expDropped: expAmount,
            goldDropped: goldAmount,
            itemsDropped: itemsDropped
        });

        for (uint256 i; i < encounterData.attackers.length; i++) {
            EncounterEntity.setEncounterId(encounterData.attackers[i], bytes32(0));
        }
        for (uint256 i; i < encounterData.defenders.length; i++) {
            EncounterEntity.setEncounterId(encounterData.defenders[i], bytes32(0));
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

    function _queueActions(bytes32 encounterId, Action[] memory actions) internal {
        SystemSwitch.call(
            abi.encodeCall(IRngSystem.getRng, (encounterId, RngRequestType.Combat, abi.encode(encounterId, actions)))
        );
    }

    function _orderGroupsByAgi(bytes32[] memory _group1, bytes32[] memory _group2)
        internal
        view
        returns (bytes32[] memory _attackers, bytes32[] memory _defenders)
    {
        uint256 group1TotalAgi;
        uint256 group2TotalAgi;

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
