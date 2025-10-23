// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {Script} from "forge-std/Script.sol";
import {IERC721Mintable} from "@latticexyz/world-modules/src/modules/erc721-puppet/IERC721Mintable.sol";
import {registerERC721} from "@latticexyz/world-modules/src/modules/erc721-puppet/registerERC721.sol";
import {ERC721MetadataData} from "@latticexyz/world-modules/src/modules/erc721-puppet/tables/ERC721Metadata.sol";
import {ResourceId, WorldResourceIdLib, WorldResourceIdInstance} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM} from "@latticexyz/world/src/worldResourceTypes.sol";
import {IWorld} from "../src/codegen/world/IWorld.sol";
import {CharacterCore} from "../src/systems/character/CharacterCore.sol";
import {StatSystem} from "../src/systems/character/StatSystem.sol";
import {System} from "@latticexyz/world/src/System.sol";
import {CHARACTERS_NAMESPACE, ERC721_NAME, ERC721_SYMBOL, TOKEN_URI} from "../constants.sol";
import {NoTransferHook} from "../src/NoTransferHook.sol";
import {_erc721SystemId} from "@latticexyz/world-modules/src/modules/erc721-puppet/utils.sol";
import {BEFORE_CALL_SYSTEM} from "@latticexyz/world/src/systemHookTypes.sol";

import {UltimateDominionConfig} from "../src/codegen/index.sol";
import "forge-std/console.sol";

contract DeployCharacters is Script {
    function run(address worldAddress) public returns (address) {
        IWorld world = IWorld(worldAddress);
        StoreSwitch.setStoreAddress(worldAddress);

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        IERC721Mintable characters = registerERC721(
            world,
            CHARACTERS_NAMESPACE,
            ERC721MetadataData({name: ERC721_NAME, symbol: ERC721_SYMBOL, baseURI: TOKEN_URI})
        );

        ResourceId characterCoreId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "CharacterCore");
        ResourceId statSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "StatSystem");

        CharacterCore characterCore = new CharacterCore();
        StatSystem statSystem = new StatSystem();

        ResourceId namespaceId = WorldResourceIdLib.encodeNamespace("Characters");

        world.registerSystem(characterCoreId, characterCore, true);
        world.registerSystem(statSystemId, statSystem, true);

        NoTransferHook characterHook = new NoTransferHook();

        world.registerSystemHook(_erc721SystemId(CHARACTERS_NAMESPACE), characterHook, BEFORE_CALL_SYSTEM);

        // Transfer characters namespace to World
        world.transferOwnership(namespaceId, worldAddress);

        UltimateDominionConfig.setCharacterToken(address(characters));
        console.log("CHAR: ", address(characters));
        vm.stopBroadcast();
        return address(characters);
    }
}
