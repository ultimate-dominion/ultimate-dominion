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
            require(isValidPvE(attackers, defenders, x, y), "COMBAT SYSTEM: INVALID PVE");
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
        if (uint8(encounterType) == 0) {}
        for (uint256 i; i < defenders.length; i++) {
            require(MatchEntity.getEncounterId(defenders[i]) == bytes32(0), "COMBAT SYSTEM: ENTITY OCCUPIED");
            MatchEntity.setEncounterId(defenders[i], encounterId);
        }
        for (uint256 i; i < attackers.length; i++) {
            require(MatchEntity.getEncounterId(attackers[i]) == bytes32(0), "COMBAT SYSTEM: ENTITY OCCUPIED");
            MatchEntity.setEncounterId(attackers[i], encounterId);
        }
    }

    function isValidPvE(bytes32[] memory attackers, bytes32[] memory defenders, uint16 x, uint16 y)
        public
        view
        returns (bool _isValidPvE)
    {
        _isValidPvE = true;
        for (uint256 i; i < attackers.length;) {
            if (!IWorld(_world()).UD__isValidCharacterId(attackers[i])) {
                _isValidPvE = false;
                break;
            }
            if (!IWorld(_world()).UD__isAtPosition(attackers[i], x, y)) {
                _isValidPvE = false;
                break;
            }
            {
                i++;
            }
        }
        if (_isValidPvE) {
            for (uint256 i; i < defenders.length;) {
                if (IWorld(_world()).UD__isValidCharacterId(defenders[i])) {
                    _isValidPvE = false;
                    break;
                }
                if (!IWorld(_world()).UD__isAtPosition(defenders[i], x, y)) {
                    _isValidPvE = false;
                    break;
                }
                {
                    i++;
                }
            }
        }
        return _isValidPvE;
    }

    /**
     * @param encounterId the bytes32 id of the encounter
     * @param actions : for a pve encounter player actions are calculated first and the mobs.
     */
    function endTurn(bytes32 encounterId, bytes32 playerId, Action[] memory actions) public payable {
        CombatEncounterData memory encounterData = CombatEncounter.get(encounterId);
        require(encounterData.start != 0 && encounterData.end == 0, "COMBAT SYSTEM: INVALID ENCOUNTER");
        require(encounterData.currentTurn < encounterData.maxTurns, "COMBAT SYSTEM: EXPIRED ENCOUNTER");
        require(
            IWorld(_world()).UD__getOwnerAddress(playerId) == _msgSender() && isParticipant(playerId, encounterId),
            "COMBAT SYSTEM: NON-COMBATANT"
        );
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

    function executeCombat(uint256 prevRandao, bytes32 encounterId, Action[] memory actions) public {
        uint256 randomNumber;
        // ensure this is an authorised call from the entropy contract
        _requireAccess(address(this), _msgSender());

        //get encounter data
        CombatEncounterData memory encounterData = CombatEncounter.get(encounterId);

        // execute attacker actions
        for (uint256 i; i < actions.length; i++) {
            Action memory currentAction = actions[i];

            randomNumber =
                uint256(keccak256(abi.encode(prevRandao, currentAction.attackerEntityId, encounterData.currentTurn)));

            ActionOutcomeData memory currentActionData = _getCurrentActionData(currentAction);

            // execute action
            currentActionData = _executeAction(currentActionData, randomNumber);
            // emit action data to offchain table
            ActionOutcome.set(encounterId, encounterData.currentTurn, i, currentActionData);
        }

        uint256 deadDefenderCounter;
        uint256 deadAttackerCounter;
        for (uint256 i; i < encounterData.defenders.length; i++) {
            if (MatchEntity.getDied(encounterData.defenders[i])) {
                _setSpawned(encounterData.attackers[i], false);
                // CombatOutcome.
                deadDefenderCounter++;
            }
        }
        for (uint256 i; i < encounterData.attackers.length; i++) {
            if (MatchEntity.getDied(encounterData.attackers[i])) {
                _setSpawned(encounterData.attackers[i], false);
                deadAttackerCounter++;
            }
        }
        if (
            deadAttackerCounter == encounterData.attackers.length
                || deadDefenderCounter == encounterData.defenders.length
                || encounterData.currentTurn == encounterData.maxTurns
        ) {
            _endMatch(encounterId, randomNumber, deadDefenderCounter == encounterData.defenders.length);
        } else {
            // execute defender attacks
            for (uint256 i; i < encounterData.defenders.length; i++) {
                ActionOutcomeData memory defenderAction = _getCurrentActionData(
                    Action({
                        attackerEntityId: encounterData.defenders[i],
                        defenderEntityId: encounterData.attackers[i],
                        actionId: IWorld(_world()).UD__getMonsterStats(encounterData.defenders[i]).actions[0],
                        weaponId: IWorld(_world()).UD__getMonsterStats(encounterData.defenders[i]).inventory[0]
                    })
                );
                randomNumber =
                    uint256(keccak256(abi.encode(prevRandao, defenderAction.attackerId, encounterData.currentTurn)));

                defenderAction = _executeAction(defenderAction, randomNumber);

                ActionOutcome.set(encounterId, encounterData.currentTurn, i, defenderAction);
            }

            encounterData.currentTurn++;
            CombatEncounter.set(encounterId, encounterData);
        }
    }

    function _setSpawned(bytes32 entityId, bool spawned) internal {
        if (IWorld(_world()).UD__isValidCharacterId(entityId)) {
            Spawned.set(entityId, spawned);
        }
    }

    function _getCurrentActionData(Action memory currentAction)
        internal
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

    function _executeAction(ActionOutcomeData memory actionOutcomeData, uint256 randomNumber)
        internal
        returns (ActionOutcomeData memory)
    {
        // if the defender is alive and attacks is alive, execute the action
        if (!MatchEntity.getDied(actionOutcomeData.attackerId) && !MatchEntity.getDied(actionOutcomeData.defenderId)) {
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

    function getEncounter(bytes32 encounterId) public view returns (CombatEncounterData memory _encounterData) {
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
        uint256 attackTotal = (
            Math.add(attacker.adjustedAgility, attackStats.attackModifierBonus) + (attackRoll % 1000)
        ) * (TO_HIT_MODIFIER);
        // attacker.agility + attackStats.attackModifierBonus + attackRoll * TO_HIT_MODIFIER

        uint256 defenseTotal = ((defenseRoll % 1000) + defender.adjustedAgility) * DEFENSE_MODIFIER;
        attackLands = attackTotal > defenseTotal;

        if (attackLands) {
            crit = attackTotal / defenseTotal >= 2;
        }
    }

    function _calculateMagicAttack() public {}

    function _endMatch(bytes32 encounterId, uint256 randomNumber, bool attackersWin) internal {
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
            if (MatchEntity.getDied(defenderTemp)) {
                MatchEntity.setEncounterId(defenderTemp, bytes32(0));
            }
        }

        (uint256 expAmount, uint256 goldAmount, uint256[] memory itemsDropped) =
            IWorld(_world()).UD__distributeRewards(encounterId, randomNumber);

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
