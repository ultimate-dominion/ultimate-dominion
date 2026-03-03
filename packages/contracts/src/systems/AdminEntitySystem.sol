// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {NotAdmin, EntityNotAtPosition} from "../Errors.sol";
import {
    Stats,
    StatsData,
    Characters,
    Admin,
    EntitiesAtPosition,
    Position
} from "@codegen/index.sol";
import {IWorld} from "@world/IWorld.sol";

/**
 * @title AdminEntitySystem
 * @notice Admin functions for entity manipulation (move, remove, stats, effects, drops)
 * @dev Split from AdminSystem to reduce contract size
 */
contract AdminEntitySystem is System {
    modifier onlyAdmin() {
        if (!Admin.get(_msgSender())) revert NotAdmin();
        _;
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

    function adminRemoveEntity(bytes32 entityId) public onlyAdmin {
        IWorld(_world()).UD__removeEntityFromBoard(entityId);
    }

    function adminSetStats(bytes32 entityId, StatsData memory desiredStats) public onlyAdmin {
        Characters.setBaseStats(entityId, abi.encode(desiredStats));
        Stats.set(entityId, desiredStats);
    }

    function adminApplyStatusEffect(bytes32 entityId, bytes32 statusEffectId) public onlyAdmin {
        IWorld(_world()).UD__applyStatusEffect(entityId, statusEffectId);
    }

    function adminDropGold(bytes32 characterId, uint256 goldAmount) public onlyAdmin {
        IWorld(_world()).UD__dropGoldToPlayer(characterId, goldAmount);
    }

    function adminDropItem(bytes32 characterId, uint256 itemId, uint256 amount) public onlyAdmin {
        IWorld(_world()).UD__dropItem(characterId, itemId, amount);
    }
}
