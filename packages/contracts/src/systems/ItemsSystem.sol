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
import {_erc1155SystemId, _characterSystemId, _requireOwner} from "../utils.sol";
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

contract ItemsSystem is System {
    function _items() internal view returns (IERC1155System items) {
        items = IERC1155System(UltimateDominionConfig.getItems());
    }

    function createItem(ItemType itemType, uint256 supply, bytes memory stats, string memory itemMetadataURI)
        public
        returns (uint256)
    {
        uint256 itemId = _incrementItemsCounter();
        IWorld(_world()).call(
            _erc1155SystemId(ITEMS_NAMESPACE),
            abi.encodeWithSignature("mint(address,uint256,uint256,bytes)", address(this), itemId, supply, "")
        );

        setTokenUri(itemId, itemMetadataURI);
        Items.set(itemId, itemType, stats);

        return itemId;
    }

    function createItems(
        ItemType[] memory itemTypes,
        uint256[] memory supply,
        bytes[] memory stats,
        string[] memory itemMetadataURIs
    ) public {
        uint256 len = itemTypes.length;
        require(
            supply.length == len && itemMetadataURIs.length == len && stats.length == len,
            "ITEMS: Array length mismatch"
        );
        for (uint256 i; i < len; i++) {
            createItem(itemTypes[i], supply[i], stats[i], itemMetadataURIs[i]);
        }
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
        _requireOwner(address(this), _msgSender());
        ERC1155URIStorage.setUri(_erc1155URIStorageTableId(ITEMS_NAMESPACE), tokenId, tokenUri);
    }

    function _incrementItemsCounter() internal returns (uint256) {
        address itemsContract = UltimateDominionConfig.getItems();
        uint256 itemsCounter = Counters.getCounter(address(itemsContract)) + 1;
        Counters.setCounter(itemsContract, (itemsCounter));
        return itemsCounter;
    }

    function getWeaponStats(uint256 itemId) public view returns (WeaponStats memory _weaponStats) {
        ItemsData memory _data = Items.get(itemId);
        require(_data.itemType == ItemType.Weapon, "ITEMS: Not a  weapon");
        _weaponStats = abi.decode(_data.stats, (WeaponStats));
    }

    function setStarterItems(Classes class, uint256[] memory itemIds, uint256[] memory amounts) public {
        _requireOwner(address(this), _msgSender());
        require(itemIds.length == amounts.length, "ITEMS: Length mismatch");
        StarterItems.set(class, itemIds, amounts);
    }

    function requireOwnerOf(uint256 itemId, address account) internal view returns (bool) {
        return Owners.getBalance(_ownersTableId(ITEMS_NAMESPACE), account, itemId) > 0;
    }

    // function getArmourStats(uint256 itemId)public view returns(){}
    // function getPotionStats(uint256 itemId)public view returns(){}
    // function getScrollStats(uint256 itemId)public view returns(){}
    // function getMaterialStats(uint256 itemId)public view returns(){}
}
