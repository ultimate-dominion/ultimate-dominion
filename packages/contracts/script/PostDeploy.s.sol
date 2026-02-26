// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";

import {IWorld} from "@world/IWorld.sol";
import {UltimateDominionConfig} from "@codegen/index.sol";
import {IERC20Mintable} from "@latticexyz/world-modules/src/modules/erc20-puppet/IERC20Mintable.sol";
import {registerERC20} from "@latticexyz/world-modules/src/modules/erc20-puppet/registerERC20.sol";
import {ERC20MetadataData} from "@latticexyz/world-modules/src/modules/erc20-puppet/tables/ERC20Metadata.sol";
import {IERC721Mintable} from "@latticexyz/world-modules/src/modules/erc721-puppet/IERC721Mintable.sol";
import {registerERC721} from "@latticexyz/world-modules/src/modules/erc721-puppet/registerERC721.sol";
import {ERC721MetadataData} from "@latticexyz/world-modules/src/modules/erc721-puppet/tables/ERC721Metadata.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM, RESOURCE_TABLE} from "@latticexyz/world/src/worldResourceTypes.sol";
import {NoTransferHook} from "../src/NoTransferHook.sol";
import {_erc721SystemId} from "@latticexyz/world-modules/src/modules/erc721-puppet/utils.sol";
import {_erc20SystemId} from "@latticexyz/world-modules/src/modules/erc20-puppet/utils.sol";
import {_erc1155SystemId} from "../src/utils.sol";
import {BEFORE_CALL_SYSTEM} from "@latticexyz/world/src/systemHookTypes.sol";
import {GOLD_NAMESPACE, CHARACTERS_NAMESPACE, ITEMS_NAMESPACE, BADGES_NAMESPACE, FRAGMENTS_NAMESPACE, ERC721_NAME, ERC721_SYMBOL, TOKEN_URI, WORLD_NAMESPACE, DEFAULT_ETH_PER_GOLD, DEFAULT_MAX_GOLD_PER_SWAP, DEFAULT_GAS_COOLDOWN, GAME_DELEGATION_NAME} from "../constants.sol";
import {GasStationConfig, AllowedGameSystems} from "@codegen/index.sol";
import {PuppetModule} from "@latticexyz/world-modules/src/modules/puppet/PuppetModule.sol";
import {StandardDelegationsModule} from "@latticexyz/world-modules/src/modules/std-delegations/StandardDelegationsModule.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";
import {RngSystem} from "../src/systems/RngSystem.sol";
import {GameDelegationControl} from "../src/systems/GameDelegationControl.sol";
import {System} from "@latticexyz/world/src/System.sol";
import {registerERC1155} from "@erc1155/registerERC1155.sol";
import {IERC1155} from "@erc1155/IERC1155.sol";

// Import tables for direct writes (game data seeding)
import {
    Paused,
    MapConfig,
    Admin,
    Levels,
    Counters,
    Effects,
    PhysicalDamageStats,
    PhysicalDamageStatsData,
    MagicDamageStats,
    MagicDamageStatsData,
    StatusEffectStats,
    StatusEffectStatsData,
    StatusEffectValidity,
    StatusEffectValidityData,
    Items,
    ItemsData,
    WeaponStats,
    WeaponStatsData,
    ArmorStats,
    ArmorStatsData,
    ConsumableStats,
    ConsumableStatsData,
    StatRestrictions,
    StatRestrictionsData,
    StarterItems as StarterItemsTable,
    Mobs,
    MobsByLevel,
    Position,
    EntitiesAtPosition,
    Spawned,
    MobStats,
    MobStatsData,
    Stats,
    StatsData,
    Shops,
    ShopsData
} from "@codegen/index.sol";

import {Classes, ItemType, MobType, EffectType} from "@codegen/common.sol";

// Import structs for JSON parsing
import {
    MonsterStats,
    MonsterTemplateDetails,
    WeaponTemplateDetails,
    ArmorTemplateDetails,
    ShopTemplate,
    StarterItems,
    StarterEffects,
    ConsumableTemplateDetails
} from "@interfaces/Structs.sol";

// Import ERC1155 tables for minting
import {Owners} from "@erc1155/tables/Owners.sol";
import {TotalSupply} from "@erc1155/tables/TotalSupply.sol";
import {ERC1155URIStorage} from "@erc1155/tables/ERC1155URIStorage.sol";
import {_ownersTableId, _totalSupplyTableId, _erc1155URIStorageTableId} from "@erc1155/utils.sol";
import {_lootManagerSystemId, _mobSystemId} from "../src/utils.sol";

import "forge-std/StdJson.sol";

/**
 * @title PostDeploy
 * @notice Main entry point for MUD deployment - sets up core infrastructure ONLY
 * @dev This script is automatically called by MUD after world deployment.
 *      Game content (items, monsters, shops, effects) is loaded separately via zone scripts.
 *
 * Deployment steps:
 * 1. Install PuppetModule (required for ERC20/ERC721/ERC1155)
 * 2. Deploy Gold ERC20 token (no pre-mint - mint-on-demand model)
 * 3. Deploy Character ERC721 token
 * 4. Deploy Items ERC1155 token
 * 5. Configure character system (hooks, access)
 * 6. Deploy RngSystem
 * 7. Grant deployer access to namespaces
 * 8. Set up core infrastructure (map config, admin, level XP)
 * 9. Transfer namespace ownership
 *
 * After deployment, use zone loader scripts to add game content:
 * - adminCreateEffect() for effects
 * - adminCreateItem()/adminCreateItems() for items
 * - adminCreateMob()/adminCreateMobs() for monsters
 * - adminCreateShop() for shops
 */
