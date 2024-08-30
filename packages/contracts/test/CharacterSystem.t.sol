pragma solidity >=0.8.24;

import {SetUp} from "./SetUp.sol";
import {Classes} from "@codegen/common.sol";
import {StatsData, StarterItemsData} from "@codegen/index.sol";
import {GasReporter} from "@latticexyz/gas-report/src/GasReporter.sol";
import {IERC721Metadata} from "@latticexyz/world-modules/src/modules/erc721-puppet/IERC721Metadata.sol";
import "forge-std/console.sol";

contract Test_CharacterSystem is SetUp, GasReporter {
    function setUp() public virtual override {
        super.setUp();
        vm.prank(deployer);
        world.UD__setAdmin(address(this), true);
    }

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
        assertEq(uint8(alicesCharacter.class), uint8(Classes.Rogue));
        assertEq(
            (alicesCharacter.strength + alicesCharacter.agility + alicesCharacter.baseHp + alicesCharacter.intelligence),
            27
        );

        endGasReport();
    }

    function test_RollStats_Revert_GameStarted() public {
        uint256 fees = entropy.getFee(address(1));
        vm.startPrank(alice);
        world.UD__rollStats{value: fees}(alicesRandomness, alicesCharacterId, Classes.Rogue);
        world.UD__enterGame(alicesCharacterId);
        vm.expectRevert();
        world.UD__rollStats{value: fees}(alicesRandomness, alicesCharacterId, Classes.Rogue);
    }

    function test_EnterGame() public {
        startGasReport("enters a character into the game");

        uint256 fees = entropy.getFee(address(1));
        vm.startPrank(alice);
        world.UD__rollStats{value: fees}(alicesRandomness, alicesCharacterId, Classes.Rogue);
        world.UD__enterGame(alicesCharacterId);
        StarterItemsData memory starterItemsDat = world.UD__getStarterItems(Classes.Rogue);
        assertEq(erc1155System.balanceOf(alice, starterItemsDat.itemIds[0]), starterItemsDat.amounts[0]);

        endGasReport();
    }

    function test_UpdateTokenUri() public {
        vm.prank(bob);
        world.UD__updateTokenUri(bobCharacterId, "newTokenUri");

        assertEq(IERC721Metadata(address(characterToken)).tokenURI(2), "ipfs://newTokenUri");
    }

    function test_getCharacterId() public {
        uint256 bobTokenId = world.UD__getCharacterTokenId(bobCharacterId);
        assertEq(bobTokenId, 2);
    }

    function test_levelCharacter() public {
        StatsData memory bobStats = world.UD__getStats(bobCharacterId);
        uint256 startingStr = bobStats.strength;
        bobStats.experience = 100_000;

        world.UD__adminSetStats(bobCharacterId, bobStats);
        bobStats.strength += 2;
        vm.prank(bob);
        world.UD__levelCharacter(bobCharacterId, bobStats);
        assertEq(world.UD__getStats(bobCharacterId).strength, startingStr + 2);
    }
}
