// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";
import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {NotAdmin, EntityNotAtPosition} from "../Errors.sol";
import {
    EncounterEntity,
    Stats,
    StatsData,
    Characters,
    CombatEncounter,
    CombatEncounterData,
    EncounterEntity,
    EncounterEntityData,
    Admin,
    EntitiesAtPosition,
    Position,
    UltimateDominionConfig
} from "@codegen/index.sol";
import {IWorld} from "@world/IWorld.sol";
import {ItemType, MobType, EffectType} from "@codegen/common.sol";

contract AdminSystem is System {
    modifier onlyAdmin() {
        if (!Admin.get(_msgSender())) revert NotAdmin();
        _;
    }

    function adminClearEncounterState(bytes32 entityId) public onlyAdmin {
        bytes32[] memory empty;
        EncounterEntity.setEncounterId(entityId, bytes32(0));
        EncounterEntity.setAppliedStatusEffects(entityId, empty);
        EncounterEntity.setPvpTimer(entityId, 0);
        EncounterEntity.setDied(entityId, false);
    }

    function adminSetCombatEncounter(bytes32 encounterId, CombatEncounterData memory encounterData) public onlyAdmin {
        CombatEncounter.set(encounterId, encounterData);
    }

    function adminSetEncounterEntity(bytes32 entityId, EncounterEntityData memory encounterEntityData)
        public
        onlyAdmin
    {
        EncounterEntity.set(entityId, encounterEntityData);
    }

    function setAdmin(address newAdmin, bool adminState) public onlyAdmin {
        Admin.set(newAdmin, adminState);
    }

    function setMaxPlayers(uint256 newMax) public onlyAdmin {
        UltimateDominionConfig.setMaxPlayers(newMax);
    }

    function adminDropGold(bytes32 characterId, uint256 goldAmount) public onlyAdmin {
        IWorld(_world()).UD__dropGoldToPlayer(characterId, goldAmount);
    }

    function adminDropItem(bytes32 characterId, uint256 itemId, uint256 amount) public onlyAdmin {
        IWorld(_world()).UD__dropItem(characterId, itemId, amount);
    }

    function adminSetStats(bytes32 entityId, StatsData memory desiredStats) public onlyAdmin {
        Characters.setBaseStats(entityId, abi.encode(desiredStats));
        Stats.set(entityId, desiredStats);
    }

    function adminRemoveEntity(bytes32 entityId) public onlyAdmin {
        IWorld(_world()).UD__removeEntityFromBoard(entityId);
    }

    function adminMoveEntity(bytes32 entityId, uint16 x, uint16 y) public onlyAdmin {
        (uint16 currentX, uint16 currentY) = IWorld(_world()).UD__getEntityPosition(entityId);
        bytes32[] memory entAtPos = IWorld(_world()).UD__getEntitiesAtPosition(currentX, currentY);
        bool entityWasAtPosition;
        for (uint256 i; i < entAtPos.length;) {
            if (entAtPos[i] == entityId) {
                entityWasAtPosition = true;
                bytes32 lastEnt = entAtPos[entAtPos.length - 1];
                EntitiesAtPosition.updateEntities(currentX, currentY, i, lastEnt);
                EntitiesAtPosition.popEntities(currentX, currentY);
                break;
            }
            {
                i++;
            }
        }
        if (!entityWasAtPosition) revert EntityNotAtPosition();
        Position.set(entityId, x, y);
        EntitiesAtPosition.pushEntities(x, y, entityId);
    }

    function getSystemAddress(ResourceId systemId) public view returns (address) {
        return Systems.getSystem(systemId);
    }

    function adminApplyStatusEffect(bytes32 entityId, bytes32 statusEffectId) public onlyAdmin {
        IWorld(_world()).UD__applyStatusEffect(entityId, statusEffectId);
    }

    // Admin functions for creating items post-deployment
    function adminCreateItem(
        ItemType itemType,
        uint256 supply,
        uint256 dropChance,
        uint256 price,
        uint256 rarity,
        bytes memory stats,
        string memory itemMetadataURI
    ) public onlyAdmin returns (uint256) {
        return IWorld(_world()).UD__createItem(itemType, supply, dropChance, price, rarity, stats, itemMetadataURI);
    }

    function adminCreateItems(
        ItemType[] memory itemTypes,
        uint256[] memory supply,
        uint256[] memory dropChances,
        uint256[] memory prices,
        uint256[] memory rarities,
        bytes[] memory stats,
        string[] memory itemMetadataURIs
    ) public onlyAdmin {
        IWorld(_world()).UD__createItems(itemTypes, supply, dropChances, prices, rarities, stats, itemMetadataURIs);
    }

    function adminResupplyLootManager(uint256 itemId, uint256 newSupply) public onlyAdmin {
        IWorld(_world()).UD__resupplyLootManager(itemId, newSupply);
    }

    // Admin functions for creating mobs post-deployment
    function adminCreateMob(MobType mobType, bytes memory stats, string memory mobMetadataUri) public onlyAdmin returns (uint256) {
        return IWorld(_world()).UD__createMob(mobType, stats, mobMetadataUri);
    }

    function adminCreateMobs(MobType[] memory mobTypes, bytes[] memory stats, string[] memory mobMetadataURIs) public onlyAdmin {
        IWorld(_world()).UD__createMobs(mobTypes, stats, mobMetadataURIs);
    }

    // Admin functions for creating effects post-deployment
    function adminCreateEffect(
        EffectType effectType,
        string memory name,
        bytes memory effectStats
    ) public onlyAdmin returns (bytes32) {
        return IWorld(_world()).UD__createEffect(effectType, name, effectStats);
    }

    // NOTE: setGlobalDropMultiplier and setGoldDropMultiplier removed —
    // UltimateDominionConfig schema is immutable on-chain. Needs separate DropConfig table.
}