contract PostDeploy is Script {
    using stdJson for string;

    IWorld public world;
    address public deployer;
    address public lootManagerAddress;

    // Counter addresses (used as keys in Counters table)
    address internal itemsCounterAddress;
    address internal mobCounterAddress;

    function run(address _worldAddress) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        world = IWorld(_worldAddress);
        StoreSwitch.setStoreAddress(_worldAddress);

        console.log("=============================================");
        console.log("   ULTIMATE DOMINION - Infrastructure Only  ");
        console.log("=============================================");
        console.log("World address:", _worldAddress);
        console.log("Deployer:", deployer);
        console.log("");

        // Step 1: Install modules
        _installPuppetModule();
        _installStandardDelegationsModule();

        // Step 2-5: Deploy tokens
        _deployGoldToken(_worldAddress);
        _deployCharacterToken();
        _deployItemsToken();
        _deployBadgesToken();
        _deployFragmentToken();

        // Step 5: Configure character system
        _configureCharacterSystem();

        // Step 6: Deploy RngSystem
        _deployRngSystem();

        // Step 7: Grant access for game data seeding
        _grantDeployerAccess();

        // Step 8: Seed game data (inlined to avoid permission issues)
        console.log("");
        console.log(">>> Seeding Game Data <<<");
        _seedGameData();

        // Step 9: Configure GasStation
        _configureGasStation();

        // Step 9.5: Configure GameDelegationControl whitelist
        _configureGameDelegation();

        // Step 10: Transfer Items namespace ownership to World (must happen AFTER items are minted)
        _transferItemsOwnership();

        vm.stopBroadcast();

        console.log("");
        console.log("=============================================");
        console.log("   INFRASTRUCTURE DEPLOYMENT COMPLETE       ");
        console.log("=============================================");
        console.log("");
        console.log("Next steps:");
        console.log("  1. Run zone loader script to add game content");
        console.log("  2. pnpm zone:load dark_cave  (example)");
    }

    function _installPuppetModule() internal {
        console.log("Installing PuppetModule...");
        try world.installModule(new PuppetModule(), new bytes(0)) {
            console.log("  PuppetModule installed");
        } catch {
            console.log("  PuppetModule already installed, skipping");
        }
    }

    function _installStandardDelegationsModule() internal {
        console.log("Installing StandardDelegationsModule...");
        try world.installRootModule(new StandardDelegationsModule(), new bytes(0)) {
            console.log("  StandardDelegationsModule installed (enables session wallets)");
        } catch {
            console.log("  StandardDelegationsModule already installed, skipping");
        }
    }

    function _deployGoldToken(address _worldAddress) internal {
        if (UltimateDominionConfig.getGoldToken() == address(0)) {
            console.log("Deploying Gold token...");
            IERC20Mintable goldToken = registerERC20(
                world,
                GOLD_NAMESPACE,
                ERC20MetadataData({decimals: 18, name: "Gold", symbol: unicode"🜚"})
            );
            // NOTE: No pre-minted gold - using mint-on-demand model
            // Gold is minted when players earn it (combat rewards, quest completions, etc.)
            UltimateDominionConfig.setGoldToken(address(goldToken));
            console.log("  Gold token deployed at:", address(goldToken));

            // Grant World access to Gold namespace so systems can mint gold
            ResourceId goldNamespaceId = WorldResourceIdLib.encodeNamespace(GOLD_NAMESPACE);
            try world.grantAccess(goldNamespaceId, address(world)) {
                console.log("  Granted Gold namespace access to World");
            } catch {
                console.log("  Gold namespace access already granted");
            }

            // Grant access to the specific Balances table for direct writes
            ResourceId goldBalancesTableId = WorldResourceIdLib.encode(RESOURCE_TABLE, GOLD_NAMESPACE, "Balances");
            try world.grantAccess(goldBalancesTableId, address(world)) {
                console.log("  Granted Gold:Balances table access to World");
            } catch {
                console.log("  Gold:Balances table access already granted");
            }

            // Grant the Gold puppet access to call back to World
            try world.grantAccess(goldNamespaceId, address(goldToken)) {
                console.log("  Granted Gold namespace access to Gold puppet");
            } catch {
                console.log("  Gold puppet access already granted");
            }

            // Grant World access to Gold:ERC20System specifically
            ResourceId goldErc20SystemId = _erc20SystemId(GOLD_NAMESPACE);
            try world.grantAccess(goldErc20SystemId, address(world)) {
                console.log("  Granted Gold:ERC20System access to World");
            } catch {
                console.log("  Gold:ERC20System access already granted");
            }

            // Grant Gold puppet access to Gold:ERC20System (needed for puppet callbacks)
            try world.grantAccess(goldErc20SystemId, address(goldToken)) {
                console.log("  Granted Gold:ERC20System access to Gold puppet");
            } catch {
                console.log("  Gold:ERC20System puppet access already granted");
            }
        } else {
            console.log("  Gold token already configured, skipping");
        }
    }

    function _deployCharacterToken() internal {
        if (UltimateDominionConfig.getCharacterToken() == address(0)) {
            console.log("Deploying Character token...");
            IERC721Mintable characters = registerERC721(
                world,
                CHARACTERS_NAMESPACE,
                ERC721MetadataData({name: ERC721_NAME, symbol: ERC721_SYMBOL, baseURI: TOKEN_URI})
            );
            UltimateDominionConfig.setCharacterToken(address(characters));
            console.log("  Character token deployed at:", address(characters));
        } else {
            console.log("  Character token already configured, skipping");
        }
    }

    function _deployItemsToken() internal {
        if (UltimateDominionConfig.getItems() == address(0)) {
            console.log("Deploying Items ERC1155 token...");
            IERC1155 items = registerERC1155(world, ITEMS_NAMESPACE, "ipfs://");
            UltimateDominionConfig.setItems(address(items));
            console.log("  Items ERC1155 token deployed at:", address(items));

            // Grant deployer access to Items namespace
            ResourceId itemsNamespaceId = WorldResourceIdLib.encodeNamespace(ITEMS_NAMESPACE);
            try world.grantAccess(itemsNamespaceId, deployer) {
                console.log("  Granted Items namespace access to deployer");
            } catch {
                console.log("  Items namespace access already granted");
            }

            // Grant World access to Items namespace so systems can mint items via LootManagerSystem
            try world.grantAccess(itemsNamespaceId, address(world)) {
                console.log("  Granted Items namespace access to World");
            } catch {
                console.log("  World Items namespace access already granted");
            }

            // Grant access to the specific Owners table for direct writes
            ResourceId itemsOwnersTableId = WorldResourceIdLib.encode(RESOURCE_TABLE, ITEMS_NAMESPACE, "Owners");
            try world.grantAccess(itemsOwnersTableId, address(world)) {
                console.log("  Granted Items:Owners table access to World");
            } catch {
                console.log("  Items:Owners table access already granted");
            }

            // Grant World access to Items:ERC1155System specifically
            ResourceId itemsErc1155SystemId = _erc1155SystemId(ITEMS_NAMESPACE);
            try world.grantAccess(itemsErc1155SystemId, address(world)) {
                console.log("  Granted Items:ERC1155System access to World");
            } catch {
                console.log("  Items:ERC1155System access already granted");
            }

            // Grant Items puppet access to Items:ERC1155System (needed for puppet callbacks)
            try world.grantAccess(itemsErc1155SystemId, address(items)) {
                console.log("  Granted Items:ERC1155System access to Items puppet");
            } catch {
                console.log("  Items:ERC1155System puppet access already granted");
            }

            // Have World approve itself for Items transfers (needed for loot drops)
            // The World owns items and needs to transfer them via the puppet
            try items.setApprovalForAll(address(world), true) {
                console.log("  World approved itself for Items transfers");
            } catch {
                console.log("  World Items self-approval failed");
            }

            // NOTE: Ownership transfer moved to _transferItemsOwnership() after game data seeding
            // mint() requires owner-level access, and we need deployer to mint items first
        } else {
            console.log("  Items token already configured, skipping");
        }
    }

    function _deployBadgesToken() internal {
        address badgeToken = UltimateDominionConfig.getBadgeToken();

        if (badgeToken == address(0)) {
            console.log("Deploying Badges token (soulbound ERC721)...");
            IERC721Mintable badges = registerERC721(
                world,
                BADGES_NAMESPACE,
                ERC721MetadataData({name: "Ultimate Dominion Badges", symbol: "UDB", baseURI: "ipfs://"})
            );
            UltimateDominionConfig.setBadgeToken(address(badges));
            badgeToken = address(badges);
            console.log("  Badges token deployed at:", badgeToken);

            // Set founder window end (7 days from deployment)
            uint256 founderWindowEnd = block.timestamp + 7 days;
            UltimateDominionConfig.setFounderWindowEnd(founderWindowEnd);
            console.log("  Founder window ends:", founderWindowEnd);

            // NOTE: This token is soulbound - transfers are blocked via NoTransferHook
            // Register hook to prevent transfers
            ResourceId badgesErc721SystemId = _erc721SystemId(BADGES_NAMESPACE);
            NoTransferHook badgeHook = new NoTransferHook();
            try world.registerSystemHook(badgesErc721SystemId, badgeHook, BEFORE_CALL_SYSTEM) {
                console.log("  Registered NoTransferHook for Badges (soulbound)");
            } catch {
                console.log("  NoTransferHook for Badges already registered");
            }
        } else {
            console.log("  Badges token already configured at:", badgeToken);
        }

        // Always ensure permissions are set (even if token already exists)
        _configureBadgePermissions();
    }

    function _configureBadgePermissions() internal {
        console.log("Configuring Badge permissions...");

        address badgeToken = UltimateDominionConfig.getBadgeToken();
        ResourceId badgesNamespaceId = WorldResourceIdLib.encodeNamespace(BADGES_NAMESPACE);
        ResourceId badgesErc721SystemId = _erc721SystemId(BADGES_NAMESPACE);

        // Grant World access to Badges namespace so systems can mint badges
        try world.grantAccess(badgesNamespaceId, address(world)) {
            console.log("  Granted Badges namespace access to World");
        } catch {
            console.log("  Badges namespace access already granted or failed");
        }

        // Grant World access to Badges:ERC721System
        try world.grantAccess(badgesErc721SystemId, address(world)) {
            console.log("  Granted Badges:ERC721System access to World");
        } catch {
            console.log("  Badges:ERC721System access already granted or failed");
        }

        // Grant Badge puppet access to call back to World (needed for puppet callbacks)
        try world.grantAccess(badgesNamespaceId, badgeToken) {
            console.log("  Granted Badges namespace access to Badge puppet");
        } catch {
            console.log("  Badge puppet namespace access already granted or failed");
        }

        try world.grantAccess(badgesErc721SystemId, badgeToken) {
            console.log("  Granted Badges:ERC721System access to Badge puppet");
        } catch {
            console.log("  Badge puppet ERC721System access already granted or failed");
        }

        // Grant CharacterCore access to mint Founder badges
        ResourceId characterCoreId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "CharacterCore");
        address characterCoreAddress = Systems.getSystem(characterCoreId);
        try world.grantAccess(badgesErc721SystemId, characterCoreAddress) {
            console.log("  Granted Badges:ERC721System access to CharacterCore");
        } catch {
            console.log("  Badges:ERC721System access to CharacterCore already granted or failed");
        }

        // Grant LevelSystem access to mint Adventurer badges
        ResourceId levelSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "LevelSystem");
        address levelSystemAddress = Systems.getSystem(levelSystemId);
        try world.grantAccess(badgesErc721SystemId, levelSystemAddress) {
            console.log("  Granted Badges:ERC721System access to LevelSystem");
        } catch {
            console.log("  Badges:ERC721System access to LevelSystem already granted or failed");
        }

        // Grant LevelSystem access to Badges:Owners and Badges:Balances tables for direct writes
        ResourceId badgesOwnersTableId = WorldResourceIdLib.encode(RESOURCE_TABLE, BADGES_NAMESPACE, "Owners");
        ResourceId badgesBalancesTableId = WorldResourceIdLib.encode(RESOURCE_TABLE, BADGES_NAMESPACE, "Balances");
        try world.grantAccess(badgesOwnersTableId, levelSystemAddress) {
            console.log("  Granted Badges:Owners table access to LevelSystem");
        } catch {
            console.log("  Badges:Owners table access to LevelSystem already granted or failed");
        }
        try world.grantAccess(badgesBalancesTableId, levelSystemAddress) {
            console.log("  Granted Badges:Balances table access to LevelSystem");
        } catch {
            console.log("  Badges:Balances table access to LevelSystem already granted or failed");
        }

        // Grant AdminSystem access to mint badges via admin function
        ResourceId adminSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "AdminSystem");
        address adminSystemAddress = Systems.getSystem(adminSystemId);
        try world.grantAccess(badgesErc721SystemId, adminSystemAddress) {
            console.log("  Granted Badges:ERC721System access to AdminSystem");
        } catch {
            console.log("  Badges:ERC721System access to AdminSystem already granted or failed");
        }

        // Grant AdminSystem access to Badges:Owners and Badges:Balances tables for direct writes
        try world.grantAccess(badgesOwnersTableId, adminSystemAddress) {
            console.log("  Granted Badges:Owners table access to AdminSystem");
        } catch {
            console.log("  Badges:Owners table access to AdminSystem already granted or failed");
        }
        try world.grantAccess(badgesBalancesTableId, adminSystemAddress) {
            console.log("  Granted Badges:Balances table access to AdminSystem");
        } catch {
            console.log("  Badges:Balances table access to AdminSystem already granted or failed");
        }

        // Grant StatSystem access to mint Adventurer badges (StatSystem has the active levelCharacter)
        ResourceId statSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "StatSystem");
        address statSystemAddress = Systems.getSystem(statSystemId);
        try world.grantAccess(badgesErc721SystemId, statSystemAddress) {
            console.log("  Granted Badges:ERC721System access to StatSystem");
        } catch {
            console.log("  Badges:ERC721System access to StatSystem already granted or failed");
        }
        try world.grantAccess(badgesOwnersTableId, statSystemAddress) {
            console.log("  Granted Badges:Owners table access to StatSystem");
        } catch {
            console.log("  Badges:Owners table access to StatSystem already granted or failed");
        }
        try world.grantAccess(badgesBalancesTableId, statSystemAddress) {
            console.log("  Granted Badges:Balances table access to StatSystem");
        } catch {
            console.log("  Badges:Balances table access to StatSystem already granted or failed");
        }

        // Transfer ownership to World (idempotent - will fail if already transferred)
        try world.transferOwnership(badgesNamespaceId, address(world)) {
            console.log("  Transferred Badges namespace ownership to World");
        } catch {
            console.log("  Badges namespace ownership already with World or transfer failed");
        }
    }

    function _deployFragmentToken() internal {
        if (UltimateDominionConfig.getFragmentToken() == address(0)) {
            console.log("Deploying Fragment token (lore NFTs)...");
            IERC721Mintable fragments = registerERC721(
                world,
                FRAGMENTS_NAMESPACE,
                ERC721MetadataData({name: "Fragments of the Fallen", symbol: "FRAGMENT", baseURI: "ipfs://"})
            );
            UltimateDominionConfig.setFragmentToken(address(fragments));
            console.log("  Fragment token deployed at:", address(fragments));

            // Grant World access to Fragments namespace so systems can mint fragments
            ResourceId fragmentsNamespaceId = WorldResourceIdLib.encodeNamespace(FRAGMENTS_NAMESPACE);
            try world.grantAccess(fragmentsNamespaceId, address(world)) {
                console.log("  Granted Fragments namespace access to World");
            } catch {
                console.log("  Fragments namespace access already granted");
            }

            // Grant World access to Fragments:ERC721System
            ResourceId fragmentsErc721SystemId = _erc721SystemId(FRAGMENTS_NAMESPACE);
            try world.grantAccess(fragmentsErc721SystemId, address(world)) {
                console.log("  Granted Fragments:ERC721System access to World");
            } catch {
                console.log("  Fragments:ERC721System access already granted");
            }

            // Grant FragmentSystem access to mint fragments (BEFORE ownership transfer)
            ResourceId fragmentSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "FragmentSystem");
            address fragmentSystemAddress = Systems.getSystem(fragmentSystemId);
            console.log("  FragmentSystem address:", fragmentSystemAddress);

            try world.grantAccess(fragmentsErc721SystemId, fragmentSystemAddress) {
                console.log("  Granted Fragments:ERC721System access to FragmentSystem");
            } catch {
                console.log("  Fragments:ERC721System access grant to FragmentSystem failed");
            }

            // NOTE: Do NOT transfer namespace ownership to the FragmentSystem contract.
            // System upgrades create new contract addresses, which orphans the namespace
            // ownership at the old address and locks out the deployer permanently.
            // Instead, keep the deployer as namespace owner and rely on the grantAccess
            // calls above for FragmentSystem to mint tokens.
        } else {
            console.log("  Fragment token already configured, skipping");
        }

        // Grant FragmentSystem access to Fragments ERC721 tables for direct writes.
        // Must run on every deploy since system addresses change on upgrade.
        ResourceId fragmentSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "FragmentSystem");
        address fragmentSystemAddress = Systems.getSystem(fragmentSystemId);
        console.log("  FragmentSystem address:", fragmentSystemAddress);

        ResourceId fragmentsOwnersTableId = WorldResourceIdLib.encode(RESOURCE_TABLE, FRAGMENTS_NAMESPACE, "Owners");
        try world.grantAccess(fragmentsOwnersTableId, fragmentSystemAddress) {
            console.log("  Granted Fragments:Owners table access to FragmentSystem");
        } catch {
            console.log("  Fragments:Owners table access already granted");
        }

        ResourceId fragmentsBalancesTableId = WorldResourceIdLib.encode(RESOURCE_TABLE, FRAGMENTS_NAMESPACE, "Balances");
        try world.grantAccess(fragmentsBalancesTableId, fragmentSystemAddress) {
            console.log("  Granted Fragments:Balances table access to FragmentSystem");
        } catch {
            console.log("  Fragments:Balances table access already granted");
        }
    }

    function _configureCharacterSystem() internal {
        console.log("Configuring Character system...");

        ResourceId characterCoreId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "CharacterCore");
        ResourceId namespaceId = WorldResourceIdLib.encodeNamespace("Characters");
        ResourceId erc721SystemId = _erc721SystemId(CHARACTERS_NAMESPACE);

        address characterCoreAddress = Systems.getSystem(characterCoreId);
        console.log("  CharacterCore address:", characterCoreAddress);

        address worldAddress = address(world);

        // Grant ERC721System access
        try world.grantAccess(erc721SystemId, worldAddress) {
            console.log("  Granted ERC721System access to World");
        } catch {}

        try world.grantAccess(erc721SystemId, characterCoreAddress) {
            console.log("  Granted ERC721System access to CharacterCore");
        } catch {}

        // Grant CharacterCore access to Gold:Balances table for direct writes
        ResourceId goldBalancesTableId = WorldResourceIdLib.encode(RESOURCE_TABLE, GOLD_NAMESPACE, "Balances");
        try world.grantAccess(goldBalancesTableId, characterCoreAddress) {
            console.log("  Granted Gold:Balances table access to CharacterCore");
        } catch {
            console.log("  Gold:Balances table access grant failed");
        }

        // Grant CharacterCore access to Items:Owners table for direct writes
        ResourceId itemsOwnersTableId = WorldResourceIdLib.encode(RESOURCE_TABLE, ITEMS_NAMESPACE, "Owners");
        try world.grantAccess(itemsOwnersTableId, characterCoreAddress) {
            console.log("  Granted Items:Owners table access to CharacterCore");
        } catch {
            console.log("  Items:Owners table access grant failed");
        }

        // Register hook
        NoTransferHook characterHook = new NoTransferHook();
        try world.registerSystemHook(erc721SystemId, characterHook, BEFORE_CALL_SYSTEM) {
            console.log("  Registered NoTransferHook");
        } catch {}

        // Transfer ownership
        try world.transferOwnership(namespaceId, characterCoreAddress) {
            console.log("  Transferred Characters namespace to CharacterCore");
        } catch {}
    }

    function _deployRngSystem() internal {
        console.log("Deploying RngSystem...");
        System rngSystem = new RngSystem();
        ResourceId rngSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "", "RngSystem");

        try world.registerSystem(rngSystemId, rngSystem, true) {
            world.registerRootFunctionSelector(rngSystemId, "getRng(bytes32,uint8,bytes)", "getRng(bytes32,uint8,bytes)");
            console.log("  RngSystem deployed and registered");
        } catch {
            console.log("  RngSystem already registered, skipping");
        }
    }

    function _grantDeployerAccess() internal {
        console.log("Granting deployer access...");

        ResourceId udNamespaceId = WorldResourceIdLib.encodeNamespace("UD");
        ResourceId effectsSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "EffectsSystem");
        ResourceId itemsSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "ItemsSystem");
        ResourceId mobSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "MobSystem");

        try world.grantAccess(udNamespaceId, deployer) {
            console.log("  Granted UD namespace access");
        } catch {}

        try world.grantAccess(effectsSystemId, deployer) {
            console.log("  Granted EffectsSystem access");
        } catch {}

        try world.grantAccess(itemsSystemId, deployer) {
            console.log("  Granted ItemsSystem access");
        } catch {}

        try world.grantAccess(mobSystemId, deployer) {
            console.log("  Granted MobSystem access");
        } catch {}

        // Grant LootManagerSystem access to Items namespace tables for direct writes
        ResourceId lootManagerSystemId = _lootManagerSystemId(WORLD_NAMESPACE);
        address lootManagerAddress = Systems.getSystem(lootManagerSystemId);
        console.log("  LootManagerSystem address:", lootManagerAddress);

        // Grant access to Items:Owners table
        ResourceId itemsOwnersTableId = _ownersTableId(ITEMS_NAMESPACE);
        try world.grantAccess(itemsOwnersTableId, lootManagerAddress) {
            console.log("  Granted Items:Owners table access to LootManagerSystem");
        } catch {
            console.log("  Items:Owners table access grant failed");
        }

        // Grant access to Items:TotalSupply table
        ResourceId itemsTotalSupplyTableId = _totalSupplyTableId(ITEMS_NAMESPACE);
        try world.grantAccess(itemsTotalSupplyTableId, lootManagerAddress) {
            console.log("  Granted Items:TotalSupply table access to LootManagerSystem");
        } catch {
            console.log("  Items:TotalSupply table access grant failed");
        }

        // Grant LootManagerSystem access to Gold namespace tables for direct writes
        ResourceId goldBalancesTableId = WorldResourceIdLib.encode(RESOURCE_TABLE, GOLD_NAMESPACE, "Balances");
        try world.grantAccess(goldBalancesTableId, lootManagerAddress) {
            console.log("  Granted Gold:Balances table access to LootManagerSystem");
        } catch {
            console.log("  Gold:Balances table access grant to LootManagerSystem failed");
        }

        ResourceId goldTotalSupplyTableId = WorldResourceIdLib.encode(RESOURCE_TABLE, GOLD_NAMESPACE, "TotalSupply");
        try world.grantAccess(goldTotalSupplyTableId, lootManagerAddress) {
            console.log("  Granted Gold:TotalSupply table access to LootManagerSystem");
        } catch {
            console.log("  Gold:TotalSupply table access grant to LootManagerSystem failed");
        }

        // Grant AdminSystem and ItemsSystem access to Items namespace (for post-deployment seeding)
        ResourceId adminSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "AdminSystem");
        address adminSystemAddress = Systems.getSystem(adminSystemId);
        console.log("  AdminSystem address:", adminSystemAddress);

        ResourceId itemsNamespaceId = WorldResourceIdLib.encodeNamespace(ITEMS_NAMESPACE);
        try world.grantAccess(itemsNamespaceId, adminSystemAddress) {
            console.log("  Granted Items namespace access to AdminSystem");
        } catch {
            console.log("  Items namespace access grant to AdminSystem failed");
        }

        // Also add AdminSystem to the Admin table so it passes _requireAccessOrAdmin
        Admin.set(adminSystemAddress, true);
        console.log("  AdminSystem added to Admin table");

        // Grant ItemsSystem access to Items namespace (ItemsSystem calls ERC1155System internally)
        ResourceId itemsSystemResourceId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "ItemsSystem");
        address itemsSystemAddress = Systems.getSystem(itemsSystemResourceId);
        console.log("  ItemsSystem address:", itemsSystemAddress);

        try world.grantAccess(itemsNamespaceId, itemsSystemAddress) {
            console.log("  Granted Items namespace access to ItemsSystem");
        } catch {
            console.log("  Items namespace access grant to ItemsSystem failed");
        }

        // Grant ItemsSystem access to the specific ERC1155System in Items namespace
        ResourceId erc1155SystemId = _erc1155SystemId(ITEMS_NAMESPACE);
        try world.grantAccess(erc1155SystemId, itemsSystemAddress) {
            console.log("  Granted ERC1155System access to ItemsSystem");
        } catch {
            console.log("  ERC1155System access grant to ItemsSystem failed");
        }

        // Add ItemsSystem to Admin table as well
        Admin.set(itemsSystemAddress, true);
        console.log("  ItemsSystem added to Admin table");

        // Grant ItemCreationSystem access to Items namespace (createItem writes to Owners/TotalSupply/URIStorage)
        ResourceId itemCreationSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "ItemCreationSys");
        address itemCreationSystemAddress = Systems.getSystem(itemCreationSystemId);
        try world.grantAccess(itemsNamespaceId, itemCreationSystemAddress) {
            console.log("  Granted Items namespace access to ItemCreationSystem");
        } catch {
            console.log("  Items namespace access grant to ItemCreationSystem failed");
        }
        Admin.set(itemCreationSystemAddress, true);
        console.log("  ItemCreationSystem added to Admin table");

        // Grant MarketplaceSystem access to Items namespace (for listing items)
        // Note: MUD truncates "MarketplaceSystem" (17 chars) to "MarketplaceSyste" (16 chars)
        ResourceId marketplaceSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "MarketplaceSyste");
        address marketplaceSystemAddress = Systems.getSystem(marketplaceSystemId);
        console.log("  MarketplaceSystem address:", marketplaceSystemAddress);

        try world.grantAccess(itemsNamespaceId, marketplaceSystemAddress) {
            console.log("  Granted Items namespace access to MarketplaceSystem");
        } catch {
            console.log("  Items namespace access grant to MarketplaceSystem failed");
        }

        try world.grantAccess(erc1155SystemId, marketplaceSystemAddress) {
            console.log("  Granted ERC1155System access to MarketplaceSystem");
        } catch {
            console.log("  ERC1155System access grant to MarketplaceSystem failed");
        }

        // Grant MarketplaceSystem access to Gold namespace (for gold transfers)
        ResourceId goldNamespaceId = WorldResourceIdLib.encodeNamespace(GOLD_NAMESPACE);
        try world.grantAccess(goldNamespaceId, marketplaceSystemAddress) {
            console.log("  Granted Gold namespace access to MarketplaceSystem");
        } catch {
            console.log("  Gold namespace access grant to MarketplaceSystem failed");
        }

        // Grant MobSystem access to Admin table (for post-deployment mob creation)
        ResourceId mobSystemResourceId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "MobSystem");
        address mobSystemAddress = Systems.getSystem(mobSystemResourceId);
        console.log("  MobSystem address:", mobSystemAddress);
        Admin.set(mobSystemAddress, true);
        console.log("  MobSystem added to Admin table");

        // Set max players
        UltimateDominionConfig.setMaxPlayers(100);
        console.log("  Max players: 100");

        // Set system addresses for item/gold approvals
        // Non-root namespace systems run via regular call (not delegatecall),
        // so msg.sender at the ERC1155 puppet is the system's own address.
        // The config must store the actual System contract address so the client
        // approves the correct operator for item/gold transfers.
        UltimateDominionConfig.setLootManager(address(world));
        console.log("  LootManager address:", address(world));
        ResourceId shopSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "ShopSystem");
        address shopSysAddr = Systems.getSystem(shopSystemId);
        require(shopSysAddr != address(0), "ShopSystem not registered");
        UltimateDominionConfig.setShop(shopSysAddr);
        console.log("  Shop address:", shopSysAddr);
        UltimateDominionConfig.setMarketplace(address(world));
        console.log("  Marketplace address:", address(world));

        // Set marketplace fee configuration
        // Fee recipient is the deployer (treasury) - change this for production
        UltimateDominionConfig.setFeeRecipient(deployer);
        console.log("  Fee recipient:", deployer);
        // 300 basis points = 3%
        UltimateDominionConfig.setFeePercent(300);
        console.log("  Fee percent: 3% (300 basis points)");
    }

    function _configureGasStation() internal {
        console.log("Configuring GasStation...");

        // Look up the GasStation system address
        ResourceId gasStationSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "GasStationSys");
        address gasStationAddress = Systems.getSystem(gasStationSystemId);
        console.log("  GasStationSystem address:", gasStationAddress);

        // Grant GasStation access to Gold:Balances table for direct writes
        ResourceId goldBalancesTableId = WorldResourceIdLib.encode(RESOURCE_TABLE, GOLD_NAMESPACE, "Balances");
        try world.grantAccess(goldBalancesTableId, gasStationAddress) {
            console.log("  Granted Gold:Balances table access to GasStation");
        } catch {
            console.log("  Gold:Balances table access grant to GasStation failed");
        }

        // Grant GasStation access to Gold:TotalSupply table for direct writes
        ResourceId goldTotalSupplyTableId = WorldResourceIdLib.encode(RESOURCE_TABLE, GOLD_NAMESPACE, "TotalSupply");
        try world.grantAccess(goldTotalSupplyTableId, gasStationAddress) {
            console.log("  Granted Gold:TotalSupply table access to GasStation");
        } catch {
            console.log("  Gold:TotalSupply table access grant to GasStation failed");
        }

        // Set default configuration
        GasStationConfig.set(DEFAULT_ETH_PER_GOLD, DEFAULT_MAX_GOLD_PER_SWAP, DEFAULT_GAS_COOLDOWN, true);
        console.log("  GasStation config set (ethPerGold:", DEFAULT_ETH_PER_GOLD, ")");

        // NOTE: Fund the treasury post-deployment by calling UD__fundGasTreasury() with ETH value
        console.log("  Remember to fund the GasStation treasury with ETH!");
    }

    function _configureGameDelegation() internal {
        console.log("Configuring GameDelegationControl...");

        // Register the delegation control system manually (excluded from MUD worldgen)
        GameDelegationControl gameDelegation = new GameDelegationControl();
        ResourceId gameDelegationId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", GAME_DELEGATION_NAME);
        try world.registerSystem(gameDelegationId, System(address(gameDelegation)), true) {
            console.log("  GameDelegationControl registered at:", address(gameDelegation));
        } catch {
            console.log("  GameDelegationControl already registered, skipping");
        }

        console.log("Configuring whitelist...");

        bytes14 ns = "UD";

        // Whitelist all safe gameplay systems (25 systems)
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "CharacterCore"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "StatSystem"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "LevelSystem"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "ImplicitClassSys"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "EquipmentCore"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "EquipmentSystem"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "WeaponSystem"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "ArmorSystem"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "AccessorySystem"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "ConsumableSystem"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "MapSystem"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "MapSpawnSystem"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "CombatSystem"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "PvESystem"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "PvPSystem"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "EncounterSys"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "ShopSystem"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "MarketplaceSys"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "GasStationSys"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "LootManagerSyste"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "PveRewardSystem"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "PvpRewardSystem"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "WorldActionSys"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "FragmentSystem"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "UtilsSystem"), true);

        console.log("  25 gameplay systems whitelisted");
        console.log("  Blocked: AdminSystem, AdminShopSys, PauseSystem, UDConfigSys, ItemCreationSys, etc.");
    }

    function _transferItemsOwnership() internal {
        console.log("Transferring namespace ownership to World...");

        // Transfer Items namespace ownership to World so systems can mint items
        ResourceId itemsNamespaceId = WorldResourceIdLib.encodeNamespace(ITEMS_NAMESPACE);
        try world.transferOwnership(itemsNamespaceId, address(world)) {
            console.log("  Transferred Items namespace ownership to World");
        } catch {
            console.log("  Items namespace ownership transfer failed or already done");
        }

        // Transfer Gold namespace ownership to World so systems can mint gold
        ResourceId goldNamespaceId = WorldResourceIdLib.encodeNamespace(GOLD_NAMESPACE);
        try world.transferOwnership(goldNamespaceId, address(world)) {
            console.log("  Transferred Gold namespace ownership to World");
        } catch {
            console.log("  Gold namespace ownership transfer failed or already done");
        }
    }

    // ============ Game Data Seeding (inlined from SeedGameData) ============

    function _seedGameData() internal {
        // Get LootManager address - items are minted to World address since systems run via delegatecall
        lootManagerAddress = address(world); // Use World address since address(this) in systems = World
        console.log("LootManager/World address for items:", lootManagerAddress);

        // Get Items contract address (used as counter key)
        itemsCounterAddress = UltimateDominionConfig.getItems();
        console.log("Items contract address:", itemsCounterAddress);

        // Set initial map config (zones can expand this later)
        uint16 height = uint16(10);
        uint16 width = uint16(10);
        MapConfig.set(width, height);
        console.log("Map config set:", width, "x", height);

        // Set deployer as admin
        Admin.set(deployer, true);
        console.log("Admin set");

        // Initialize pause state (unpaused)
        Paused.set(false);
        console.log("Pause state initialized (unpaused)");

        // Set level experience requirements (core progression system)
        _setLevels();
        console.log("Level requirements set");

        // NOTE: Game content (effects, items, monsters, shops) is loaded via zone scripts
        // Use admin functions or zone loader TypeScript scripts to add content post-deployment:
        // - adminCreateEffect() for status effects, damage effects
        // - adminCreateItem() / adminCreateItems() for weapons, armor, consumables
        // - adminCreateMob() / adminCreateMobs() for monsters
        // - adminCreateShop() for shops with inventory

        console.log("Infrastructure seeding complete!");
        console.log(">>> Load game content using zone loader scripts <<<");
    }

    function _setLevels() internal {
        // Early game (1-10): Fast progression
        Levels.setExperience(1, 300);
        Levels.setExperience(2, 900);
        Levels.setExperience(3, 2700);
        Levels.setExperience(4, 6500);
        Levels.setExperience(5, 14000);
        Levels.setExperience(6, 23000);
        Levels.setExperience(7, 34000);
        Levels.setExperience(8, 48000);
        Levels.setExperience(9, 64000);
        Levels.setExperience(10, 85000);

        // Mid game (11-50): Moderate progression
        uint256 baseExp = 85000;
        for (uint256 level = 11; level <= 50; level++) {
            baseExp = baseExp + (level * 5000);
            Levels.setExperience(level, baseExp);
        }

        // Late game (51-100): Slow progression
        for (uint256 level = 51; level <= 100; level++) {
            baseExp = baseExp + (level * 15000);
            Levels.setExperience(level, baseExp);
        }
    }

    /**
     * @notice Create effects by writing directly to tables
     */
    function _createEffects() internal {
        string memory json = vm.readFile("effects.json");
        bytes memory data = vm.parseJson(json);

        StarterEffects memory effectsData = abi.decode(data, (StarterEffects));

        // Create Physical Damage effects
        for (uint256 i; i < effectsData.PhysicalDamages.length; i++) {
            bytes32 effectId = bytes32(bytes8(keccak256(abi.encode(effectsData.PhysicalDamages[i].name))));

            // Write to PhysicalDamageStats table
            PhysicalDamageStats.set(effectId, effectsData.PhysicalDamages[i].stats);

            // Write to Effects table
            Effects.set(effectId, EffectType.PhysicalDamage, true);

            console.log("Physical effect created:", i + 1);
            require(effectId == effectsData.PhysicalDamages[i].effectId, "Physical effect Id mismatch");
        }

        // Create Magic Damage effects
        for (uint256 i; i < effectsData.MagicDamages.length; i++) {
            bytes32 effectId = bytes32(bytes8(keccak256(abi.encode(effectsData.MagicDamages[i].name))));

            // Write to MagicDamageStats table
            MagicDamageStats.set(effectId, effectsData.MagicDamages[i].stats);

            // Write to Effects table
            Effects.set(effectId, EffectType.MagicDamage, true);

            console.log("Magic effect created:", i + 1);
            require(effectId == effectsData.MagicDamages[i].effectId, "Magical effect Id mismatch");
        }

        // Create Status effects
        for (uint256 i; i < effectsData.statusEffects.length; i++) {
            bytes32 effectId = bytes32(bytes8(keccak256(abi.encode(effectsData.statusEffects[i].name))));

            // Validate status effect
            StatusEffectValidityData memory validityData = effectsData.statusEffects[i].validity;
            if (validityData.validTime != 0) {
                require(validityData.validTurns == 0, "INVALID EFFECT: TIME");
                require(effectsData.statusEffects[i].stats.damagePerTick == 0, "INVALID EFFECT: WORLD EFFECT DAMAGE");
            } else if (validityData.validTime == 0) {
                require(validityData.validTurns != 0, "INVALID EFFECT: TURNS");
            }

            // Write to StatusEffectStats table
            StatusEffectStats.set(effectId, effectsData.statusEffects[i].stats);

            // Write to StatusEffectValidity table
            StatusEffectValidity.set(effectId, validityData);

            // Write to Effects table
            Effects.set(effectId, EffectType.StatusEffect, true);

            console.log("Status effect created:", i + 1);
            require(effectId == effectsData.statusEffects[i].effectId, "Status effect Id mismatch");
        }
    }

    /**
     * @notice Create items by writing directly to tables
     */
    function _createStarterItems() internal {
        string memory json = vm.readFile("items.json");
        bytes memory data = vm.parseJson(json);

        StarterItems memory itemsData = abi.decode(data, (StarterItems));

        uint256[] memory warriorItemIds = new uint256[](2);
        uint256[] memory rogueItemIds = new uint256[](2);
        uint256[] memory mageItemIds = new uint256[](1);

        // Create armor
        for (uint256 i = 0; i < itemsData.armor.length; i++) {
            ArmorTemplateDetails memory armorTemplate = itemsData.armor[i];

            uint256 itemId = _incrementItemsCounter();

            ArmorStatsData memory newArmor = ArmorStatsData({
                agiModifier: armorTemplate.stats.agiModifier,
                armorModifier: armorTemplate.stats.armorModifier,
                hpModifier: armorTemplate.stats.hpModifier,
                intModifier: armorTemplate.stats.intModifier,
                minLevel: armorTemplate.stats.minLevel,
                strModifier: armorTemplate.stats.strModifier,
                armorType: armorTemplate.stats.armorType
            });

            // Write to ArmorStats table
            ArmorStats.set(itemId, newArmor);

            // Write to StatRestrictions table
            StatRestrictions.set(itemId, armorTemplate.statRestrictions);

            // Write to Items table
            ItemsData memory newItem = ItemsData({
                itemType: ItemType.Armor,
                dropChance: armorTemplate.dropChance,
                price: armorTemplate.price,
                rarity: 1,
                stats: abi.encode(newArmor, armorTemplate.statRestrictions)
            });
            Items.set(itemId, newItem);

            // Mint supply to LootManager
            _mintItem(itemId, armorTemplate.initialSupply);

            // Set token URI
            _setTokenUri(itemId, armorTemplate.metadataUri);

            console.log("Armor created:", armorTemplate.name, "id:", itemId);

            if (i == 0) {
                warriorItemIds[0] = itemId;
            }
        }

        // Create weapons
        for (uint256 i = 0; i < itemsData.weapons.length; i++) {
            WeaponTemplateDetails memory weaponTemplate = itemsData.weapons[i];

            uint256 itemId = _incrementItemsCounter();

            WeaponStatsData memory newWeapon = WeaponStatsData({
                agiModifier: weaponTemplate.stats.agiModifier,
                effects: weaponTemplate.stats.effects,
                hpModifier: weaponTemplate.stats.hpModifier,
                intModifier: weaponTemplate.stats.intModifier,
                maxDamage: weaponTemplate.stats.maxDamage,
                minDamage: weaponTemplate.stats.minDamage,
                minLevel: weaponTemplate.stats.minLevel,
                strModifier: weaponTemplate.stats.strModifier
            });

            // Write to WeaponStats table
            WeaponStats.set(itemId, newWeapon);

            // Write to StatRestrictions table
            StatRestrictions.set(itemId, weaponTemplate.statRestrictions);

            // Write to Items table
            ItemsData memory newItem = ItemsData({
                itemType: ItemType.Weapon,
                dropChance: weaponTemplate.dropChance,
                price: weaponTemplate.price,
                rarity: 1,
                stats: abi.encode(newWeapon, weaponTemplate.statRestrictions)
            });
            Items.set(itemId, newItem);

            // Mint supply to LootManager
            _mintItem(itemId, weaponTemplate.initialSupply);

            // Set token URI
            _setTokenUri(itemId, weaponTemplate.metadataUri);

            console.log("Weapon created:", weaponTemplate.name, "id:", itemId);

            if (i == 0) {
                warriorItemIds[1] = itemId;
                rogueItemIds[0] = itemId;
                mageItemIds[0] = itemId;
            }

            if (i == 5) {
                rogueItemIds[1] = itemId;
            }
        }

        // Create consumables
        for (uint256 i = 0; i < itemsData.consumables.length; i++) {
            ConsumableTemplateDetails memory consumablesTemplate = itemsData.consumables[i];

            uint256 itemId = _incrementItemsCounter();

            ConsumableStatsData memory newConsumable = ConsumableStatsData({
                effects: consumablesTemplate.stats.effects,
                maxDamage: consumablesTemplate.stats.maxDamage,
                minDamage: consumablesTemplate.stats.minDamage,
                minLevel: consumablesTemplate.stats.minLevel
            });

            // Write to ConsumableStats table
            ConsumableStats.set(itemId, newConsumable);

            // Write to StatRestrictions table
            StatRestrictions.set(itemId, consumablesTemplate.statRestrictions);

            // Write to Items table
            ItemsData memory newItem = ItemsData({
                itemType: ItemType.Consumable,
                dropChance: consumablesTemplate.dropChance,
                price: consumablesTemplate.price,
                rarity: 1,
                stats: abi.encode(newConsumable, consumablesTemplate.statRestrictions)
            });
            Items.set(itemId, newItem);

            // Mint supply to LootManager
            _mintItem(itemId, consumablesTemplate.initialSupply);

            // Set token URI
            _setTokenUri(itemId, consumablesTemplate.metadataUri);

            console.log("Consumable created:", consumablesTemplate.name, "id:", itemId);
        }

        // Set starter items for each class
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 1;
        amounts[1] = 1;

        StarterItemsTable.set(Classes.Warrior, warriorItemIds, amounts);
        console.log("Warrior starter items set");

        StarterItemsTable.set(Classes.Rogue, rogueItemIds, amounts);
        console.log("Rogue starter items set");

        uint256[] memory mageAmounts = new uint256[](1);
        mageAmounts[0] = 1;
        StarterItemsTable.set(Classes.Mage, mageItemIds, mageAmounts);
        console.log("Mage starter items set");
    }

    /**
     * @notice Create shops by writing directly to tables
     */
    function _createShops() internal {
        string memory json = vm.readFile("shops.json");
        bytes memory shopTemplatesBytes = vm.parseJson(json, ".shops");

        ShopTemplate[] memory shopTemplates = abi.decode(shopTemplatesBytes, (ShopTemplate[]));

        for (uint256 i = 0; i < shopTemplates.length; i++) {
            ShopTemplate memory shopTemplate = shopTemplates[i];

            ShopsData memory newShop = ShopsData({
                gold: shopTemplate.gold,
                maxGold: shopTemplate.maxGold,
                priceMarkup: shopTemplate.priceMarkup,
                priceMarkdown: shopTemplate.priceMarkdown,
                restockTimestamp: shopTemplate.restockTimestamp,
                sellableItems: shopTemplate.sellableItems,
                buyableItems: shopTemplate.buyableItems,
                restock: shopTemplate.restock,
                stock: shopTemplate.stock
            });

            // Create mob
            uint256 mobId = _incrementMobId();
            Mobs.set(mobId, MobType.Shop, abi.encode(newShop), "https://github.com/raid-guild/ultimate-dominion");

            // Spawn mob at location
            uint16 x = uint16(shopTemplate.location[0]);
            uint16 y = uint16(shopTemplate.location[1]);
            bytes32 entityId = bytes32(abi.encodePacked(uint32(mobId), uint192(_incrementMobCounter(mobId)), x, y));

            // Write shop data
            Shops.set(entityId, newShop);

            // Write position
            Position.set(entityId, x, y);
            EntitiesAtPosition.pushEntities(x, y, entityId);
            Spawned.set(entityId, true);

            console.log("Shop created at:", shopTemplate.location[0], ",", shopTemplate.location[1]);
        }
    }

    /**
     * @notice Create monsters by writing directly to tables
     */
    function _createMonsters() internal {
        string memory json = vm.readFile("monsters.json");
        bytes memory monsterStatsData = vm.parseJson(json, ".monsters");

        MonsterTemplateDetails[] memory monsterTemplateDetails =
            abi.decode(monsterStatsData, (MonsterTemplateDetails[]));

        for (uint256 i = 0; i < monsterTemplateDetails.length; i++) {
            MonsterTemplateDetails memory monsterTemplate = monsterTemplateDetails[i];

            MonsterStats memory newMonster = MonsterStats({
                agility: monsterTemplate.stats.agility,
                armor: monsterTemplate.stats.armor,
                class: monsterTemplate.stats.class,
                experience: monsterTemplate.stats.experience,
                hitPoints: monsterTemplate.stats.hitPoints,
                level: monsterTemplate.stats.level,
                intelligence: monsterTemplate.stats.intelligence,
                inventory: monsterTemplate.stats.inventory,
                strength: monsterTemplate.stats.strength
            });

            // Create mob template (don't spawn yet)
            uint256 mobId = _incrementMobId();
            Mobs.set(mobId, MobType.Monster, abi.encode(newMonster), monsterTemplate.metadataUri);

            // Add to MobsByLevel
            MobsByLevel.pushMobIds(newMonster.level, mobId);

            console.log("Monster created:", monsterTemplate.name, "id:", mobId);
        }
    }

    // ============ Helper functions for game data seeding ============

    /**
     * @notice Increment items counter and return new item ID
     */
    function _incrementItemsCounter() internal returns (uint256) {
        uint256 itemId = Counters.getCounter(itemsCounterAddress, 0) + 1;
        Counters.setCounter(itemsCounterAddress, 0, itemId);
        return itemId;
    }

    /**
     * @notice Increment mob ID counter and return new mob ID
     * @dev Uses MobSystem address as counter key (same as MobSystem does)
     */
    function _incrementMobId() internal returns (uint256) {
        // Get MobSystem address for counter key
        if (mobCounterAddress == address(0)) {
            mobCounterAddress = Systems.getSystem(_mobSystemId(WORLD_NAMESPACE));
            console.log("MobSystem address:", mobCounterAddress);
        }
        uint256 mobId = Counters.getCounter(mobCounterAddress, 0) + 1;
        Counters.setCounter(mobCounterAddress, 0, mobId);
        return mobId;
    }

    /**
     * @notice Increment spawn counter for a specific mob
     */
    function _incrementMobCounter(uint256 mobId) internal returns (uint256) {
        uint256 mobCounter = Counters.getCounter(mobCounterAddress, mobId) + 1;
        require(mobCounter < type(uint192).max, "MOB SYSTEM: Cannot spawn this monster any more");
        Counters.setCounter(mobCounterAddress, mobId, mobCounter);
        return mobCounter;
    }

    /**
     * @notice Mint items to LootManager by writing directly to ERC1155 tables
     */
    function _mintItem(uint256 itemId, uint256 supply) internal {
        ResourceId ownersTableId = _ownersTableId(ITEMS_NAMESPACE);
        ResourceId totalSupplyTableId = _totalSupplyTableId(ITEMS_NAMESPACE);

        // Set owner balance
        Owners.setBalance(ownersTableId, lootManagerAddress, itemId, supply);

        // Set total supply (currentSupply and totalSupply)
        TotalSupply.set(totalSupplyTableId, itemId, supply, supply);
    }

    /**
     * @notice Set token URI by writing directly to ERC1155URIStorage table
     */
    function _setTokenUri(uint256 itemId, string memory uri) internal {
        ResourceId uriStorageTableId = _erc1155URIStorageTableId(ITEMS_NAMESPACE);
        ERC1155URIStorage.setUri(uriStorageTableId, itemId, uri);
    }
}
