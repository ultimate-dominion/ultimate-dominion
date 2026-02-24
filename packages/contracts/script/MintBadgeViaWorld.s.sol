// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IWorld} from "@world/IWorld.sol";
import {UltimateDominionConfig, Characters, Stats} from "@codegen/index.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {BADGE_ADVENTURER} from "../constants.sol";

contract MintBadgeViaWorld is Script {
    function run(address _worldAddress, bytes32 characterId) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        IWorld world = IWorld(_worldAddress);
        StoreSwitch.setStoreAddress(_worldAddress);

        console.log("=== Mint Badge Via World ===");

        // Check badge token address
        address badgeToken = UltimateDominionConfig.getBadgeToken();
        console.log("Badge token from config:", badgeToken);

        // Get character info
        address owner = Characters.getOwner(characterId);
        uint256 tokenId = Characters.getTokenId(characterId);
        uint256 level = Stats.getLevel(characterId);

        console.log("Character owner:", owner);
        console.log("Character token ID:", tokenId);
        console.log("Character level:", level);

        // Calculate badge ID
        uint256 badgeId = (BADGE_ADVENTURER * 1_000_000) + tokenId;
        console.log("Badge ID:", badgeId);

        // Call mint through the World's ERC721 system
        // The function signature for the Badges namespace
        bytes memory callData = abi.encodeWithSignature(
            "Badges__mint(address,uint256)",
            owner,
            badgeId
        );

        console.log("Calling Badges__mint through World...");
        (bool success, bytes memory result) = _worldAddress.call(callData);

        if (success) {
            console.log("Badge minted successfully!");
        } else {
            console.log("Mint failed!");
            console.logBytes(result);
        }

        vm.stopBroadcast();
    }
}
