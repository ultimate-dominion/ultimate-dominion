pragma solidity >=0.8.24;

import {SetUp} from "./SetUp.sol";
import {Classes} from "../src/codegen/common.sol";
import {StatsData} from "../src/codegen/tables/Stats.sol";
import {GasReporter} from "@latticexyz/gas-report/src/GasReporter.sol";
import {IERC721Metadata} from "@latticexyz/world-modules/src/modules/erc721-puppet/IERC721Metadata.sol";
import "forge-std/console2.sol";

contract Test_CharacterSystem is SetUp, GasReporter {
  function test_Mint() public {
    startGasReport("mints a character");

        vm.startPrank(alice);
        alicesCharacterId = world.UD__mintCharacter(alice, bytes32("Alan"), "test_Character_URI");
        assertEq(world.UD__getPlayerEntityId(3), alicesCharacterId);
        assertEq(characterToken.ownerOf(1), alice);
        assertEq(characterToken.balanceOf(alice), 2);
        assertEq(IERC721Metadata(address(characterToken)).tokenURI(3), "ipfs://test_Character_URI");

    endGasReport();
  }

  function test_RollStats() public {
    startGasReport("rolls stats for a character");

        uint256 fees = entropy.getFee(address(1));
        vm.prank(alice);
        world.UD__rollStats{value: fees}(alicesRandomness, alicesCharacterId, Classes.Rogue);
        vm.warp(block.number + 1);
        StatsData memory alicesCharacter = world.UD__getStats(alicesCharacterId);
        assertEq(uint8(world.UD__getClass(alicesCharacterId)), uint8(Classes.Rogue));
        assertEq(alicesCharacter.strength, 9);
        assertEq(alicesCharacter.agility, 8);
        assertEq(alicesCharacter.maxHitPoints, 6);
        assertEq(alicesCharacter.intelligence, 4);

    endGasReport();
  }

  function test_RollStats_Revert_GameStarted() public {
    uint256 fees = entropy.getFee(address(1));
    vm.startPrank(alice);
    world.UD__rollStats{ value: fees }(alicesRandomness, alicesCharacterId, Classes.Rogue);
    world.UD__enterGame(alicesCharacterId);
    vm.expectRevert();
    world.UD__rollStats{ value: fees }(alicesRandomness, alicesCharacterId, Classes.Rogue);
  }

  function test_EnterGame() public {
    startGasReport("enters a character into the game");

    uint256 fees = entropy.getFee(address(1));
    vm.startPrank(alice);
    world.UD__rollStats{ value: fees }(alicesRandomness, alicesCharacterId, Classes.Rogue);
    world.UD__enterGame(alicesCharacterId);
    // assertEq(erc1155System.balanceOf(alice, 0), 1);

        endGasReport();
    }

    function test_getPlayerEntity() public {
        address ownerAddress = characterToken.ownerOf(2);
        bytes32 playerEntityId = bytes32(uint256(uint160(ownerAddress)) << 96 | 2);
        assertEq(world.UD__getPlayerEntityId(2), playerEntityId);
    }

    function test_getTokenIdFromCharId() public {
        assertEq(world.UD__getCharacterTokenId(bobCharacterId), uint256(uint88(uint256(bobCharacterId))));
    }

    function test_getOwnerId() public {
        assertEq(world.UD__getOwnerAddress(bobCharacterId), bob);
    }
}
