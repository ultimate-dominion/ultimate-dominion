// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { SetUp } from "./SetUp.sol";
import { Classes } from "../src/codegen/common.sol";
import { CharacterStatsData } from "../src/codegen/tables/CharacterStats.sol";
import { GasReporter } from "@latticexyz/gas-report/src/GasReporter.sol";
import "forge-std/console2.sol";

contract Test_CharacterSystem is SetUp, GasReporter {
  function test_Mint() public {
    startGasReport("mints a character");

    vm.startPrank(alice);
    alicesCharacterId = world.UD__mintCharacter(alice, Classes.Warrior, bytes32("Alan"));
    assertEq(alicesCharacterId, 1);
    assertEq(characterToken.ownerOf(1), alice);
    assertEq(characterToken.balanceOf(alice), 2);

    endGasReport();
  }

  function test_RollStats() public {
    startGasReport("rolls stats for a character");

    uint256 fees = entropy.getFee(address(1));
    vm.prank(alice);
    world.UD__rollStats{ value: fees }(alicesRandomness, alicesCharacterId);
    vm.warp(block.number + 1);
    CharacterStatsData memory alicesCharacter = world.UD__getCharacterStats(alicesCharacterId);
    assertEq(uint8(world.UD__getClass(alicesCharacterId)), uint8(Classes.Rogue));
    assertEq(alicesCharacter.strength, 2);
    assertEq(alicesCharacter.agility, 7);
    assertEq(alicesCharacter.hitPoints, 3);
    assertEq(alicesCharacter.intelligence, 4);

    endGasReport();
  }

  function test_RollStats_Revert_GameStarted() public {
    uint256 fees = entropy.getFee(address(1));
    vm.startPrank(alice);
    world.UD__rollStats{ value: fees }(alicesRandomness, alicesCharacterId);
    world.UD__enterGame(alicesCharacterId);
    vm.expectRevert();
    world.UD__rollStats{ value: fees }(alicesRandomness, alicesCharacterId);
  }
}
