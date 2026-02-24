// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IWorld} from "@world/IWorld.sol";
import {UltimateDominionConfig, Characters} from "@codegen/index.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {IERC721Mintable} from "@latticexyz/world-modules/src/modules/erc721-puppet/IERC721Mintable.sol";
import {BADGE_ADVENTURER} from "../constants.sol";

contract TestBadgeMint is Script {
    function run(address _worldAddress) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        IWorld world = IWorld(_worldAddress);
        StoreSwitch.setStoreAddress(_worldAddress);

        console.log("=== Test Badge Mint ===");
        console.log("World:", _worldAddress);

        // Check badge token address
        address badgeToken = UltimateDominionConfig.getBadgeToken();
        console.log("Badge token from config:", badgeToken);

        if (badgeToken == address(0)) {
            console.log("ERROR: Badge token not set in config!");
            vm.stopBroadcast();
            return;
        }

        // Character ID for token 1
        bytes32 characterId = bytes32(uint256(uint160(deployer)) << 96 | 1);
        console.log("Character ID:");
        console.logBytes32(characterId);

        // Get character owner
        address owner = Characters.getOwner(characterId);
        console.log("Character owner:", owner);

        // Get character token ID
        uint256 tokenId = Characters.getTokenId(characterId);
        console.log("Character token ID:", tokenId);

        // Calculate badge ID
        uint256 badgeId = (BADGE_ADVENTURER * 1_000_000) + tokenId;
        console.log("Badge ID to mint:", badgeId);

        // Try to mint
        IERC721Mintable badges = IERC721Mintable(badgeToken);

        console.log("Attempting to mint badge...");
        badges.mint(owner, badgeId);
        console.log("Badge minted successfully!");

        // Verify
        address badgeOwner = badges.ownerOf(badgeId);
        console.log("Badge owner:", badgeOwner);

        vm.stopBroadcast();
    }
}
