// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";
import {IERC20Mintable} from "@latticexyz/world-modules/src/modules/erc20-puppet/IERC20Mintable.sol";
import {IWorld} from "@world/IWorld.sol";
import {IERC1155System} from "@erc1155/IERC1155System.sol";
import {WorldContextConsumer} from "@latticexyz/world/src/WorldContext.sol";
import {Math, WAD, RAD} from "@libraries/Math.sol";
import {
    UltimateDominionConfig,
    Items,
    ItemsData,
    StarterItems,
    StarterItemsData,
    Characters,
    Stats,
    Levels,
    StatsData,
    CharacterEquipment,
    CombatEncounter,
    CombatEncounterData,
    Mobs,
    EncounterEntity,
    AdventureEscrow
} from "@codegen/index.sol";
import {ERC1155Holder} from "@openzeppelin/token/ERC1155/utils/ERC1155Holder.sol";
import {_characterSystemId, _requireAccess, _lootManagerSystemId} from "../utils.sol";
import {WORLD_NAMESPACE, BASE_GOLD_DROP, EXP_MODIFIER, PVP_GOLD_DENOMINATOR, MAX_LEVEL} from "../../constants.sol";
import {MonsterStats, RewardDistributionTemps} from "@interfaces/Structs.sol";

import "forge-std/console.sol";

