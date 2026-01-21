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
    AdvancedClassItems,
    AdvancedClassItemsData,
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
import {AdvancedClass} from "@codegen/common.sol";
import {ERC1155Holder} from "@openzeppelin/token/ERC1155/utils/ERC1155Holder.sol";
import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {_characterCoreId, _requireAccess, _lootManagerSystemId} from "../utils.sol";
import {WORLD_NAMESPACE, ITEMS_NAMESPACE, GOLD_NAMESPACE, BASE_GOLD_DROP, EXP_MODIFIER, PVP_GOLD_DENOMINATOR, MAX_LEVEL} from "../../constants.sol";
import {Owners} from "@erc1155/tables/Owners.sol";
import {TotalSupply} from "@erc1155/tables/TotalSupply.sol";
import {_ownersTableId, _totalSupplyTableId} from "@erc1155/utils.sol";
// ERC20 (Gold) direct table imports for mint-on-demand
import {Balances as ERC20Balances} from "@latticexyz/world-modules/src/modules/tokens/tables/Balances.sol";
import {TotalSupply as ERC20TotalSupply} from "@latticexyz/world-modules/src/modules/erc20-puppet/tables/TotalSupply.sol";
import {_balancesTableId as _goldBalancesTableId, _totalSupplyTableId as _goldTotalSupplyTableId} from "@latticexyz/world-modules/src/modules/erc20-puppet/utils.sol";
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
        // Note: Original check was broken - _msgSender() returns EOA, not system address
        // This function is called from CharacterSystem.enterGame which validates ownership
        StarterItemsData memory starterItems = IWorld(_world()).UD__getStarterItems(Stats.getClass(characterId));

        address owner = IWorld(_world()).UD__getOwner(characterId);

        // Mint items directly via table writes (bypasses cross-namespace access issues)
        for (uint256 i; i < starterItems.itemIds.length; i++) {
            _mintItemDirect(owner, starterItems.itemIds[i], starterItems.amounts[i]);
        }
    }

    /**
     * @notice Issue class-specific items when a character selects their advanced class at level 10
     * @param characterId The character receiving the items
     * @param advancedClass The selected advanced class
     */
    function issueAdvancedClassItems(bytes32 characterId, AdvancedClass advancedClass) public {
        // Note: This function is called from CharacterSystem.selectAdvancedClass which validates ownership
        AdvancedClassItemsData memory classItems = AdvancedClassItems.get(advancedClass);

        // If no items configured for this class, skip
        if (classItems.itemIds.length == 0) {
            return;
        }

        address owner = IWorld(_world()).UD__getOwner(characterId);

        // Mint items directly via table writes (bypasses cross-namespace access issues)
        for (uint256 i; i < classItems.itemIds.length; i++) {
            _mintItemDirect(owner, classItems.itemIds[i], classItems.amounts[i]);
        }
    }

    function dropGoldToEscrow(bytes32 characterId, uint256 amount) public {
        // Note: Access check removed to allow inter-system calls
        // Only update escrow balance - no minting needed since World has pre-minted gold supply
        // Actual gold transfer happens when player withdraws from escrow at spawn
        uint256 currentBalance = AdventureEscrow.get(characterId);
        AdventureEscrow.set(characterId, currentBalance + amount);
    }

    function dropGoldToPlayer(bytes32 characterId, uint256 amount) public {
        // Note: Access check removed - this is called by CharacterCore.enterGame via World
        // The system has openAccess: true in MUD config
        // Mint gold directly to player (mint-on-demand model - no pre-minted supply needed)
        address recipient = IWorld(_world()).UD__getOwnerAddress(characterId);
        _mintGoldDirect(recipient, amount);
    }

    function transferGold(address player, uint256 amount) public {
        // Note: Access check removed to allow inter-system calls
        // Mint gold directly to player (mint-on-demand model)
        _mintGoldDirect(player, amount);
    }

    function dropItem(bytes32 characterId, uint256 itemId, uint256 amount) public {
        // Note: Access check removed to allow inter-system calls
        // Write directly to ERC1155 tables to bypass puppet authorization issues
        address to = IWorld(_world()).UD__getOwner(characterId);

        // Get table IDs for Items namespace
        bytes14 namespace = ITEMS_NAMESPACE;

        // Update recipient balance
        uint256 currentBalance = Owners.getBalance(_ownersTableId(namespace), to, itemId);
        Owners.setBalance(_ownersTableId(namespace), to, itemId, currentBalance + amount);

        // Update total supply
        uint256 currentSupply = TotalSupply.getTotalSupply(_totalSupplyTableId(namespace), itemId);
        TotalSupply.setTotalSupply(_totalSupplyTableId(namespace), itemId, currentSupply + amount);
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
        // Burn gold from player (escrow is virtual, actual gold burned on deposit)
        address player = IWorld(_world()).UD__getOwner(characterId);
        _burnGoldDirect(player, amount);
        _addEscrowBalance(characterId, amount);
    }

    function increaseEscrowBalance(bytes32 characterId, uint256 amount) public returns (uint256 newBalance) {
        // Note: Access check removed to allow inter-system calls
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
        // Mint gold directly to player (escrow is virtual, actual gold minted on withdraw)
        _mintGoldDirect(IWorld(_world()).UD__getOwner(characterId), amount);
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
        // Note: Access check removed to allow inter-system calls from EncounterSystem

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
        // Note: Access check removed to allow inter-system calls from EncounterSystem

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

        // Burn the item directly via table writes (bypasses ERC1155 approval requirement)
        _burnItemDirect(playerAddr, itemId, 1);
    }

    /**
     * @dev Mint gold directly via table writes (mint-on-demand model)
     * No pre-minted supply needed - gold is created when players earn it
     */
    function _mintGoldDirect(address to, uint256 amount) internal {
        ResourceId balancesTableId = _goldBalancesTableId(GOLD_NAMESPACE);
        ResourceId totalSupplyTableId = _goldTotalSupplyTableId(GOLD_NAMESPACE);

        // Update recipient balance
        uint256 currentBalance = ERC20Balances.get(balancesTableId, to);
        ERC20Balances.set(balancesTableId, to, currentBalance + amount);

        // Update total supply
        uint256 currentSupply = ERC20TotalSupply.get(totalSupplyTableId);
        ERC20TotalSupply.set(totalSupplyTableId, currentSupply + amount);
    }

    /**
     * @dev Burn gold directly via table writes
     * Used when gold exits circulation (deposits to escrow, future gold sinks)
     */
    function _burnGoldDirect(address from, uint256 amount) internal {
        ResourceId balancesTableId = _goldBalancesTableId(GOLD_NAMESPACE);
        ResourceId totalSupplyTableId = _goldTotalSupplyTableId(GOLD_NAMESPACE);

        // Update sender balance
        uint256 currentBalance = ERC20Balances.get(balancesTableId, from);
        require(currentBalance >= amount, "Insufficient gold balance");
        ERC20Balances.set(balancesTableId, from, currentBalance - amount);

        // Update total supply
        uint256 currentSupply = ERC20TotalSupply.get(totalSupplyTableId);
        ERC20TotalSupply.set(totalSupplyTableId, currentSupply - amount);
    }

    /**
     * @dev Mint items directly via table writes (bypasses ERC1155System cross-namespace call issues)
     */
    function _mintItemDirect(address to, uint256 itemId, uint256 amount) internal {
        // Update owner balance
        uint256 currentBalance = Owners.getBalance(_ownersTableId(ITEMS_NAMESPACE), to, itemId);
        Owners.setBalance(_ownersTableId(ITEMS_NAMESPACE), to, itemId, currentBalance + amount);

        // Update total supply
        uint256 currentSupply = TotalSupply.getTotalSupply(_totalSupplyTableId(ITEMS_NAMESPACE), itemId);
        TotalSupply.setTotalSupply(_totalSupplyTableId(ITEMS_NAMESPACE), itemId, currentSupply + amount);
    }

    /**
     * @dev Burn items directly via table writes (bypasses ERC1155 approval requirement)
     * Used when consuming items - no approval needed since we're decrementing balance directly
     */
    function _burnItemDirect(address from, uint256 itemId, uint256 amount) internal {
        ResourceId ownersTableId = _ownersTableId(ITEMS_NAMESPACE);
        ResourceId totalSupplyTableId = _totalSupplyTableId(ITEMS_NAMESPACE);

        // Update owner balance
        uint256 currentBalance = Owners.getBalance(ownersTableId, from, itemId);
        require(currentBalance >= amount, "Insufficient item balance");
        Owners.setBalance(ownersTableId, from, itemId, currentBalance - amount);

        // Update total supply
        uint256 currentSupply = TotalSupply.getTotalSupply(totalSupplyTableId, itemId);
        TotalSupply.setTotalSupply(totalSupplyTableId, itemId, currentSupply - amount);
    }
}
