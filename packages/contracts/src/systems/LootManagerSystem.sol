// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";
import {IERC20System} from "@latticexyz/world-modules/src/interfaces/IERC20System.sol";
import {IWorld} from "@world/IWorld.sol";
import {IERC1155System} from "@erc1155/IERC1155System.sol";
import {IERC1155Receiver} from "@erc1155/IERC1155Receiver.sol";
import {
    UltimateDominionConfig,
    Items,
    ItemsData,
    Counters,
    StarterItems,
    StarterItemsData,
    Characters,
    CharactersData,
    Stats,
    StatsData,
    CharacterEquipment,
    CharacterEquipmentData,
    CombatEncounter,
    CombatEncounterData,
    Mobs,
    EncounterEntity
} from "@codegen/index.sol";
import {ItemType, Classes} from "@codegen/common.sol";
import {AccessControlLib} from "@latticexyz/world-modules/src/utils/AccessControlLib.sol";
import {SystemRegistry} from "@latticexyz/world/src/codegen/tables/SystemRegistry.sol";
import {
    _erc1155SystemId,
    _characterSystemId,
    _requireOwner,
    _requireAccess,
    _combatSystemId,
    _lootManagerSystemId
} from "../utils.sol";
import {ITEMS_NAMESPACE, WORLD_NAMESPACE, BASE_GOLD_DROP} from "../../constants.sol";
import {WeaponStats, ArmorStats, MonsterStats, RewardDistributionTemps} from "@interfaces/Structs.sol";
import {
    _metadataTableId,
    _erc1155URIStorageTableId,
    _totalSupplyTableId,
    _operatorApprovalTableId,
    _ownersTableId
} from "@erc1155/utils.sol";
import "forge-std/console2.sol";

