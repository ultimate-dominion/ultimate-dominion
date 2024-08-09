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
    MatchEntity,
    MatchEntityData,
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

contract CombatSystem is System {
    using Math for uint256;
    using Math for int256;
    // in pve the attackers are always players and the defenders are always mobs since there is no aggro system
    // TODO switch attackers defenders to group 1 and group 2 and order according to agility

    function createMatch(EncounterType encounterType, bytes32[] memory attackers, bytes32[] memory defenders)
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
                currentTurn: 0,
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
                currentTurn: 0,
                maxTurns: DEFAULT_MAX_TURNS,
                defenders: defenders,
                attackers: attackers
            });

            CombatEncounter.set(encounterId, combatData);
        }
        MatchEntityData memory tempMatchData;
        for (uint256 i; i < defenders.length; i++) {
            tempMatchData = MatchEntity.get(defenders[i]);
            require(tempMatchData.encounterId == bytes32(0) && !tempMatchData.died, "COMBAT SYSTEM: INVALID ENTITY");
            tempMatchData.encounterId = encounterId;
            MatchEntity.set(defenders[i], tempMatchData);
        }
        for (uint256 i; i < attackers.length; i++) {
            tempMatchData = MatchEntity.get(attackers[i]);
            require(tempMatchData.encounterId == bytes32(0) && !tempMatchData.died, "COMBAT SYSTEM: INVALID ENTITY");
            tempMatchData.encounterId = encounterId;
            MatchEntity.set(attackers[i], tempMatchData);
        }
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
        require(playerAddress == _msgSender() && isParticipant(playerId, encounterId), "COMBAT SYSTEM: NON-COMBATANT");

        if (uint8(encounterData.encounterType) == 0) {
            if (encounterData.currentTurn % 2 == 0) {
                require(isParticipant(playerAddress, encounterData.defenders), "Cannot end opponents turn");
            } else {
                require(isParticipant(playerAddress, encounterData.attackers), "Cannot end opponents turn");
            }
        }
        _queueActions(encounterId, actions);
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

    function checkForMatchEnd(CombatEncounterData memory encounterData)
        public
        view
        returns (bool _matchEnded, bool _attackersWin)
    {
        uint256 deadDefenderCounter;
        uint256 deadAttackerCounter;
        for (uint256 i; i < encounterData.defenders.length; i++) {
            if (getDied(encounterData.defenders[i])) {
                deadDefenderCounter++;
            }
        }
        for (uint256 i; i < encounterData.attackers.length; i++) {
            if (getDied(encounterData.attackers[i])) {
                deadAttackerCounter++;
            }
        }

        _matchEnded = (
            deadAttackerCounter == encounterData.attackers.length
                || deadDefenderCounter == encounterData.defenders.length
                || encounterData.currentTurn == encounterData.maxTurns
        );

        _attackersWin = deadDefenderCounter == encounterData.defenders.length;
    }

    function getDied(bytes32 entityId) public view returns (bool isDied) {
        return MatchEntity.getDied(entityId);
    }

    function _getCurrentActionData(Action memory currentAction)
        internal
        view
        returns (ActionOutcomeData memory currentActionData)
    {
        currentActionData = ActionOutcomeData({
            actionId: currentAction.actionId,
            weaponId: currentAction.weaponId,
            attackerId: currentAction.attackerEntityId,
            defenderId: currentAction.defenderEntityId,
            hit: false,
            miss: false,
            crit: false,
            attackerDamageDelt: 0,
            defenderDamageDelt: 0,
            attackerDied: false,
            defenderDied: false,
            blockNumber: block.number,
            timestamp: block.timestamp
        });
    }

    function _queueActions(bytes32 encounterId, Action[] memory actions) internal {
        SystemSwitch.call(
            abi.encodeCall(IRngSystem.getRng, (encounterId, RngRequestType.Combat, abi.encode(encounterId, actions)))
        );
    }

    function executeAction(ActionOutcomeData memory actionOutcomeData, uint256 randomNumber)
        public
        returns (ActionOutcomeData memory)
    {
        _requireAccess(address(this), _msgSender());
        // if the defender is alive and attacker is alive, execute the action
        if (!getDied(actionOutcomeData.attackerId) && !getDied(actionOutcomeData.defenderId)) {
            // get action data
            ActionsData memory actionData = Actions.get(actionOutcomeData.actionId);

            require(actionData.actionStats.length != 0, "action does not exist");
            //decode action data according to type
            if (uint8(actionData.actionType) == 1) {
                // get attack stats
                PhysicalAttackStats memory attackStats = abi.decode(actionData.actionStats, (PhysicalAttackStats));
                // calculate damage
                (actionOutcomeData.attackerDamageDelt, actionOutcomeData.hit, actionOutcomeData.crit) =
                _calculatePhysicalAttack(
                    attackStats,
                    actionOutcomeData.attackerId,
                    actionOutcomeData.defenderId,
                    actionOutcomeData.weaponId,
                    randomNumber
                );

                // if hit deduct damage
                if (actionOutcomeData.hit) {
                    int256 currentHp = Stats.getCurrentHp(actionOutcomeData.defenderId)
                        - int256(actionOutcomeData.attackerDamageDelt / int256(ATTACK_MODIFIER));
                    if (currentHp <= 0) actionOutcomeData.defenderDied = true;
                    Stats.setCurrentHp(actionOutcomeData.defenderId, currentHp);
                } else {
                    actionOutcomeData.miss = true;
                }
            } else {
                revert("action type not recognized");
            }

            if (actionOutcomeData.defenderDied) {
                MatchEntity.setDied(actionOutcomeData.defenderId, true);
            }
            if (actionOutcomeData.attackerDied) {
                MatchEntity.setDied(actionOutcomeData.attackerId, true);
            }
        }
        return actionOutcomeData;
    }

    function _calculatePhysicalAttack(
        PhysicalAttackStats memory attackStats,
        bytes32 attackerId,
        bytes32 defenderId,
        uint256 weaponId,
        uint256 randomNumber
    ) internal view returns (int256 damage, bool hit, bool crit) {
        // get attacker
        AdjustedCombatStats memory attacker = IWorld(_world()).UD__applyEquipmentBonuses(attackerId);
        //get defender
        AdjustedCombatStats memory defender = IWorld(_world()).UD__applyEquipmentBonuses(defenderId);
        // get weapon stats
        WeaponStats memory weapon = IWorld(_world()).UD__getWeaponStats(weaponId);

        if (defender.currentHp > 0) {
            uint64[] memory rnChunks = LibChunks.get4Chunks(randomNumber);
            (hit, crit) = _calculatePhysicalAttackModifier(
                uint256(rnChunks[0]), uint256(rnChunks[1]), attackStats, attacker, defender
            );

            if (hit) {
                damage = (
                    (
                        attackStats.bonusDamage
                            + int256(
                                uint256(rnChunks[2]) % weapon.maxDamage <= weapon.minDamage
                                    ? weapon.minDamage
                                    : uint256(rnChunks[2]) % weapon.maxDamage
                            ) + int256(attacker.adjustedStrength / 2)
                    ) * int256(ATTACK_MODIFIER)
                )
                    - int256(
                        (
                            int256(defender.adjustedArmor) - attackStats.armorPenetration > 0
                                ? uint256(int256(defender.adjustedArmor) - attackStats.armorPenetration)
                                : uint256(1)
                        ) * DEFENSE_MODIFIER
                    );
                if (crit) {
                    console2.log("CRIT!");
                    damage = damage * int256(CRIT_MODIFIER);
                    crit = true;
                }
            } else {
                console2.log("MISS!");
                damage = 0;
                hit = false;
            }
        } else {
            damage = 0;
            hit = false;
            crit = false;
        }
    }

    function getEncounter(bytes32 encounterId) public view returns (CombatEncounterData memory) {
        return CombatEncounter.get(encounterId);
    }

    function _calculatePhysicalAttackModifier(
        uint256 attackRoll,
        uint256 defenseRoll,
        PhysicalAttackStats memory attackStats,
        AdjustedCombatStats memory attacker,
        AdjustedCombatStats memory defender
    ) internal view returns (bool attackLands, bool crit) {
        this; // silence state mutability warning without generating bytecode - see https://github.com/ethereum/solidity/issues/2691
        uint256 attackTotal = (Math.add(attacker.adjustedAgility, attackStats.attackModifierBonus) + (attackRoll % 100))
            * (TO_HIT_MODIFIER);
        // attacker.agility + attackStats.attackModifierBonus + attackRoll * TO_HIT_MODIFIER

        uint256 defenseTotal = ((defenseRoll % 100) + defender.adjustedAgility) * DEFENSE_MODIFIER;
        attackLands = attackTotal > defenseTotal;

        if (attackLands) {
            crit = attackTotal / defenseTotal >= 2;
        }
    }

    function _calculateMagicAttack() public {}

    function endMatch(bytes32 encounterId, uint256 randomNumber, bool attackersWin) public {
        //make sure it's an authorized call
        _requireAccess(address(this), _msgSender());
        CombatEncounterData memory encounterData = CombatEncounter.get(encounterId);
        require(CombatEncounter.getEnd(encounterId) == 0, "match already over");

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
            if (!MatchEntity.getDied(defenderTemp)) {
                MatchEntity.setEncounterId(defenderTemp, bytes32(0));
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
            MatchEntity.setEncounterId(encounterData.attackers[i], bytes32(0));
        }
        CombatOutcome.set(encounterId, combatOutcome);
    }
}
