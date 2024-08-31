// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {
    RandomNumbers,
    EncounterEntity,
    EncounterEntityData,
    EffectsData,
    Effects,
    Stats,
    CombatEncounter,
    CombatEncounterData,
    CharacterEquipment,
    StatsData,
    PhysicalDamageStats,
    PhysicalDamageStatsData,
    MagicDamageStats,
    MagicDamageStatsData,
    ConsumableStats,
    StatusEffectStats,
    StatusEffectStatsData,
    StatusEffectsValidity,
    StatusEffectsValidityData,
    WorldStatusEffects,
    DamageOverTimeApplied,
    DamageOverTimeAppliedData
} from "@codegen/index.sol";
import {IWorld} from "@world/IWorld.sol";
import {RngRequestType, MobType, EncounterType, EffectType, Classes} from "@codegen/common.sol";
import {Counters} from "@tables/Counters.sol";
import {Mobs, MobsData} from "@tables/Mobs.sol";
import {MonsterStats, AdjustedCombatStats, Action} from "@interfaces/Structs.sol";
import {_requireOwner, _requireAccess} from "../utils.sol";
import {UltimateDominionConfig} from "@codegen/index.sol";
import {DEFAULT_MAX_TURNS} from "../../constants.sol";

contract EffectsSystem is System {
    function createEffect(EffectType effectType, string memory name, bytes memory effectStats)
        public
        returns (bytes32 effectStatsId)
    {
        _requireOwner(address(this), _msgSender());
        effectStatsId = bytes32(bytes8(keccak256(abi.encode(name))));

        require(!Effects.getEffectExists(effectStatsId), "Effect already exists");

        if (effectType == EffectType.PhysicalDamage) {
            PhysicalDamageStatsData memory physicalStats = abi.decode(effectStats, (PhysicalDamageStatsData));
            PhysicalDamageStats.set(effectStatsId, physicalStats);
        } else if (effectType == EffectType.MagicDamage) {
            MagicDamageStatsData memory magicStats = abi.decode(effectStats, (MagicDamageStatsData));
            MagicDamageStats.set(effectStatsId, magicStats);
        } else if (effectType == EffectType.StatusEffect) {
            (StatusEffectStatsData memory statusStats, StatusEffectsValidityData memory validityData) =
                abi.decode(effectStats, (StatusEffectStatsData, StatusEffectsValidityData));
            // a status effect that expires after a certain time cannot expire after a number of turns
            // combat effects and world effects cannot overlap
            // also a world effect cannot cause damage over time

            if (validityData.validTime != 0) {
                require(validityData.validTurns == 0, "INVALID EFFECT: TIME");
                require(statusStats.damagePerTick == 0, "INVALID EFFECT: WORLD EFFECT DAMAGE");
            } else if (validityData.validTime == 0) {
                require(validityData.validTurns != 0, "INVALID EFFECT: TURNS");
            }
            StatusEffectStats.set(effectStatsId, statusStats);
            StatusEffectsValidity.set(effectStatsId, validityData);
        }
        Effects.set(effectStatsId, effectType, true);
    }

    function calculateWorldStatusEffects(bytes32 entityId, AdjustedCombatStats memory statInput)
        public
        returns (AdjustedCombatStats memory _adjustedStats)
    {
        bytes32[] memory appliedEffects = WorldStatusEffects.get(entityId);
        bytes32 effectId;
        StatusEffectStatsData memory statsData;
        uint256 numberOfExpiredEffects;

        for (uint256 i; i < appliedEffects.length; i++) {
            effectId = appliedEffects[i];
            statsData = getStatusEffectStats(getEffectStatId(effectId));
            bytes32 updatedEffectId = expireIfInvalid(entityId, effectId);
            if (isNotExpired(updatedEffectId)) {
                statInput.adjustedAgility += statsData.agiModifier;
                statInput.adjustedIntelligence += statsData.agiModifier;
                statInput.adjustedStrength += statsData.strModifier;
                statInput.adjustedMaxHp += statsData.hpModifier;
                statInput.adjustedArmor += statsData.armorModifier;
            } else {
                WorldStatusEffects.updateAppliedStatusEffects(entityId, i, updatedEffectId);
                numberOfExpiredEffects++;
            }
        }

        if (numberOfExpiredEffects > 0) {
            cullExpiredEffects(entityId);
        }

        _adjustedStats = statInput;
    }

    function calculateAllStatusEffects(bytes32 entityId, AdjustedCombatStats memory statInput)
        public
        returns (AdjustedCombatStats memory _adjustedStats)
    {
        StatusEffectStatsData memory statsData;
        bytes32 effectId;

        bytes32[] memory worldStatusEffects = WorldStatusEffects.get(entityId);
        uint256 numberOfExpiredEffects;
        if (worldStatusEffects.length != 0) {
            for (uint256 i; i < worldStatusEffects.length; i++) {
                effectId = worldStatusEffects[i];
                statsData = getStatusEffectStats(getEffectStatId(effectId));
                bytes32 updatedEffectId = expireIfInvalid(entityId, effectId);
                if (isNotExpired(updatedEffectId)) {
                    statInput.adjustedAgility += statsData.agiModifier;
                    statInput.adjustedIntelligence += statsData.agiModifier;
                    statInput.adjustedStrength += statsData.strModifier;
                    statInput.adjustedMaxHp += statsData.hpModifier;
                    statInput.adjustedArmor += statsData.armorModifier;
                } else {
                    WorldStatusEffects.updateAppliedStatusEffects(entityId, i, updatedEffectId);
                    numberOfExpiredEffects++;
                }
            }
        }
        if (numberOfExpiredEffects > 0) {
            cullExpiredEffects(entityId);
        }

        EncounterEntityData memory encounterData = EncounterEntity.get(entityId);

        if (encounterData.encounterId != bytes32(0)) {
            for (uint256 i; i < encounterData.appliedStatusEffects.length; i++) {
                effectId = encounterData.appliedStatusEffects[i];
                statsData = getStatusEffectStats(getEffectStatId(effectId));
                bytes32 updatedEffectId = expireIfInvalid(entityId, effectId);
                if (isNotExpired(updatedEffectId)) {
                    statInput.adjustedAgility += statsData.agiModifier;
                    statInput.adjustedIntelligence += statsData.agiModifier;
                    statInput.adjustedStrength += statsData.strModifier;
                    statInput.adjustedMaxHp += statsData.hpModifier;
                    statInput.adjustedArmor += statsData.armorModifier;
                } else {
                    EncounterEntity.updateAppliedStatusEffects(entityId, i, updatedEffectId);
                }
            }
        }
        _adjustedStats = statInput;
    }

    function cullExpiredEffects(bytes32 entityId) public {
        bytes32[] memory worldStatusEffects = WorldStatusEffects.get(entityId);
        bytes32 effectId;
        uint256 removedEffects;
        if (worldStatusEffects.length != 0) {
            for (uint256 i = worldStatusEffects.length - 1; i >= 0; i--) {
                effectId = worldStatusEffects[i];
                if (!isNotExpired(effectId)) {
                    bytes32 lastEffectId =
                        WorldStatusEffects.getItemAppliedStatusEffects(entityId, worldStatusEffects.length - 1);
                    WorldStatusEffects.updateAppliedStatusEffects(entityId, i, lastEffectId);
                    WorldStatusEffects.popAppliedStatusEffects(entityId);
                }
            }
        }
    }

    function applyStatusEffect(bytes32 entityId, bytes32 effectId)
        public
        returns (AdjustedCombatStats memory _adjustedStats)
    {
        _requireAccess(address(this), _msgSender());
        StatusEffectsValidityData memory statsData = StatusEffectsValidity.get(effectId);
        bytes32 encounterId = EncounterEntity.getEncounterId(entityId);
        if (statsData.validTurns != 0 && encounterId != bytes32(0)) {
            EncounterEntity.pushAppliedStatusEffects(entityId, effectId);
        } else if (statsData.validTime != 0 && encounterId == bytes32(0)) {
            WorldStatusEffects.pushAppliedStatusEffects(entityId, effectId);
        } else {
            revert("invalid effect application");
        }
    }

    function isValidEffect(bytes32 entityId, bytes32 appliedEffectId) public returns (bool) {
        return isNotExpired(expireIfInvalid(entityId, appliedEffectId));
    }

    function isNotExpired(bytes32 appliedEffectId) public pure returns (bool) {
        return getEffectExpired(appliedEffectId) == 0;
    }

    function expireIfInvalid(bytes32 entityId, bytes32 appliedEffectId) public returns (bytes32) {
        if (isNotExpired(appliedEffectId)) {
            (bytes32 effectStatId, uint256 timestampApplied, uint256 expiredTime, uint256 turnApplied) =
                getAppliedEffectInfo(appliedEffectId);

            require(bytes32(bytes8(appliedEffectId)) != appliedEffectId, "effect not applied");

            StatusEffectsValidityData memory validityData = StatusEffectsValidity.get(getEffectStatId(appliedEffectId));

            bool isValidTime;
            bool isValidTurn;

            if (validityData.validTime == 0 || block.timestamp - timestampApplied < validityData.validTime) {
                isValidTime = true;
            }

            if (
                validityData.validTurns == 0
                    || CombatEncounter.getCurrentTurn(EncounterEntity.getEncounterId(entityId)) - turnApplied
                        <= validityData.validTurns
            ) isValidTurn = true;

            if (isValidTime && isValidTurn) {
                return appliedEffectId;
            } else {
                return _expireStatusEffect(appliedEffectId);
            }
        } else {
            return appliedEffectId;
        }
    }

    function applyDamageOverTime(bytes32 encounterId, bytes32 entityId) public {
        _requireAccess(address(this), _msgSender());
        uint256 currentTurn = CombatEncounter.getCurrentTurn(encounterId);
        int256 totalDamage;
        bytes32[] memory appliedStatusEffects = EncounterEntity.getAppliedStatusEffects(entityId);

        int256[] memory damages = new int256[](appliedStatusEffects.length);

        for (uint256 i; i < appliedStatusEffects.length; i++) {
            int256 damageToApply = StatusEffectStats.getDamagePerTick(appliedStatusEffects[i]);
            damages[i] = damageToApply;
            totalDamage += damageToApply;
            int256 currentHp = Stats.getCurrentHp(entityId) + damageToApply;
            if (damageToApply != 0) Stats.setCurrentHp(entityId, currentHp);
        }

        if (totalDamage != 0) {
            DamageOverTimeAppliedData memory dotDamage =
                DamageOverTimeAppliedData({entityId: entityId, totalDamage: totalDamage, individualDamages: damages});
            DamageOverTimeApplied.set(encounterId, currentTurn, dotDamage);
        }
    }

    function getPhysicalDamageStats(bytes32 effectId)
        public
        view
        returns (PhysicalDamageStatsData memory _physicalDamageStats)
    {
        bytes32 statId = getEffectStatId(effectId);
        EffectsData memory effectsData = Effects.get(statId);
        require(
            effectsData.effectType == EffectType.PhysicalDamage && effectsData.effectExists, "Not Physical Damage type"
        );
        _physicalDamageStats = PhysicalDamageStats.get(statId);
    }

    function getMagicDamageStats(bytes32 effectId)
        public
        view
        returns (MagicDamageStatsData memory _magicDamageStats)
    {
        bytes32 statId = getEffectStatId(effectId);
        EffectsData memory effectsData = Effects.get(statId);
        require(effectsData.effectType == EffectType.MagicDamage && effectsData.effectExists, "Not Magic Damage type");
        _magicDamageStats = MagicDamageStats.get(statId);
    }

    function getStatusEffectStats(bytes32 effectId)
        public
        view
        returns (StatusEffectStatsData memory _statusEffectStats)
    {
        bytes32 statId = getEffectStatId(effectId);
        EffectsData memory effectsData = Effects.get(statId);
        require(effectsData.effectType == EffectType.StatusEffect && effectsData.effectExists, "Not Status Effect type");
        _statusEffectStats = StatusEffectStats.get(statId);
    }

    /**
     * @dev Separates an applied effect id into it's component parts
     */
    function getAppliedEffectInfo(bytes32 appliedEffectId)
        public
        pure
        returns (bytes32 _effectStatsId, uint256 _timestampApplied, uint256 _effectExpiredTime, uint256 _turnApplied)
    {
        _effectStatsId = getEffectStatId(appliedEffectId);
        _timestampApplied = getEffectTimestamp(appliedEffectId);
        _effectExpiredTime = getEffectExpired(appliedEffectId);
        _turnApplied = getEffectTurnApplied(appliedEffectId);
    }

    /**
     * @dev returns the base stat id stripped of extra info
     */
    function getEffectStatId(bytes32 effectId) public pure returns (bytes32 _effectStatsId) {
        return bytes32(bytes8(effectId));
    }

    /**
     * @dev takes the applied statId and gets the block it was applied
     */
    function getEffectTimestamp(bytes32 appliedEffectId) public pure returns (uint256 _timestampApplied) {
        _timestampApplied = uint256(uint64(bytes8(appliedEffectId << 16)));
    }

    /**
     * @dev takes the applied statId and gets the timestamp it was applied
     */
    function getEffectExpired(bytes32 appliedEffectId) public pure returns (uint256 _effectExpiredTimestamp) {
        _effectExpiredTimestamp = uint256(uint64(bytes8(appliedEffectId << 32)));
    }

    /**
     * @dev takes the applied statId and gets the turn it was applied
     */
    function getEffectTurnApplied(bytes32 appliedEffectId) public pure returns (uint256 _turnApplied) {
        _turnApplied = uint256(uint64(bytes8(appliedEffectId << 48)));
    }

    function _expireStatusEffect(bytes32 appliedEffectId) internal view returns (bytes32) {
        (bytes32 effectStatId, uint256 timestampApplied, uint256 expiredTime, uint256 turnApplied) =
            getAppliedEffectInfo(appliedEffectId);
        if (expiredTime == 0) {
            expiredTime = block.timestamp;
            return bytes32(
                abi.encodePacked(
                    bytes8(effectStatId),
                    bytes8(uint64(timestampApplied)),
                    bytes8(uint64(expiredTime)),
                    bytes8(uint64(turnApplied))
                )
            );
        } else {
            return appliedEffectId;
        }
    }
}
