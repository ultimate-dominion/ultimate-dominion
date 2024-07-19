// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {SystemSwitch} from "@latticexyz/world-modules/src/utils/SystemSwitch.sol";
import {IWorld} from "@world/IWorld.sol";
import {Math} from "@libraries/Math.sol";
import {LibChunks} from "@libraries/LibChunks.sol";
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
    Position,
    Mobs,
    MobsData,
    Counters
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
        for (uint256 i; i < attackers.length; i++) {
            if (!IWorld(_world()).UD__isValidCharacterId(attackers[i])) {
                _isValidPvE = false;
                break;
            }
            if (!IWorld(_world()).UD__isAtPosition(attackers[i], x, y)) {
                _isValidPvE = false;
                break;
            }
        }
        if (_isValidPvE) {
            for (uint256 i; i < defenders.length; i++) {
                if (IWorld(_world()).UD__isValidCharacterId(defenders[i])) {
                    _isValidPvE = false;
                    break;
                }
                if (!IWorld(_world()).UD__isAtPosition(defenders[i], x, y)) {
                    _isValidPvE = false;
                    break;
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

    function executeCombat(uint256 randomNumber, bytes32 encounterId, Action[] memory actions) public {
        // ensure this is an authorised call from the entropy contract
        _requireAccess(address(this), _msgSender());

        //get encounter data
        CombatEncounterData memory encounterData = CombatEncounter.get(encounterId);

        for (uint256 i; i < actions.length; i++) {
            Action memory currentAction = actions[i];

            _executeAction(
                encounterId,
                currentAction.actionId,
                currentAction.attackerEntityId,
                currentAction.defenderEntityId,
                currentAction.weaponId,
                randomNumber
            );
        }

        uint256 deadDefenderCounter;
        uint256 deadAttackerCounter;
        for (uint256 i; i < encounterData.defenders.length; i++) {
            int256 curHp = Stats.getCurrentHp(encounterData.defenders[i]);
            if (curHp <= 0) {
                deadDefenderCounter++;
                if (uint8(encounterData.encounterType) == 0) {
                    if (IWorld(_world()).UD__isValidCharacterId(encounterData.defenders[i])) {
                        MatchEntity.setEncounterId(encounterData.defenders[i], bytes32(0));
                    }
                }
            } else {
                if (!IWorld(_world()).UD__isValidCharacterId(encounterData.defenders[i])) {
                    // execute mob action
                    // _executeAction(
                    //     encounterId,
                    //     actionId,
                    //     encounterData.defenders[i],
                    //     encounterData.attackers[randomNumber % encounterData.attackers.length],
                    //     weaponId,
                    //     randomNumber
                    // );
                }
            }
        }
        for (uint256 i; i < encounterData.attackers.length; i++) {
            int256 curHp = Stats.getCurrentHp(encounterData.attackers[i]);
            if (curHp <= 0) {
                deadAttackerCounter++;
                MatchEntity.setEncounterId(encounterData.attackers[i], bytes32(0));
            }
        }
        if (
            deadAttackerCounter == encounterData.attackers.length
                || deadDefenderCounter == encounterData.defenders.length
                || encounterData.currentTurn == encounterData.maxTurns
        ) {
            // for some reason block.timestamp is not availible here on anvil?

            _endMatch(encounterId, randomNumber);
        } else {
            encounterData.currentTurn++;
        }
    }

    function _queueActions(bytes32 encounterId, Action[] memory actions) internal {
        SystemSwitch.call(
            abi.encodeCall(IRngSystem.getRng, (encounterId, RngRequestType.Combat, abi.encode(encounterId, actions)))
        );
    }

    function _executeAction(
        bytes32 matchEntity,
        bytes32 actionId,
        bytes32 attackerId,
        bytes32 defenderId,
        uint256 weaponId,
        uint256 randomNumber
    ) internal {
        // get action data
        ActionsData memory actionData = Actions.get(actionId);
        //decode action data according to type
        if (uint8(actionData.actionType) == 1) {
            PhysicalAttackStats memory attackStats = abi.decode(actionData.actionStats, (PhysicalAttackStats));
            (int256 damage, bool hit, bool crit) =
                _calculatePhysicalAttack(attackStats, attackerId, defenderId, weaponId, randomNumber);
            if (hit) {
                int256 currentHp = Stats.getCurrentHp(defenderId) - int256(damage / int256(ATTACK_MODIFIER));
                Stats.setCurrentHp(defenderId, currentHp);
            }
        }
    }

    function _calculatePhysicalAttack(
        PhysicalAttackStats memory attackStats,
        bytes32 attackerId,
        bytes32 defenderId,
        uint256 weaponId,
        uint256 randomNumber
    ) public returns (int256 damage, bool hit, bool crit) {
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
    ) internal returns (bool attackLands, bool crit) {
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

    function _endMatch(bytes32 encounterId, uint256 randomNumber)
        internal
        returns (uint256 expAmount, uint256 goldAmount)
    {
        CombatEncounterData memory encounterData = CombatEncounter.get(encounterId);

        if (block.chainid == 31337) {
            encounterData.end = block.number;
        } else {
            encounterData.end = block.timestamp;
        }

        // check dead attackers and defenders
        uint256 cumulativeAttackerLevels;
        uint256 livingAttackers;
        StatsData memory statsTemp;
        for (uint256 i; i < encounterData.attackers.length; i++) {
            statsTemp = Stats.get(encounterData.attackers[i]);
            cumulativeAttackerLevels += statsTemp.level;
            if (statsTemp.currentHp > 0) {
                livingAttackers++;
            }
        }

        //if cumulative attacker levels is >= 5 levels above the monster level no gold reward.
        //  for this calculation level is calculated from exp not from actual leveled levels

        for (uint256 i; i < encounterData.defenders.length; i++) {
            statsTemp = Stats.get(encounterData.defenders[i]);
            if (statsTemp.currentHp <= int256(0)) {
                expAmount += statsTemp.experience;
                goldAmount += calculateGoldDrop(statsTemp.level, randomNumber);
                MatchEntity.setEncounterId(encounterData.defenders[i], bytes32(0));
                _calculateItemDrop(
                    randomNumber,
                    encounterData.defenders[i],
                    encounterData.attackers[randomNumber % encounterData.attackers.length]
                );
            }
        }
        // drop gold reward calculated from the level of mob to player journey wallet (can mint tokens when he returns to 0,0).
        // if dead player, drop transfer 50% of un-banked gold to world contract
        // distribute loot
        bytes32 entityIdTemp;
        for (uint256 i; i < encounterData.attackers.length; i++) {
            entityIdTemp = encounterData.attackers[i];
            if (IWorld(_world()).UD__isValidCharacterId(entityIdTemp)) {
                statsTemp = Stats.get(entityIdTemp);
                if (statsTemp.currentHp > int256(0)) {
                    if (goldAmount > uint256(0)) {
                        IWorld(_world()).UD__dropGold(entityIdTemp, (goldAmount / livingAttackers));
                    }
                    if (expAmount > uint256(0) && livingAttackers > uint256(0)) {
                        statsTemp.experience += expAmount / livingAttackers;
                    }
                }
                Stats.set(entityIdTemp, statsTemp);
            }
            MatchEntity.setEncounterId(entityIdTemp, bytes32(0));
        }
        CombatEncounter.set(encounterId, encounterData);
    }

    function calculateGoldDrop(uint256 mobLevel, uint256 randomNumber) public returns (uint256 dropAmount) {
        // Calculate level-based drop

        dropAmount = randomNumber % (BASE_GOLD_DROP * mobLevel);
    }

    function _calculateItemDrop(uint256 randomNumber, bytes32 entityId, bytes32 characterId) internal {
        uint256 mobId = IWorld(_world()).UD__getMobId(entityId);
        MonsterStats memory monsterStats = abi.decode(Mobs.getMobStats(mobId), (MonsterStats));
        for (uint256 i; i < monsterStats.inventory.length; i++) {
            uint256 dropChance = Items.getDropChance(monsterStats.inventory[i]);
            if (randomNumber % 100_000 > dropChance) {
                IWorld(_world()).UD__dropItem(monsterStats.inventory[i], 1, characterId);
            }
        }
    }
}
