pragma solidity >=0.8.24;

import { SetUp } from "./SetUp.sol";
import { Classes } from "../src/codegen/common.sol";
import { CharacterStatsData } from "../src/codegen/tables/CharacterStats.sol";
import { GasReporter } from "@latticexyz/gas-report/src/GasReporter.sol";
import { IERC721Metadata } from "@latticexyz/world-modules/src/modules/erc721-puppet/IERC721Metadata.sol";
import "forge-std/console2.sol";

contract Test_CharacterSystem is SetUp, GasReporter {
  function test_Mint() public {
    startGasReport("mints a character");

    vm.startPrank(alice);
    alicesCharacterId = world.UD__mintCharacter(alice, bytes32("Alan"), "test_Character_URI");
    assertEq(alicesCharacterId, 2);
    assertEq(characterToken.ownerOf(1), alice);
    assertEq(characterToken.balanceOf(alice), 2);
    assertEq(IERC721Metadata(address(characterToken)).tokenURI(alicesCharacterId), "ipfs://test_Character_URI");

    endGasReport();
  }

  function test_RollStats() public {
    startGasReport("rolls stats for a character");

    uint256 fees = entropy.getFee(address(1));
    vm.prank(alice);
    world.UD__rollStats{ value: fees }(alicesRandomness, alicesCharacterId, Classes.Rogue);
    vm.warp(block.number + 1);
    CharacterStatsData memory alicesCharacter = world.UD__getCharacterStats(alicesCharacterId);
    assertEq(uint8(world.UD__getClass(alicesCharacterId)), uint8(Classes.Rogue));

    assertTrue(alicesCharacter.strength <= 10);
    assertTrue(alicesCharacter.agility <= 12);
    assertTrue(alicesCharacter.intelligence <= 10);

    assertTrue(alicesCharacter.strength >= 3);
    assertTrue(alicesCharacter.agility >= 5);
    assertTrue(alicesCharacter.intelligence >= 3);

    assertTrue(alicesCharacter.strength + alicesCharacter.agility + alicesCharacter.intelligence <= 21);

    assertEq(alicesCharacter.hitPoints, 6);

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
}
