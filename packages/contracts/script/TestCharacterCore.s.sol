// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {PuppetModule} from "@latticexyz/world-modules/src/modules/puppet/PuppetModule.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM} from "@latticexyz/world/src/worldResourceTypes.sol";
import {IERC721Mintable} from "@latticexyz/world-modules/src/modules/erc721-puppet/IERC721Mintable.sol";
import {registerERC721} from "@latticexyz/world-modules/src/modules/erc721-puppet/registerERC721.sol";
import {ERC721MetadataData} from "@latticexyz/world-modules/src/modules/erc721-puppet/tables/ERC721Metadata.sol";
import {System} from "@latticexyz/world/src/System.sol";

import {IWorld} from "@world/IWorld.sol";
import {CharacterCore} from "@systems/character/CharacterCore.sol";
import {UltimateDominionConfig, Characters} from "@codegen/index.sol";
import {
    CHARACTERS_NAMESPACE,
    ERC721_NAME,
    ERC721_SYMBOL,
    TOKEN_URI
} from "../constants.sol";

contract TestCharacterCore is Script {
    IWorld public world;
    ResourceId public characterCoreId;

    function run(address _worldAddress) external {
        world = IWorld(_worldAddress);
        StoreSwitch.setStoreAddress(_worldAddress);

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        console.log("Testing CharacterCore system deployment...");

        // Deploy CharacterCore
        System characterCore = new CharacterCore();
        
        characterCoreId = WorldResourceIdLib.encode({
            typeId: RESOURCE_SYSTEM,
            namespace: "UD",
            name: "CharacterCore"
        });

        world.registerSystem(characterCoreId, characterCore, true);

        // Register function selectors
        world.registerRootFunctionSelector(characterCoreId, "mintCharacter(address,bytes32,string)", "mintCharacter(address,bytes32,string)");
        world.registerRootFunctionSelector(characterCoreId, "enterGame(bytes32)", "enterGame(bytes32)");
        world.registerRootFunctionSelector(characterCoreId, "updateTokenUri(bytes32,string)", "updateTokenUri(bytes32,string)");
        world.registerRootFunctionSelector(characterCoreId, "isValidCharacterId(bytes32)", "isValidCharacterId(bytes32)");
        world.registerRootFunctionSelector(characterCoreId, "isValidOwner(bytes32,address)", "isValidOwner(bytes32,address)");
        world.registerRootFunctionSelector(characterCoreId, "getOwner(bytes32)", "getOwner(bytes32)");
        world.registerRootFunctionSelector(characterCoreId, "getName(bytes32)", "getName(bytes32)");
        world.registerRootFunctionSelector(characterCoreId, "getCharacterTokenId(bytes32)", "getCharacterTokenId(bytes32)");

        console.log("CharacterCore system registered with ID:", uint256(uint160(address(characterCore))));

        // Test basic functionality
        _testCharacterCore();

        vm.stopBroadcast();
    }

    function _registerERC721() external returns (IERC721Mintable) {
        return registerERC721(
            world,
            CHARACTERS_NAMESPACE,
            ERC721MetadataData({name: ERC721_NAME, symbol: ERC721_SYMBOL, baseURI: TOKEN_URI})
        );
    }

    function _testCharacterCore() internal {
        console.log("Testing CharacterCore functionality...");

        // First, we need to set up the character token (may already be installed)
        try this._registerERC721() returns (IERC721Mintable characters) {
            UltimateDominionConfig.setCharacterToken(address(characters));
            console.log("Character token set up at:", address(characters));
        } catch {
            // Module already installed, get existing token address
            address existingToken = UltimateDominionConfig.getCharacterToken();
            console.log("Character token already exists at:", existingToken);
        }

        // Test minting a character
        address testPlayer = address(0x123);
        bytes32 characterName = bytes32("TestChar");
        string memory tokenUri = "ipfs://test";

        try world.UD__mintCharacter(testPlayer, characterName, tokenUri) returns (bytes32 characterId) {
            console.log("Successfully minted character:", uint256(characterId));
            
            // Test basic validation
            bool isValid = world.UD__isValidCharacterId(characterId);
            console.log("Character is valid:", isValid);
            
            bool isOwner = world.UD__isValidOwner(characterId, testPlayer);
            console.log("Player is owner:", isOwner);
            
            address owner = world.UD__getOwner(characterId);
            console.log("Character owner:", owner);
            
            bytes32 name = Characters.getName(characterId);
            console.log("Character name:", uint256(name));
            
        } catch Error(string memory reason) {
            console.log("Error minting character:", reason);
        } catch (bytes memory lowLevelData) {
            console.log("Low-level error minting character:", string(lowLevelData));
        }
    }
}
