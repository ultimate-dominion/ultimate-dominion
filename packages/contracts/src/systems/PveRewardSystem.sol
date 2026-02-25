// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {IWorld} from "@world/IWorld.sol";
import {Math, WAD} from "@libraries/Math.sol";
import {
    Items,
    Stats,
    Levels,
    StatsData,
    CombatEncounter,
    CombatEncounterData,
    Mobs,
    EncounterEntity,
    AdventureEscrow
} from "@codegen/index.sol";
import {MonsterStats, RewardDistributionTemps} from "@interfaces/Structs.sol";
import {InvalidRewardState} from "../Errors.sol";
import {_requireSystemOrAdmin} from "../utils.sol";
import {BASE_GOLD_DROP, EXP_MODIFIER, MAX_LEVEL} from "../../constants.sol";

contract PveRewardSystem is System {
    function distributePveRewards(bytes32 encounterId, uint256 randomNumber)
        public
        returns (uint256 _expAmount, uint256 _goldAmount, uint256[] memory _itemIdsDropped)
    {
        _requireSystemOrAdmin(_msgSender());
        CombatEncounterData memory encounterData = CombatEncounter.get(encounterId);
        RewardDistributionTemps memory distTemps;
        if (encounterData.end == 0 || encounterData.rewardsDistributed) revert InvalidRewardState();

        StatsData memory statsTemp;
        uint256 _baseExp;
        if (encounterData.attackersAreMobs) {
            distTemps.monsters = encounterData.attackers;
            distTemps.players = encounterData.defenders;
        } else {
            distTemps.players = encounterData.attackers;
            distTemps.monsters = encounterData.defenders;
        }
        for (uint256 i; i < distTemps.players.length; i++) {
            statsTemp = Stats.get(distTemps.players[i]);
            distTemps.cumulativePlayerLevels += statsTemp.level;
            if (statsTemp.currentHp > 0) {
                distTemps.livingPlayers++;
            }
        }

        for (uint256 i; i < distTemps.monsters.length; i++) {
            distTemps.monsterTemp = distTemps.monsters[i];
            distTemps.defenderLevelTemp = Stats.getLevel(distTemps.monsterTemp);
            bool correctLevelSpread = distTemps.defenderLevelTemp > distTemps.cumulativePlayerLevels
                ? true
                : (distTemps.cumulativePlayerLevels - distTemps.defenderLevelTemp) <= 5;
            if (EncounterEntity.getDied(distTemps.monsterTemp) && correctLevelSpread) {
                _baseExp += Stats.getExperience(distTemps.monsterTemp);
                _goldAmount += _calculateGoldDrop(statsTemp.level, randomNumber);
                EncounterEntity.setEncounterId(distTemps.monsterTemp, bytes32(0));

                bytes32 playerToDropTo = distTemps.players[randomNumber % distTemps.players.length];

                if (!EncounterEntity.getDied(playerToDropTo)) {
                    _itemIdsDropped = _calculateItemDrop(randomNumber, distTemps.monsterTemp, playerToDropTo);
                }
            }
        }

        for (uint256 i; i < distTemps.players.length; i++) {
            distTemps.entityIdTemp = distTemps.players[i];
            if (IWorld(_world()).UD__isValidCharacterId(distTemps.entityIdTemp)) {
                statsTemp = Stats.get(distTemps.entityIdTemp);
                if (statsTemp.currentHp > int256(0)) {
                    if (_goldAmount > uint256(0)) {
                        IWorld(_world()).UD__dropGoldToEscrow(distTemps.entityIdTemp, (_goldAmount / distTemps.livingPlayers));
                    }
                    uint256 _calculatedExp =
                        ((_baseExp / distTemps.livingPlayers) * calculateExpMultiplier(distTemps.entityIdTemp)) / WAD;
                    if (
                        Stats.getExperience(distTemps.entityIdTemp) >= Levels.get(MAX_LEVEL) || _baseExp == uint256(0)
                            || distTemps.livingPlayers == uint256(0)
                    ) {
                        //do nothing
                    } else if (_calculatedExp + Stats.getExperience(distTemps.entityIdTemp) <= Levels.get(MAX_LEVEL)) {
                        statsTemp.experience += _calculatedExp;
                        _expAmount += _calculatedExp;
                    } else if (_calculatedExp + Stats.getExperience(distTemps.entityIdTemp) > Levels.get(MAX_LEVEL)) {
                        uint256 _expToGive = Levels.get(MAX_LEVEL) - Stats.getExperience(distTemps.entityIdTemp);
                        statsTemp.experience += _expToGive;
                        _expAmount += _expToGive;
                    }
                }
                Stats.set(distTemps.entityIdTemp, statsTemp);
            }
        }
        CombatEncounter.setRewardsDistributed(encounterId, true);
    }

    function calculateExpMultiplier(bytes32 characterId) public view returns (uint256 _expMultiplier) {
        uint256 escrowBalance = AdventureEscrow.get(characterId);
        _expMultiplier = ((Math.sqrt(escrowBalance) * 1e8) / (EXP_MODIFIER)) + WAD;
    }

    function _calculateGoldDrop(uint256 mobLevel, uint256 randomNumber) internal view returns (uint256 dropAmount) {
        this;
        if (mobLevel == 0) mobLevel = 1;
        dropAmount = (randomNumber % (BASE_GOLD_DROP * mobLevel)) + 0.05 ether;
    }

    function _calculateItemDrop(uint256 randomNumber, bytes32 entityId, bytes32 characterId)
        internal
        returns (uint256[] memory)
    {
        uint256 mobId = IWorld(_world()).UD__getMobId(entityId);
        MonsterStats memory monsterStats = abi.decode(Mobs.getMobStats(mobId), (MonsterStats));

        // Roll each item independently, then pick at most 1 winner
        uint256[] memory candidates = new uint256[](monsterStats.inventory.length);
        uint256 numCandidates;
        for (uint256 i; i < monsterStats.inventory.length; i++) {
            uint256 tempItemId = monsterStats.inventory[i];
            uint256 dropChance = Items.getDropChance(tempItemId);
            // Each item gets its own independent roll (hash with index)
            uint256 roll = uint256(keccak256(abi.encodePacked(randomNumber, i))) % 100;
            if (roll < dropChance) {
                candidates[numCandidates] = tempItemId;
                numCandidates++;
            }
        }

        if (numCandidates == 0) return new uint256[](0);

        // Pick one random winner from candidates
        uint256 winnerId = candidates[randomNumber % numCandidates];
        IWorld(_world()).UD__dropItem(characterId, winnerId, 1);

        uint256[] memory result = new uint256[](1);
        result[0] = winnerId;
        return result;
    }
}
