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
    StatusEffectStatsData
} from "@codegen/index.sol";
import {IWorld} from "@world/IWorld.sol";
import {RngRequestType, MobType, EncounterType, EffectType, Classes} from "@codegen/common.sol";
import {Counters} from "@tables/Counters.sol";
import {Mobs, MobsData} from "@tables/Mobs.sol";
import {MonsterStats, AdjustedCombatStats} from "@interfaces/Structs.sol";
import {_requireOwner, _requireAccess} from "../utils.sol";
import {UltimateDominionConfig} from "@codegen/index.sol";
import {DEFAULT_MAX_TURNS} from "../../constants.sol";

contract EffectsSystem is System {
    function createEffect(EffectType effectType, string memory name, bytes memory effectStats)
        public
        returns (bytes32 effectStatsId)
    {
        _requireOwner(address(this), _msgSender());
        effectStatsId = keccak256(abi.encode(name));

        require(!Effects.getEffectExists(effectId), "Effect already exists");

        if (effectType == EffectType.PhysicalDamage) {
            PhysicalDamageStatsData memory physicalStats = abi.decode(effectStats, (PhysicalDamageStatsData));
            PhysicalDamageStats.set(effectId, physicalStats);
        } else if (effectType == EffectType.MagicDamage) {
            MagicDamageStatsData memory magicStats = abi.decode(effectStats, (MagicDamageStatsData));
            MagicDamageStats.set(effectId, magicStats);
        } else if (effectType == EffectType.StatusEffect) {
            StatusEffectStatsData memory statusStats = abi.decode(effectStats, (StatusEffectStatsData));
            StatusEffectStats.set(effectId, statusStats);
        }
        Effects.set(effectId, effectType, true);
    }

    function applyStatusEffect(bytes32 entityId, bytes32 effectId)
        public
        view
        returns (AdjustedCombatStats memory _fullyAdjustedStats, int256 appliableDamage)
    {
        require(bytes32(bytes8(effectId)) == effectId, "effect already applied");
        StatusEffectsData memory effectId = getStatusEffectStats(effectId);
    }

    function checkAppliedEffects(bytes32 entityId) public {
        EncounterEntityData memory encounterEntity = EncounterEntity.get(entityId);
        if(encounterEntity.encounterId != bytes32(0)){
            if(encounterEntity.died && encounterEntity.appliedEffects.length > 0){
                // if character is in an encounter and dead, remove applied effects
                encounterEntity.appliedEffects = new bytes32[](0);
            }
            if(!encounterEntity.died && encounterEntity.appliedEffects.length > 0) {
                //if character is in active combat with applied effects, check for expired effects and eliminate them
                bytes32 appliedEffect;
                for(uint256 i; i < encounterEntity.appliedEffects.length; i++){
                    appliedEffect = encounterEntity.appliedEffects[i];
                    if(CombatEncounter.getCurrentTurn(encounterEntity.encounterId) - getEffectTurnApplied(appliedEffect) >= StatusEffectStats.getValidTurns(getEffectStatId(appliedEffect))){
                        // if array is longer than 1, move to end of array and pop.
                        if(encounterEntity.appliedEffects.length > 1){
                            
                        }
                    }
                }
            } 
        } else {

        }
    }

    function getPhysicalDamageStats(bytes32 effectId)
        public
        view
        returns (PhysicalDamageStatsData memory _physicalDamageStats)
    {
        bytes32 statId = getEffectStatId(effectId);
        EffectsData memory effectData = Effects.get(statId);
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
        EffectsData memory effectData = Effects.get(statId);
        require(effectsData.effectType == EffectType.MagicDamage && effectsData.effectExists, "Not Magic Damage type");
        _magicDamageStats = MagicDamageStats.get(statId);
    }

    function getStatusEffectStats(bytes32 effectId)
        public
        view
        returns (StatusEffectStatsData memory _statusEffectStats)
    {
        bytes32 statId = getEffectStatId(effectId);
        EffectsData memory effectData = Effects.get(statId);
        require(effectsData.effectType == EffectType.StatusEffect && effectsData.effectExists, "Not Status Effect type");
        _statusEffectStats = StatusEffectStats.get(statId);
    }

    /** @dev Separates an applied effect id into it's component parts */
    function getAppliedEffectInfo(bytes32 appliedEffectId)public view returns(bytes32 _effectStatsId, uint256 _blockApplied, uint256 _timestampApplied, uint256 _turnApplied){
        _effectStatsId = getEffectStatId(appliedEffectId);
        _blockApplied = getEffectBlockApplied(appliedEffectId);
        _timestampApplied = getEffectTimestamp(appliedEffectId);
        _turnApplied = getEffectTurnApplied(appliedEffectId);.
    }
    
    /** @dev returns the base stat id stripped of extra info */
    function getEffectStatId(bytes32 effectId) public view returns(bytes32 _effectStatsId){
        return bytes32(bytes8(effectId));
    }

    /** @dev takes the applied statId and gets the block it was applied */
    function getEffectBlockApplied(bytes32 appliedEffectId) public view returns( uint256 _blockApplied){
        _blockApplied = uint256(uint64(bytes8(appliedEffectId << 16)));
    }

    /** @dev takes the applied statId and gets the timestamp it was applied */
    function getEffectTimestamp(bytes32 appliedEffectId)public view returns(uint256 _timestampApplied){
        _timestampApplied = uint256(uint64(bytes8(appliedEffectId << 32)));
    }

    /** @dev takes the applied statId and gets the turn it was applied */
    function getEffectTurnApplied(bytes32 appliedEffectId) public view returns(uint256 _turnApplied){
        _turnApplied = uint256(uint64(bytes8(appliedEffectId << 48)));
    }
}