contract LootManagerSystem is System {
    // all items and gold will be managed by this system.  ownership of both contracts will be on this system and permissions
    // distribute will be managed here.

    function _goldToken() internal view returns (IERC20System goldToken) {
        goldToken = IERC20System(UltimateDominionConfig.getGoldToken());
    }

    function issueStarterItems(bytes32 characterId) public {
        require(_msgSender() == Systems.getSystem(_characterSystemId(WORLD_NAMESPACE)), "ITEMS: Invalid System");
        StarterItemsData memory starterItems = IWorld(_world()).UD__getStarterItems(Stats.getClass(characterId));

        address owner = IWorld(_world()).UD__getOwner(characterId);

        for (uint256 i; i < starterItems.itemIds.length; i++) {
            IERC1155System(UltimateDominionConfig.getItems()).safeTransferFrom(
                address(this), owner, starterItems.itemIds[i], starterItems.amounts[i], ""
            );
        }
    }

    function dropGold(bytes32 characterId, uint256 amount) public {
        AccessControlLib.requireAccess(_lootManagerSystemId(WORLD_NAMESPACE), _msgSender());
        _goldToken().mint(IWorld(_world()).UD__getOwner(characterId), amount);
    }

    function dropItem(bytes32 characterId, uint256 itemId, uint256 amount) public {
        AccessControlLib.requireAccess(_lootManagerSystemId(WORLD_NAMESPACE), _msgSender());
        address to = IWorld(_world()).UD__getOwner(characterId);
        IERC1155System(UltimateDominionConfig.getItems()).transferFrom(address(this), to, itemId, amount);
    }

    function dropItems(bytes32[] memory characterIds, uint256[] memory itemIds, uint256[] memory amounts) public {
        for (uint256 i; i < itemIds.length; i++) {
            dropItem(characterIds[i], itemIds[i], amounts[i]);
        }
    }

    function _calculateGoldDrop(uint256 mobLevel, uint256 randomNumber) internal view returns (uint256 dropAmount) {
        this; // silence state mutability warning without generating bytecode - see https://github.com/ethereum/solidity/issues/2691
        // Calculate level-based drop
        dropAmount = randomNumber % (BASE_GOLD_DROP * mobLevel);
    }

    function _calculateItemDrop(uint256 randomNumber, bytes32 entityId, bytes32 characterId)
        internal
        returns (uint256[] memory)
    {
        console2.log("Calculating item drop");
        uint256 mobId = IWorld(_world()).UD__getMobId(entityId);
        MonsterStats memory monsterStats = abi.decode(Mobs.getMobStats(mobId), (MonsterStats));

        uint256[] memory itemIdsDropped = new uint256[](monsterStats.inventory.length);
        uint256 totalItemsDropped;
        uint256 tempItemId;
        // drop items
        for (uint256 i; i < monsterStats.inventory.length; i++) {
            tempItemId = monsterStats.inventory[i];
            uint256 dropChance = Items.getDropChance(tempItemId);
            console2.log("drop calc", randomNumber % 100_000_000 < dropChance);
            if (randomNumber % 100_000_000 < dropChance) {
                console2.log("ITEM DROPPED", tempItemId);
                IWorld(_world()).UD__dropItem(characterId, tempItemId, 1);
                itemIdsDropped[i] = tempItemId;
                totalItemsDropped++;
            }
        }

        // trim array down to just dropped item Ids.
        uint256[] memory itemsDropped = new uint256[](totalItemsDropped);
        if (totalItemsDropped > 0) {
            uint256 itemsAdded;
            for (uint256 i; i < itemIdsDropped.length;) {
                if (itemIdsDropped[i] != 0) {
                    itemsDropped[itemsAdded] = itemIdsDropped[i];
                    itemsAdded++;
                }
                if (itemsAdded == totalItemsDropped) break;
                {
                    i++;
                }
            }
        }
        return itemsDropped;
    }

    function distributePvpRewards(bytes32 encounterId, uint256 randomNumber)
        public
        returns (uint256 _expAmount, uint256 _goldAmount, uint256[] memory _itemIdsDropped)
    {
        _requireAccess(address(this), _msgSender());
    }

    function distributePveRewards(bytes32 encounterId, uint256 randomNumber)
        public
        returns (uint256 _expAmount, uint256 _goldAmount, uint256[] memory _itemIdsDropped)
    {
        _requireAccess(address(this), _msgSender());

        CombatEncounterData memory encounterData = CombatEncounter.get(encounterId);
        RewardDistributionTemps memory distTemps;
        require(encounterData.end != 0 && encounterData.rewardsDistributed == false, "Invalid Encounter");

        // check dead attackers and defenders
        StatsData memory statsTemp;

        if (encounterData.attackersAreMobs) {
            distTemps.monsters = encounterData.attackers;
            distTemps.players = encounterData.defenders;
        } else {
            distTemps.players = encounterData.attackers;
            distTemps.monsters = encounterData.defenders;
        }
        for (uint256 i; i < distTemps.players.length; i++) {
            statsTemp = Stats.get(distTemps.players[i]);
            distTemps.cumulativeAttackerLevels += statsTemp.level;
            if (statsTemp.currentHp > 0) {
                distTemps.livingPlayers++;
            }
        }

        // if cumulative attacker levels is >= 5 levels above the monster level no gold reward.
        //  for this calculation level is calculated from exp not from actual leveled levels

        bytes[] memory itemsDroppedTemp = new bytes[](distTemps.monsters.length);

        for (uint256 i; i < distTemps.monsters.length; i++) {
            distTemps.defenderTemp = distTemps.monsters[i];
            distTemps.defenderLevelTemp = Stats.getLevel(distTemps.defenderTemp);
            bool correctLevelSpread = distTemps.defenderLevelTemp > distTemps.cumulativeAttackerLevels
                ? true
                : (distTemps.cumulativeAttackerLevels - distTemps.defenderLevelTemp) <= 5;

            if (EncounterEntity.getDied(distTemps.defenderTemp) && correctLevelSpread) {
                _expAmount += Stats.getExperience(distTemps.defenderTemp);
                _goldAmount += _calculateGoldDrop(statsTemp.level, randomNumber);
                EncounterEntity.setEncounterId(distTemps.defenderTemp, bytes32(0));

                // get dropped items into temporary array

                _itemIdsDropped = _calculateItemDrop(
                    randomNumber, distTemps.defenderTemp, distTemps.players[randomNumber % distTemps.players.length]
                );
            }
        }

        // drop gold reward calculated from the level of mob to player journey wallet (can mint tokens when he returns to 0,0).
        // if dead player, drop transfer 50% of un-banked gold to world contract note this isn't happening here
        // distribute loot

        for (uint256 i; i < distTemps.players.length; i++) {
            distTemps.entityIdTemp = distTemps.players[i];
            if (IWorld(_world()).UD__isValidCharacterId(distTemps.entityIdTemp)) {
                statsTemp = Stats.get(distTemps.entityIdTemp);
                if (statsTemp.currentHp > int256(0)) {
                    if (_goldAmount > uint256(0)) {
                        IWorld(_world()).UD__dropGold(distTemps.entityIdTemp, (_goldAmount / distTemps.livingPlayers));
                    }
                    if (_expAmount > uint256(0) && distTemps.livingPlayers > uint256(0)) {
                        statsTemp.experience += _expAmount / distTemps.livingPlayers;
                    }
                }
                Stats.set(distTemps.entityIdTemp, statsTemp);
            }
        }
        CombatEncounter.setRewardsDistributed(encounterId, true);
    }

    function _trimDroppedItemIds(uint256 totalItemsDropped, bytes[] memory itemsDropped)
        internal
        returns (uint256[] memory _droppedItemIds)
    {
        // trim down encoded bytes array into dropped item ids
        _droppedItemIds = new uint256[](totalItemsDropped);
        uint256 itemsWritten;
        for (uint256 i; i < itemsDropped.length;) {
            if (itemsDropped[i].length != 0) {
                uint256[] memory tempItems = abi.decode(itemsDropped[i], (uint256[]));
                for (uint256 j; j < tempItems.length; j++) {
                    _droppedItemIds[itemsWritten] = tempItems[j];
                    itemsWritten++;
                }
            }
            if (itemsWritten == totalItemsDropped) break;
            {
                i++;
            }
        }
    }
}
