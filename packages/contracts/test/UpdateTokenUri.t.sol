// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {IWorld} from "@codegen/world/IWorld.sol";
import {TokenURI} from "@latticexyz/world-modules/src/modules/erc721-puppet/tables/TokenURI.sol";
import {WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_TABLE} from "@latticexyz/store/src/storeResourceTypes.sol";
import {Characters} from "@codegen/index.sol";
import {CHARACTERS_NAMESPACE} from "../constants.sol";
import {Unauthorized, InvalidTokenUri} from "../src/Errors.sol";

contract Test_UpdateTokenUri is Test {
    using stdJson for string;

    address deployer = vm.addr(vm.envUint("PRIVATE_KEY"));
    address payable public alice;
    address payable public bob;
    uint256 public userNonce = 0;

    IWorld public world;
    address public worldAddress;

    bytes32 public aliceCharacterId;

    function setUp() public {
        vm.deal(deployer, 100 ether);
        vm.startPrank(deployer);
        worldAddress = vm.envAddress("WORLD_ADDRESS");
        StoreSwitch.setStoreAddress(worldAddress);
        world = IWorld(worldAddress);
        vm.stopPrank();

        alice = _getUser();
        bob = _getUser();
        vm.label(alice, "alice");
        vm.label(bob, "bob");

        vm.prank(alice);
        aliceCharacterId = world.UD__mintCharacter(alice, bytes32("Alice"), "ipfs://original");
    }

    function _getUser() internal returns (address payable) {
        address payable user = payable(address(uint160(uint256(keccak256(abi.encodePacked(userNonce++))))));
        vm.deal(user, 100 ether);
        return user;
    }

    function _getTokenUri(bytes32 characterId) internal view returns (string memory) {
        uint256 tokenId = Characters.getTokenId(characterId);
        return TokenURI.get(
            WorldResourceIdLib.encode(RESOURCE_TABLE, CHARACTERS_NAMESPACE, "TokenURI"),
            tokenId
        );
    }

    // ==================== Happy Path ====================

    function test_updateTokenUri_ownerCanUpdate() public {
        vm.prank(alice);
        world.UD__updateTokenUri(aliceCharacterId, "ipfs://updated");

        assertEq(_getTokenUri(aliceCharacterId), "ipfs://updated");
    }

    function test_updateTokenUri_canUpdateMultipleTimes() public {
        vm.prank(alice);
        world.UD__updateTokenUri(aliceCharacterId, "ipfs://v2");

        vm.prank(alice);
        world.UD__updateTokenUri(aliceCharacterId, "ipfs://v3");

        assertEq(_getTokenUri(aliceCharacterId), "ipfs://v3");
    }

    // ==================== Unhappy Path ====================

    function test_updateTokenUri_revertsIfNotOwner() public {
        vm.prank(bob);
        vm.expectRevert(Unauthorized.selector);
        world.UD__updateTokenUri(aliceCharacterId, "ipfs://hacked");
    }

    function test_updateTokenUri_revertsIfEmptyUri() public {
        vm.prank(alice);
        vm.expectRevert(InvalidTokenUri.selector);
        world.UD__updateTokenUri(aliceCharacterId, "");
    }

    // ==================== Edge Cases ====================

    function test_updateTokenUri_doesNotAffectOtherFields() public {
        bytes32 originalName = Characters.getName(aliceCharacterId);
        address originalOwner = Characters.getOwner(aliceCharacterId);

        vm.prank(alice);
        world.UD__updateTokenUri(aliceCharacterId, "ipfs://newAvatar");

        assertEq(Characters.getName(aliceCharacterId), originalName);
        assertEq(Characters.getOwner(aliceCharacterId), originalOwner);
    }
}
