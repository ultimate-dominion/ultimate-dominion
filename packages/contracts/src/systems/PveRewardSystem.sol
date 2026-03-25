// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {IWorld} from "@world/IWorld.sol";
import {
    Items,
    Stats,
    Levels,
    StatsData,
    CombatEncounter,
    CombatEncounterData,
    Mobs,
    MobStats,
    MobDropBonus,
    EncounterEntity,
    GasReserve,
    UltimateDominionConfig
} from "@codegen/index.sol";
import {MonsterStats, RewardDistributionTemps} from "@interfaces/Structs.sol";
import {InvalidRewardState} from "../Errors.sol";
import {_requireSystemOrAdmin} from "../utils.sol";
import {GoldLib} from "../libraries/GoldLib.sol";
import {BASE_GOLD_DROP, MAX_LEVEL, ELITE_REWARD_MULTIPLIER, ELITE_DROP_MULTIPLIER, GUILD_BONUS_BPS} from "../../constants.sol";

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
                _goldAmount += _calculateGoldDrop(distTemps.defenderLevelTemp, randomNumber, distTemps.monsterTemp);
                EncounterEntity.setEncounterId(distTemps.monsterTemp, bytes32(0));

                bytes32 playerToDropTo = distTemps.players[randomNumber % distTemps.players.length];

                if (!EncounterEntity.getDied(playerToDropTo)) {
                    _itemIdsDropped = _calculateItemDrop(randomNumber, distTemps.monsterTemp, playerToDropTo);
                }
            }
        }

        // Cache max level exp threshold once (saves 4-6K gas/player)
        uint256 maxLevelExp = Levels.get(MAX_LEVEL);

        for (uint256 i; i < distTemps.players.length; i++) {
            distTemps.entityIdTemp = distTemps.players[i];
            if (IWorld(_world()).UD__isValidCharacterId(distTemps.entityIdTemp)) {
                statsTemp = Stats.get(distTemps.entityIdTemp);
                if (statsTemp.currentHp > int256(0)) {
                    if (_goldAmount > uint256(0)) {
                        uint256 goldPerPlayer = _goldAmount / distTemps.livingPlayers;

                        // Guild bonus: +5% gold
                        if (IWorld(_world()).UD__isGuildMember(distTemps.entityIdTemp)) {
                            goldPerPlayer = goldPerPlayer * (10000 + GUILD_BONUS_BPS) / 10000;
                        }

                        uint256 reserveSplit = goldPerPlayer / 20; // 5%
                        uint256 playerSplit = goldPerPlayer - reserveSplit; // 95%

                        // Guild tax: deduct from player's share, add to guild treasury
                        uint256 taxAmount = IWorld(_world()).UD__taxGold(distTemps.entityIdTemp, playerSplit);
                        playerSplit -= taxAmount;

                        address playerAddress = IWorld(_world()).UD__getOwnerAddress(distTemps.entityIdTemp);
                        GoldLib.goldMint(_world(), playerAddress, playerSplit);
                        // taxAmount is virtual — tracked in Guild.treasury, backed by reduced player mint.
                        // No token mint needed; withdrawTreasury mints on withdrawal.
                        GoldLib.goldMint(_world(), _world(), reserveSplit);
                        GasReserve.setBalance(distTemps.entityIdTemp, GasReserve.getBalance(distTemps.entityIdTemp) + reserveSplit);
                    }
                    uint256 currentExp = statsTemp.experience;
                    uint256 _calculatedExp = _baseExp / distTemps.livingPlayers;

                    // Guild bonus: +5% XP
                    if (IWorld(_world()).UD__isGuildMember(distTemps.entityIdTemp)) {
                        _calculatedExp = _calculatedExp * (10000 + GUILD_BONUS_BPS) / 10000;
                    }
                    if (
                        statsTemp.level >= MAX_LEVEL || currentExp >= maxLevelExp
                            || _baseExp == uint256(0) || distTemps.livingPlayers == uint256(0)
                    ) {
                        //do nothing
                    } else if (_calculatedExp + currentExp <= maxLevelExp) {
                        statsTemp.experience += _calculatedExp;
                        _expAmount += _calculatedExp;
                    } else {
                        uint256 _expToGive = maxLevelExp - currentExp;
                        statsTemp.experience += _expToGive;
                        _expAmount += _expToGive;
                    }
                } else {
                    // PvE death penalty: burn 5% of wallet Gold (permanent sink)
                    address deadPlayer = IWorld(_world()).UD__getOwnerAddress(distTemps.entityIdTemp);
                    uint256 walletGold = GoldLib.goldBalanceOf(deadPlayer);
                    if (walletGold > 0) {
                        uint256 deathPenalty = walletGold / 20;
                        if (deathPenalty > 0) {
                            GoldLib.goldBurn(_world(), deadPlayer, deathPenalty);
                        }
                    }
                }
                Stats.set(distTemps.entityIdTemp, statsTemp);
            }
        }
        CombatEncounter.setRewardsDistributed(encounterId, true);
    }

    function _calculateGoldDrop(uint256 mobLevel, uint256 randomNumber, bytes32 entityId) internal view returns (uint256 dropAmount) {
        if (mobLevel == 0) mobLevel = 1;
        uint256 baseGold = BASE_GOLD_DROP;
        if (MobStats.getIsElite(entityId)) baseGold = baseGold * ELITE_REWARD_MULTIPLIER / 100;
        dropAmount = (randomNumber % (baseGold * mobLevel)) + 0.05 ether;
    }

    function _calculateItemDrop(uint256 randomNumber, bytes32 entityId, bytes32 characterId)
        internal
        returns (uint256[] memory)
    {
        uint256 mobId = IWorld(_world()).UD__getMobId(entityId);
        MonsterStats memory monsterStats = abi.decode(Mobs.getMobStats(mobId), (MonsterStats));

        // Read signature bonuses (parallel array to inventory)
        uint256[] memory bonuses = MobDropBonus.getBonuses(mobId);
        bool hasBonuses = bonuses.length == monsterStats.inventory.length;

        // Roll each item independently — all winners drop
        bool _isElite = MobStats.getIsElite(entityId);
        uint256[] memory candidates = new uint256[](monsterStats.inventory.length);
        uint256 numCandidates;
        for (uint256 i; i < monsterStats.inventory.length; i++) {
            uint256 tempItemId = monsterStats.inventory[i];
            uint256 dropChance = Items.getDropChance(tempItemId);
            if (hasBonuses) {
                dropChance += bonuses[i];
            }
            if (_isElite) {
                dropChance = dropChance * ELITE_DROP_MULTIPLIER / 100;
            }
            if (dropChance > 100000) dropChance = 100000;
            uint256 roll = uint256(keccak256(abi.encodePacked(randomNumber, i))) % 100000;
            if (roll < dropChance) {
                candidates[numCandidates] = tempItemId;
                numCandidates++;
            }
        }

        if (numCandidates == 0) return new uint256[](0);

        // Drop all items that passed their roll
        uint256[] memory result = new uint256[](numCandidates);
        for (uint256 i; i < numCandidates; i++) {
            IWorld(_world()).UD__dropItem(characterId, candidates[i], 1);
            result[i] = candidates[i];
        }
        return result;
    }
}