contract LootManagerSystem is ERC1155Holder, System {
    function supportsInterface(bytes4 interfaceId)
        public
        pure
        virtual
        override(ERC1155Holder, WorldContextConsumer)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
    // all items and gold will be managed by this system.  ownership of both contracts will be on this system and permissions
    // distribute will be managed here.

    function _goldToken() internal view returns (IERC20Mintable goldToken) {
        goldToken = IERC20Mintable(UltimateDominionConfig.getGoldToken());
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

    function dropGoldToEscrow(bytes32 characterId, uint256 amount) public {
        _requireAccess(address(this), _msgSender());
        uint256 currentBalance = AdventureEscrow.get(characterId);
        AdventureEscrow.set(characterId, currentBalance + amount);
        _goldToken().mint(address(this), amount);
    }

    function dropGoldToPlayer(bytes32 characterId, uint256 amount) public {
        _requireAccess(address(this), _msgSender());
        _goldToken().mint(IWorld(_world()).UD__getOwnerAddress(characterId), amount);
    }

    function transferGold(address player, uint256 amount) public {
        _requireAccess(address(this), _msgSender());
        _goldToken().transfer(player, amount);
    }

    function dropItem(bytes32 characterId, uint256 itemId, uint256 amount) public {
        _requireAccess(address(this), _msgSender());
        address to = IWorld(_world()).UD__getOwner(characterId);
        IERC1155System(UltimateDominionConfig.getItems()).safeTransferFrom(address(this), to, itemId, amount, "");
    }

    function dropItems(bytes32[] memory characterIds, uint256[] memory itemIds, uint256[] memory amounts) public {
        for (uint256 i; i < itemIds.length; i++) {
            dropItem(characterIds[i], itemIds[i], amounts[i]);
        }
    }

    function depositToEscrow(bytes32 characterId, uint256 amount) public returns (uint256 _balance) {
        if (IWorld(_world()).UD__isValidOwner(characterId, _msgSender())) {
            require(IWorld(_world()).UD__isAtPosition(characterId, 0, 0), "can only deposit at spawn");
        } else {
            _requireAccess(address(this), _msgSender());
        }
        // transfer gold to loot manager
        _goldToken().transferFrom(IWorld(_world()).UD__getOwner(characterId), address(this), amount);
        _addEscrowBalance(characterId, amount);
    }

    function increaseEscrowBalance(bytes32 characterId, uint256 amount) public returns (uint256 newBalance) {
        _requireAccess(address(this), _msgSender());
        _addEscrowBalance(characterId, amount);
    }

    function _addEscrowBalance(bytes32 characterId, uint256 amount) internal {
        uint256 currentBalance = getEscrowBalance(characterId);
        uint256 balance = currentBalance + amount;
        AdventureEscrow.set(characterId, (balance));
    }

    function withdrawFromEscrow(bytes32 characterId, uint256 amount) public returns (uint256 _balance) {
        if (IWorld(_world()).UD__isValidOwner(characterId, _msgSender())) {
            require(IWorld(_world()).UD__isAtPosition(characterId, 0, 0), "can only withdraw at spawn");
        } else {
            _requireAccess(address(this), _msgSender());
        }
        _withdrawEscrowBalance(characterId, amount);
        // transfer gold to player
        _goldToken().transfer(IWorld(_world()).UD__getOwner(characterId), amount);
    }

    function _withdrawEscrowBalance(bytes32 characterId, uint256 amount) internal {
        uint256 currentBalance = getEscrowBalance(characterId);
        require(currentBalance >= amount, "not enough gold in escrow");
        uint256 balance = currentBalance - amount;
        AdventureEscrow.set(characterId, (balance));
    }

    function getEscrowBalance(bytes32 characterId) public view returns (uint256 _balance) {
        return AdventureEscrow.get(characterId);
    }

    function _calculateGoldDrop(uint256 mobLevel, uint256 randomNumber) internal view returns (uint256 dropAmount) {
        this; // silence state mutability warning without generating bytecode - see https://github.com/ethereum/solidity/issues/2691
        // Calculate level-based drop
        dropAmount = (randomNumber % (BASE_GOLD_DROP * mobLevel)) + 0.05 ether;
    }

    function _calculateItemDrop(uint256 randomNumber, bytes32 entityId, bytes32 characterId)
        internal
        returns (uint256[] memory)
    {
        uint256 mobId = IWorld(_world()).UD__getMobId(entityId);
        MonsterStats memory monsterStats = abi.decode(Mobs.getMobStats(mobId), (MonsterStats));

        uint256[] memory itemIdsDropped = new uint256[](monsterStats.inventory.length);
        uint256 totalItemsDropped;
        uint256 tempItemId;
        // drop items
        for (uint256 i; i < monsterStats.inventory.length; i++) {
            tempItemId = monsterStats.inventory[i];
            uint256 dropChance = Items.getDropChance(tempItemId);
            if (randomNumber % 100_000_000 < (dropChance * 1000000)) {
                console.log("ITEM DROPPED", tempItemId);
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

        CombatEncounterData memory encounterData = CombatEncounter.get(encounterId);
        RewardDistributionTemps memory distTemps;
        require(encounterData.end != 0 && encounterData.rewardsDistributed == false, "Invalid Encounter");
        // distribute 100% of gold in losers adventure escrow
        bool attackersWin;
        uint256 deadAttackers;
        uint256 deadDefenders;
        for (uint256 i; i < encounterData.defenders.length; i++) {
            if (EncounterEntity.getDied(encounterData.defenders[i])) deadDefenders++;
        }
        if (deadDefenders == encounterData.defenders.length) attackersWin = true;

        if (attackersWin) {
            // distribute defender's escrow gold
            for (uint256 i; i < encounterData.defenders.length; i++) {
                uint256 currentBalance = AdventureEscrow.get(encounterData.defenders[i]);
                uint256 toDistribute = currentBalance / PVP_GOLD_DENOMINATOR;
                _goldAmount += toDistribute;
                AdventureEscrow.set(encounterData.defenders[i], (currentBalance - toDistribute));
            }
            // distribute defender's escrow gold
            for (uint256 i; i < encounterData.attackers.length; i++) {
                uint256 currentBalance = AdventureEscrow.get(encounterData.attackers[i]);
                uint256 toDistribute = _goldAmount / encounterData.attackers.length;
                AdventureEscrow.set(encounterData.attackers[i], (currentBalance + toDistribute));
            }
        } else {
            // distribute attackers gold
            // distribute defender's escrow gold
            for (uint256 i; i < encounterData.attackers.length; i++) {
                uint256 currentBalance = AdventureEscrow.get(encounterData.attackers[i]);
                uint256 toDistribute = currentBalance / PVP_GOLD_DENOMINATOR;
                _goldAmount += toDistribute;
                AdventureEscrow.set(encounterData.attackers[i], (currentBalance - toDistribute));
            }
            // distribute defender's escrow gold
            for (uint256 i; i < encounterData.defenders.length; i++) {
                uint256 currentBalance = AdventureEscrow.get(encounterData.defenders[i]);
                uint256 toDistribute = _goldAmount / encounterData.defenders.length;
                AdventureEscrow.set(encounterData.defenders[i], (currentBalance + toDistribute));
            }
        }
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

        // if cumulative attacker levels is >= 5 levels above the monster level no gold reward.
        //  for this calculation level is calculated from exp not from actual leveled levels

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

                // get dropped items into temporary array
                bytes32 playerToDropTo = distTemps.players[randomNumber % distTemps.players.length];

                // if player is still alive drop item
                if (!EncounterEntity.getDied(playerToDropTo)) {
                    _itemIdsDropped = _calculateItemDrop(randomNumber, distTemps.monsterTemp, playerToDropTo);
                }
            }
        }

        // drop gold reward calculated from the level of mob to player journey escrow (can mint tokens when he returns to 0,0).
        // if dead player, drop transfer 50% of un-banked gold to world contract note this isn't happening here
        // distribute loot

        for (uint256 i; i < distTemps.players.length; i++) {
            distTemps.entityIdTemp = distTemps.players[i];
            if (IWorld(_world()).UD__isValidCharacterId(distTemps.entityIdTemp)) {
                statsTemp = Stats.get(distTemps.entityIdTemp);
                if (statsTemp.currentHp > int256(0)) {
                    if (_goldAmount > uint256(0)) {
                        dropGoldToEscrow(distTemps.entityIdTemp, (_goldAmount / distTemps.livingPlayers));
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
        uint256 escrowBalance = getEscrowBalance(characterId);
        _expMultiplier = ((Math.sqrt(escrowBalance) * 1e8) / (EXP_MODIFIER)) + WAD;
    }

    function _trimDroppedItemIds(uint256 totalItemsDropped, bytes[] memory itemsDropped)
        internal
        pure
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

    function setGoldApproval(address spender, uint256 value) public {
        _requireAccess(address(this), _msgSender());
        _goldToken().approve(spender, value);
    }

    function setItemsApproval(address spender, bool approval) public {
        _requireAccess(address(this), _msgSender());
        IERC1155System(UltimateDominionConfig.getItems()).setApprovalForAll(spender, approval);
    }

    function consumeItem(bytes32 characterId, uint256 itemId) public {
        address playerAddr = IWorld(_world()).UD__getOwnerAddress(characterId);
        if (_msgSender() == playerAddr) {
            // consoom
        } else {
            _requireAccess(address(this), _msgSender());
        }

        // address lootManager = Systems.getSystem(_lootManagerSystemId(WORLD_NAMESPACE));
        //will require approval
        IERC1155System(UltimateDominionConfig.getItems()).safeTransferFrom(playerAddr, address(this), itemId, 1, "");
    }
}
