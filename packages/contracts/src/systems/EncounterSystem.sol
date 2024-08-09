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
    ActionOutcomeData,
    PvPFlag
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
    // TODO switch attackers defenders to group 1 and group 2 and order according to agility

    function createEncounter(EncounterType encounterType, bytes32[] memory attackers, bytes32[] memory defenders)
        public
        returns (bytes32 encounterId)
    {
        require(isParticipant(_msgSender(), attackers), "COMBAT SYSTEM: INVALID SENDER");
        (uint16 x, uint16 y) = Position.get(attackers[0]);

        if (uint256(encounterType) == 1) {
            require(IWorld(_world()).UD__isValidPvE(attackers, defenders, x, y), "COMBAT SYSTEM: INVALID PVE");
            uint256 startTime = block.timestamp;
            encounterId = keccak256(abi.encode(encounterType, attackers, defenders, startTime));

            CombatEncounterData memory combatData = CombatEncounterData({
                encounterType: encounterType,
                start: startTime,
                end: 0,
                rewardsDistributed: false,
                currentTurn: 1,
                maxTurns: DEFAULT_MAX_TURNS,
                defenders: defenders,
                attackers: attackers
            });

            CombatEncounter.set(encounterId, combatData);
        }
        if (uint8(encounterType) == 0) {
            require(IWorld(_world()).UD__isValidPvP(attackers, defenders, x, y), "COMBAT SYSTEM: INVALID PVP");
            uint256 startTime = block.timestamp;
            encounterId = keccak256(abi.encode(encounterType, attackers, defenders, startTime));

            CombatEncounterData memory combatData = CombatEncounterData({
                encounterType: encounterType,
                start: startTime,
                end: 0,
                rewardsDistributed: false,
                currentTurn: 1,
                maxTurns: DEFAULT_MAX_TURNS,
                defenders: defenders,
                attackers: attackers
            });

            CombatEncounter.set(encounterId, combatData);
        }
        EncounterEntityData memory tempEncounterData;
        for (uint256 i; i < defenders.length; i++) {
            tempEncounterData = EncounterEntity.get(defenders[i]);
            require(
                tempEncounterData.encounterId == bytes32(0) && !tempEncounterData.died, "COMBAT SYSTEM: INVALID ENTITY"
            );
            tempEncounterData.encounterId = encounterId;
            EncounterEntity.set(defenders[i], tempEncounterData);
        }
        for (uint256 i; i < attackers.length; i++) {
            tempEncounterData = EncounterEntity.get(attackers[i]);
            require(
                tempEncounterData.encounterId == bytes32(0) && !tempEncounterData.died, "COMBAT SYSTEM: INVALID ENTITY"
            );
            tempEncounterData.encounterId = encounterId;
            EncounterEntity.set(attackers[i], tempEncounterData);
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
        require(encounterData.start != 0 && encounterData.end == 0, "COMBAT SYSTEM: INVALID ENCOUNTER");
        require(encounterData.currentTurn < encounterData.maxTurns, "COMBAT SYSTEM: EXPIRED ENCOUNTER");

        address playerAddress = IWorld(_world()).UD__getOwnerAddress(playerId);

        if (uint8(encounterData.encounterType) == 0) {
            if (encounterData.currentTurn % 2 == 0) {
                require(isParticipant(playerAddress, encounterData.defenders), "Cannot end attackers turn");
            } else {
                require(isParticipant(playerAddress, encounterData.attackers), "Cannot end defenders turn");
            }
        } else {
            require(
                playerAddress == _msgSender() && isParticipant(playerId, encounterId), "COMBAT SYSTEM: NON-COMBATANT"
            );
        }
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

        bytes32 defenderTemp;
        for (uint256 i; i < encounterData.defenders.length; i++) {
            defenderTemp = encounterData.defenders[i];
            if (!EncounterEntity.getDied(defenderTemp)) {
                EncounterEntity.setEncounterId(defenderTemp, bytes32(0));
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
            if (!IWorld(_world()).UD__isValidCharacterId(encounterData.attackers[i])) {
                IWorld(_world()).UD__removeEntityFromBoard(encounterData.attackers[i]);
            }
        }
        for (uint256 i; i < encounterData.defenders.length; i++) {
            EncounterEntity.setEncounterId(encounterData.defenders[i], bytes32(0));
            if (!IWorld(_world()).UD__isValidCharacterId(encounterData.defenders[i])) {
                IWorld(_world()).UD__removeEntityFromBoard(encounterData.defenders[i]);
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

    function _queueActions(bytes32 encounterId, Action[] memory actions) internal {
        SystemSwitch.call(
            abi.encodeCall(IRngSystem.getRng, (encounterId, RngRequestType.Combat, abi.encode(encounterId, actions)))
        );
    }
}
