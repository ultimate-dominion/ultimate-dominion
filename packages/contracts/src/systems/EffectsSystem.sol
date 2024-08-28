// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {
    RandomNumbers,
    EncounterEntity,
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
import {MonsterStats, NPCStats} from "@interfaces/Structs.sol";
import {_requireOwner, _requireAccess} from "../utils.sol";
import {UltimateDominionConfig} from "@codegen/index.sol";
import {DEFAULT_MAX_TURNS} from "../../constants.sol";

contract EffectsSystem is System {
    function createEffect(EffectType effectType, string memory name, bytes memory effectStats)
        public
        returns (bytes32 effectId)
    {
        _requireOwner(address(this), _msgSender());
        effectId = keccak256(abi.encode(name));

        require(!Effects.getEffectExists(effectId), "Effect already exists");

        if (effectType == EffectType.PhysicalAttack) {
            PhysicalDamageStatsData memory physicalStats = abi.decode(effectStats, (PhysicalDamageStatsData));
            PhysicalDamageStats.set(effectId, physicalStats);
        } else if (effectType == EffectType.MagicAttack) {
            MagicDamageStatsData memory magicStats = abi.decode(effectStats, (MagicDamageStatsData));
            MagicDamageStats.set(effectId, magicStats);
        } else if (effectType == EffectType.StatusEffect) {
            StatusEffectStatsData memory statusStats = abi.decode(effectStats, (StatusEffectStatsData));
            StatusEffectStats.set(effectId, statusStats);
        }
        Effects.set(effectId, effectType, true);
    }
}
