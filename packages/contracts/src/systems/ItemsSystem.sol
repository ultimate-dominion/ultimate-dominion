// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";
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
    Characters
} from "@codegen/index.sol";
import {ItemType, Classes} from "@codegen/common.sol";
import {AccessControlLib} from "@latticexyz/world-modules/src/utils/AccessControlLib.sol";
import {SystemRegistry} from "@latticexyz/world/src/codegen/tables/SystemRegistry.sol";
import {_erc1155SystemId, _characterSystemId} from "../utils.sol";
import {ITEMS_NAMESPACE} from "../../constants.sol";
import {WeaponStats} from "@interfaces/Structs.sol";
import {TotalSupply} from "@erc1155/tables/TotalSupply.sol";
import {ERC1155URIStorage} from "@erc1155/tables/ERC1155URIStorage.sol";
import {ERC1155MetadataURI} from "@erc1155/tables/ERC1155MetadataURI.sol";
import {ERC1155System} from "@erc1155/ERC1155System.sol";
import {
    _metadataTableId,
    _erc1155URIStorageTableId,
    _totalSupplyTableId,
    _operatorApprovalTableId,
    _ownersTableId
} from "@erc1155/utils.sol";
import "forge-std/console2.sol";

contract ItemsSystem is ERC1155System {
    function _items() internal view returns (IERC1155System items) {
        items = IERC1155System(UltimateDominionConfig.getItems());
    }

    function createItem(ItemType itemType, uint256 supply, string memory itemMetadataURI, bytes memory stats)
        public
        returns (uint256)
    {
        requireOwner();
        uint256 itemId = _incrementItemsCounter();
        IWorld(_world()).call(
            _erc1155SystemId(ITEMS_NAMESPACE),
            abi.encodeWithSignature("mint(address,uint256,uint256,bytes)", address(this), itemId, supply, "")
        );

        _setTokenUri(ITEMS_NAMESPACE, itemId, itemMetadataURI);
        Items.set(itemId, itemType, stats);

        return itemId;
    }

    function getTotalSupply(uint256 tokenId) public view returns (uint256 _supply) {
        _supply = TotalSupply.getTotalSupply(_totalSupplyTableId(ITEMS_NAMESPACE), tokenId);
    }

    function issueStarterItems(uint256 characterId) public {
        require(_msgSender() == Systems.getSystem(_characterSystemId("UD")), "ITEMS: Invalid System");
        StarterItemsData memory starterItems = StarterItems.get(Characters.getClass(characterId));

        address owner = IWorld(_world()).UD__getOwner(characterId);

        for (uint256 i; i < starterItems.itemIds.length; i++) {
            _items().transferFrom(address(this), owner, starterItems.itemIds[i], starterItems.amounts[i]);
        }
    }

    function setTokenUri(uint256 tokenId, string memory tokenUri) public {
        requireOwner();
        _setTokenUri(ITEMS_NAMESPACE, tokenId, tokenUri);
    }

    function _incrementItemsCounter() internal returns (uint256) {
        address itemsContract = UltimateDominionConfig.getItems();
        uint256 itemsCounter = Counters.getCounter(address(itemsContract));
        Counters.setCounter(itemsContract, (itemsCounter + 1));
        return itemsCounter;
    }

    function requireOwner() internal view {
        AccessControlLib.requireOwner(SystemRegistry.get(address(this)), _msgSender());
    }

    function getWeaponStats(uint256 itemId) public view returns (WeaponStats memory _weaponStats) {
        ItemsData memory _data = Items.get(itemId);
        require(_data.itemType == ItemType.Weapon, "ITEMS: Not a  weapon");
        _weaponStats = abi.decode(_data.stats, (WeaponStats));
    }

    function setStarterItems(Classes class, uint256[] memory itemIds, uint256[] memory amounts) public {
        requireOwner();
        require(itemIds.length == amounts.length, "ITEMS: Length mismatch");
        StarterItems.set(class, itemIds, amounts);
    }

    // function getArmourStats(uint256 itemId)public view returns(){}
    // function getPotionStats(uint256 itemId)public view returns(){}
    // function getScrollStats(uint256 itemId)public view returns(){}
    // function getMaterialStats(uint256 itemId)public view returns(){}
}
