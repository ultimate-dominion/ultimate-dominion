// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IWorld} from "@world/IWorld.sol";
import {UltimateDominionConfig} from "@codegen/index.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {IERC721Mintable} from "@latticexyz/world-modules/src/modules/erc721-puppet/IERC721Mintable.sol";
import {registerERC721} from "@latticexyz/world-modules/src/modules/erc721-puppet/registerERC721.sol";
import {ERC721MetadataData} from "@latticexyz/world-modules/src/modules/erc721-puppet/tables/ERC721Metadata.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {_erc721SystemId} from "@latticexyz/world-modules/src/modules/erc721-puppet/utils.sol";
import {BEFORE_CALL_SYSTEM} from "@latticexyz/world/src/systemHookTypes.sol";
import {NoTransferHook} from "../src/NoTransferHook.sol";
import {BADGES_NAMESPACE} from "../constants.sol";

/**
 * @title ConfigureBadgeToken
 * @notice Deploys and configures the badge token for an existing world
 */
contract ConfigureBadgeToken is Script {
    function run(address _worldAddress) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        IWorld world = IWorld(_worldAddress);
        StoreSwitch.setStoreAddress(_worldAddress);

        console.log("=== Configure Badge Token ===");
        console.log("World address:", _worldAddress);
        console.log("Deployer:", deployer);

        address existingBadge = UltimateDominionConfig.getBadgeToken();
        console.log("Existing badge token:", existingBadge);

        if (existingBadge == address(0)) {
            console.log("Deploying new Badge token...");
            IERC721Mintable badges = registerERC721(
                world,
                BADGES_NAMESPACE,
                ERC721MetadataData({name: "Ultimate Dominion Badges", symbol: "UDB", baseURI: "ipfs://"})
            );
            UltimateDominionConfig.setBadgeToken(address(badges));
            console.log("  Badge token deployed at:", address(badges));

            // Grant World access to Badges namespace
            ResourceId badgesNamespaceId = WorldResourceIdLib.encodeNamespace(BADGES_NAMESPACE);
            try world.grantAccess(badgesNamespaceId, address(world)) {
                console.log("  Granted Badges namespace access to World");
            } catch {
                console.log("  Badges namespace access already granted");
            }

            // Grant World access to Badges:ERC721System
            ResourceId badgesErc721SystemId = _erc721SystemId(BADGES_NAMESPACE);
            try world.grantAccess(badgesErc721SystemId, address(world)) {
                console.log("  Granted Badges:ERC721System access to World");
            } catch {
                console.log("  Badges:ERC721System access already granted");
            }

            // Register NoTransferHook to make badges soulbound
            NoTransferHook badgeHook = new NoTransferHook();
            try world.registerSystemHook(badgesErc721SystemId, badgeHook, BEFORE_CALL_SYSTEM) {
                console.log("  Registered NoTransferHook for soulbound badges");
            } catch {
                console.log("  Badge hook already registered");
            }

            console.log("");
            console.log(">>> UPDATE YOUR .env FILE <<<");
            console.log("VITE_BADGE_CONTRACT_ADDRESS=", address(badges));
        } else {
            console.log("Badge token already configured at:", existingBadge);

            // Ensure permissions are set
            ResourceId badgesNamespaceId = WorldResourceIdLib.encodeNamespace(BADGES_NAMESPACE);
            ResourceId badgesErc721SystemId = _erc721SystemId(BADGES_NAMESPACE);

            try world.grantAccess(badgesNamespaceId, address(world)) {
                console.log("  Granted Badges namespace access to World");
            } catch {
                console.log("  Badges namespace access already granted");
            }

            try world.grantAccess(badgesErc721SystemId, address(world)) {
                console.log("  Granted Badges:ERC721System access to World");
            } catch {
                console.log("  Badges:ERC721System access already granted");
            }
        }

        vm.stopBroadcast();

        console.log("=== Badge Configuration Complete ===");
    }
}
