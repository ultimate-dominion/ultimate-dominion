// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import "forge-std/console2.sol";
import "forge-std/StdJson.sol";
import { MudTest } from "@latticexyz/world/test/MudTest.t.sol";
import { getKeysWithValue } from "@latticexyz/world-modules/src/modules/keyswithvalue/getKeysWithValue.sol";
import { StoreSwitch } from "@latticexyz/store/src/StoreSwitch.sol";
import { IWorld } from "@codegen/world/IWorld.sol";
import { IEntropy } from "@pythnetwork/IEntropy.sol";
import { IERC20Mintable } from "@latticexyz/world-modules/src/modules/erc20-puppet/IERC20Mintable.sol";
import { IERC721Mintable } from "@latticexyz/world-modules/src/modules/erc721-puppet/IERC721Mintable.sol";
import { Characters, CharactersData, UltimateDominionConfig } from "@codegen/index.sol";
import { Classes } from "@codegen/common.sol";
import { ResourceId, WorldResourceIdLib, WorldResourceIdInstance } from "@latticexyz/world/src/WorldResourceId.sol";
import { RESOURCE_NAMESPACE } from "@latticexyz/world/src/worldResourceTypes.sol";
import { System } from "@latticexyz/world/src/System.sol";

contract SetUp is Test {
  using stdJson for string;

  address deployer = vm.addr(vm.envUint("PRIVATE_KEY"));
  address payable public alice;
  uint256 public userNonce = 0;
  IWorld public world;
  address public worldAddress;
  IEntropy public entropy;

  IERC20Mintable public goldToken;
  IERC721Mintable public characterToken;

  uint256 alicesCharacterId;
  bytes32 public alicesRandomness = bytes32(keccak256(abi.encode("alicesRestaurant")));

  function setUp() public virtual {
    vm.startPrank(deployer);
    string memory json = vm.readFile(string(abi.encodePacked(vm.projectRoot(), "/deploys/31337/latest.json")));
    worldAddress = json.readAddress(".worldAddress");
    vm.label(address(worldAddress), "World");
    StoreSwitch.setStoreAddress(worldAddress);

    world = IWorld(worldAddress);
    entropy = IEntropy(world.UD__getEntropy());
    alice = getUser();
    goldToken = IERC20Mintable(world.UD__getGoldToken());
    characterToken = IERC721Mintable(world.UD__getCharacterToken());
    vm.stopPrank();
    vm.prank(alice);
    alicesCharacterId = world.UD__mintCharacter(alice, Classes.Rogue, bytes32("Steve"));

    vm.startPrank(deployer);
    uint256[] memory amounts = new uint256[](1);
    amounts[0] = 1;
    vm.stopPrank();
    vm.label(alice, "alice");
    vm.label(worldAddress, "world");
    vm.label(world.UD__getCharacterToken(), "character token");
  }

  function getUser() internal returns (address payable) {
    address payable user = payable(address(uint160(uint256(keccak256(abi.encodePacked(userNonce++))))));
    vm.deal(user, 100 ether);
    return user;
  }
}
