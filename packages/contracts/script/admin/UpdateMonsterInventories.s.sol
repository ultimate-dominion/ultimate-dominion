// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {IWorld} from "@world/IWorld.sol";
import {Mobs} from "@codegen/index.sol";
import {Classes} from "@codegen/common.sol";
import {MonsterStats} from "@interfaces/Structs.sol";
import {ERC1155URIStorage} from "@erc1155/tables/ERC1155URIStorage.sol";
import {_erc1155URIStorageTableId} from "@erc1155/utils.sol";
import {ITEMS_NAMESPACE} from "../../constants.sol";
import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";

/**
 * @title UpdateMonsterInventories
 * @notice Rewrites all monster template inventories for V4 drop table redesign.
 *         Adds V3 epics, expands consumable pools with level gating,
 *         adds cross-drops to L7+ monsters, moves Spore Cloud to Fungal Shaman.
 *
 * CRITICAL: Combat weapons MUST remain at index 0 (non-boss) or 0+1 (boss).
 *
 * Usage:
 *   forge script script/admin/UpdateMonsterInventories.s.sol \
 *     --sig "run(address)" <WORLD_ADDRESS> \
 *     --rpc-url <RPC> --broadcast --skip-simulation
 */
contract UpdateMonsterInventories is Script {
    IWorld public world;
    ResourceId internal uriTableId;

    // Item ID cache (resolved at runtime from metadata URIs)
    // Weapons - monster
    uint256 internal razorClaws;
    uint256 internal elementalBurst;
    uint256 internal stoneFist;
    uint256 internal crushingSlam;
    uint256 internal venomousBite;
    uint256 internal darkMagic;
    uint256 internal shadowStrike;
    uint256 internal basiliskFangs;
    uint256 internal petrifyingGaze;

    // Weapons - player R0
    uint256 internal brokenSword;
    uint256 internal wornShortbow;
    uint256 internal crackedWand;

    // Weapons - player R1
    uint256 internal ironAxe;
    uint256 internal huntingBow;
    uint256 internal apprenticeStaff;
    uint256 internal lightMace;
    uint256 internal shortbow;
    uint256 internal channelingRod;
    uint256 internal notchedBlade;

    // Weapons - player R2
    uint256 internal warhammer;
    uint256 internal longbow;
    uint256 internal mageStaff;
    uint256 internal sporecapWand;
    uint256 internal notchedCleaver;
    uint256 internal crystalShard;
    uint256 internal webspinnerBow;

    // Weapons - player R3
    uint256 internal direRatFang;
    uint256 internal gnarledCudgel;
    uint256 internal boneStaff;
    uint256 internal stoneMaul;
    uint256 internal darkwoodBow;
    uint256 internal smolderingRod;

    // Weapons - player R4
    uint256 internal trollhideCleaver;
    uint256 internal phasefang;
    uint256 internal drakescaleStaff;

    // Armor - R0
    uint256 internal tatteredCloth;
    uint256 internal wornLeatherVest;
    uint256 internal rustyChainmail;

    // Armor - R1
    uint256 internal paddedArmor;
    uint256 internal leatherJerkin;
    uint256 internal apprenticeRobes;
    uint256 internal studdedLeather;
    uint256 internal scoutArmor;
    uint256 internal acolyteVestments;

    // Armor - R2
    uint256 internal etchedChainmail;
    uint256 internal rangerLeathers;
    uint256 internal mageRobes;
    uint256 internal spiderSilkWraps;

    // Armor - R3
    uint256 internal carvedStonePlate;
    uint256 internal stalkersCloak;
    uint256 internal scorchedScaleVest;

    // Armor - R4
    uint256 internal drakesCowl;

    // Consumables
    uint256 internal minorHp;
    uint256 internal healthPotion;
    uint256 internal greaterHp;
    uint256 internal antidote;
    uint256 internal fortifyingStew;
    uint256 internal quickeningBerries;
    uint256 internal focusingTea;
    uint256 internal bloodrageTonic;
    uint256 internal stoneskinSalve;
    uint256 internal trollbloodAle;
    uint256 internal venomVial;
    uint256 internal sporeCloud;
    uint256 internal sappingPoison;
    uint256 internal flashpowder;

    // Junk consumables
    uint256 internal ratTooth;
    uint256 internal caveMoss;
    uint256 internal crackedBone;
    uint256 internal dullCrystal;
    uint256 internal tatteredHide;
    uint256 internal bentNail;

    function run(address worldAddress) external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        world = IWorld(worldAddress);
        StoreSwitch.setStoreAddress(worldAddress);
        uriTableId = _erc1155URIStorageTableId(ITEMS_NAMESPACE);

        console.log("=== UpdateMonsterInventories ===");

        _resolveAllItemIds(worldAddress);
        _updateAllMonsters();

        vm.stopBroadcast();
        console.log("=== UpdateMonsterInventories Complete ===");
    }

    function _resolveAllItemIds(address worldAddress) internal {
        console.log("Resolving item IDs from metadata URIs...");
        uint256 total = IWorld(worldAddress).UD__getCurrentItemsCounter();

        for (uint256 i = 1; i <= total; i++) {
            string memory uri = ERC1155URIStorage.getUri(uriTableId, i);
            bytes32 h = keccak256(bytes(uri));

            // Monster weapons
            if (h == keccak256("weapon:monster_razor_claws")) razorClaws = i;
            else if (h == keccak256("weapon:monster_elemental_burst")) elementalBurst = i;
            else if (h == keccak256("weapon:monster_stone_fist")) stoneFist = i;
            else if (h == keccak256("weapon:monster_crushing_slam")) crushingSlam = i;
            else if (h == keccak256("weapon:monster_venomous_bite") || h == keccak256("weapon:venomous_bite")) venomousBite = i;
            else if (h == keccak256("weapon:monster_dark_magic")) darkMagic = i;
            else if (h == keccak256("weapon:monster_shadow_strike") || h == keccak256("weapon:shadow_strike")) shadowStrike = i;
            else if (h == keccak256("weapon:basilisk_fangs") || h == keccak256("weapon:basilisk_fang") || h == keccak256("basilisk_fang")) basiliskFangs = i;
            else if (h == keccak256("weapon:petrifying_gaze") || h == keccak256("weapon:basilisk_gaze") || h == keccak256("basilisk_gaze")) petrifyingGaze = i;
            // Player weapons R0
            else if (h == keccak256("weapon:broken_sword")) brokenSword = i;
            else if (h == keccak256("weapon:worn_shortbow")) wornShortbow = i;
            else if (h == keccak256("weapon:cracked_wand")) crackedWand = i;
            // Player weapons R1
            else if (h == keccak256("weapon:iron_axe")) ironAxe = i;
            else if (h == keccak256("weapon:hunting_bow")) huntingBow = i;
            else if (h == keccak256("weapon:apprentice_staff")) apprenticeStaff = i;
            else if (h == keccak256("weapon:light_mace")) lightMace = i;
            else if (h == keccak256("weapon:shortbow")) shortbow = i;
            else if (h == keccak256("weapon:channeling_rod")) channelingRod = i;
            else if (h == keccak256("weapon:notched_blade")) notchedBlade = i;
            // Player weapons R2
            else if (h == keccak256("weapon:warhammer")) warhammer = i;
            else if (h == keccak256("weapon:longbow")) longbow = i;
            else if (h == keccak256("weapon:mage_staff")) mageStaff = i;
            else if (h == keccak256("weapon:sporecap_wand")) sporecapWand = i;
            else if (h == keccak256("weapon:notched_cleaver")) notchedCleaver = i;
            else if (h == keccak256("weapon:crystal_shard")) crystalShard = i;
            else if (h == keccak256("weapon:webspinner_bow")) webspinnerBow = i;
            // Player weapons R3
            else if (h == keccak256("weapon:dire_rat_fang")) direRatFang = i;
            else if (h == keccak256("weapon:gnarled_cudgel")) gnarledCudgel = i;
            else if (h == keccak256("weapon:bone_staff")) boneStaff = i;
            else if (h == keccak256("weapon:stone_maul")) stoneMaul = i;
            else if (h == keccak256("weapon:darkwood_bow")) darkwoodBow = i;
            else if (h == keccak256("weapon:smoldering_rod")) smolderingRod = i;
            // Player weapons R4
            else if (h == keccak256("weapon:trollhide_cleaver") || h == keccak256("trollhide_cleaver")) trollhideCleaver = i;
            else if (h == keccak256("weapon:phasefang") || h == keccak256("phasefang")) phasefang = i;
            else if (h == keccak256("weapon:drakescale_staff") || h == keccak256("drakescale_staff")) drakescaleStaff = i;
            // Armor R0
            else if (h == keccak256("armor:tattered_cloth")) tatteredCloth = i;
            else if (h == keccak256("armor:worn_leather_vest")) wornLeatherVest = i;
            else if (h == keccak256("armor:rusty_chainmail")) rustyChainmail = i;
            // Armor R1
            else if (h == keccak256("armor:padded_armor")) paddedArmor = i;
            else if (h == keccak256("armor:leather_jerkin")) leatherJerkin = i;
            else if (h == keccak256("armor:apprentice_robes")) apprenticeRobes = i;
            else if (h == keccak256("armor:studded_leather")) studdedLeather = i;
            else if (h == keccak256("armor:scout_armor")) scoutArmor = i;
            else if (h == keccak256("armor:acolyte_vestments")) acolyteVestments = i;
            // Armor R2
            else if (h == keccak256("armor:etched_chainmail")) etchedChainmail = i;
            else if (h == keccak256("armor:ranger_leathers")) rangerLeathers = i;
            else if (h == keccak256("armor:mage_robes")) mageRobes = i;
            else if (h == keccak256("armor:spider_silk_wraps")) spiderSilkWraps = i;
            // Armor R3
            else if (h == keccak256("armor:carved_stone_plate")) carvedStonePlate = i;
            else if (h == keccak256("armor:stalkers_cloak")) stalkersCloak = i;
            else if (h == keccak256("armor:scorched_scale_vest")) scorchedScaleVest = i;
            // Armor R4
            else if (h == keccak256("armor:drakes_cowl") || h == keccak256("drakes_cowl")) drakesCowl = i;
            // Consumables
            else if (h == keccak256("consumable:minor_health_potion")) minorHp = i;
            else if (h == keccak256("consumable:health_potion")) healthPotion = i;
            else if (h == keccak256("consumable:greater_health_potion")) greaterHp = i;
            else if (h == keccak256("consumable:antidote")) antidote = i;
            else if (h == keccak256("consumable:fortifying_stew")) fortifyingStew = i;
            else if (h == keccak256("consumable:quickening_berries")) quickeningBerries = i;
            else if (h == keccak256("consumable:focusing_tea")) focusingTea = i;
            else if (h == keccak256("consumable:bloodrage_tonic")) bloodrageTonic = i;
            else if (h == keccak256("consumable:stoneskin_salve")) stoneskinSalve = i;
            else if (h == keccak256("consumable:trollblood_ale")) trollbloodAle = i;
            else if (h == keccak256("consumable:venom_vial")) venomVial = i;
            else if (h == keccak256("consumable:spore_cloud")) sporeCloud = i;
            else if (h == keccak256("consumable:sapping_poison")) sappingPoison = i;
            else if (h == keccak256("consumable:flashpowder")) flashpowder = i;
            // Junk
            else if (h == keccak256("consumable:rat_tooth")) ratTooth = i;
            else if (h == keccak256("consumable:cave_moss")) caveMoss = i;
            else if (h == keccak256("consumable:cracked_bone")) crackedBone = i;
            else if (h == keccak256("consumable:dull_crystal")) dullCrystal = i;
            else if (h == keccak256("consumable:tattered_hide")) tatteredHide = i;
            else if (h == keccak256("consumable:bent_nail")) bentNail = i;
        }

        // Verify critical items resolved
        require(razorClaws != 0, "razorClaws not found");
        require(basiliskFangs != 0, "basiliskFangs not found");
        require(minorHp != 0, "minorHp not found");
        require(trollhideCleaver != 0, "trollhideCleaver not found");
        console.log("  All item IDs resolved");
    }

    function _updateAllMonsters() internal {
        // --- Mob 1: Dire Rat (L1) ---
        _setInventory(1, _direRat());
        // --- Mob 2: Fungal Shaman (L2) ---
        _setInventory(2, _fungalShaman());
        // --- Mob 3: Cavern Brute (L3) ---
        _setInventory(3, _cavernBrute());
        // --- Mob 4: Crystal Elemental (L4) ---
        _setInventory(4, _crystalElemental());
        // --- Mob 5: Ironhide Troll (L5) ---
        _setInventory(5, _ironhideTroll());
        // --- Mob 6: Phase Spider (L6) ---
        _setInventory(6, _phaseSpider());
        // --- Mob 7: Bonecaster (L7) ---
        _setInventory(7, _bonecaster());
        // --- Mob 8: Rock Golem (L8) ---
        _setInventory(8, _rockGolem());
        // --- Mob 9: Pale Stalker (L9) ---
        _setInventory(9, _paleStalker());
        // --- Mob 10: Dusk Drake (L10) ---
        _setInventory(10, _duskDrake());
        // --- Mob 11: Basilisk (L10 Boss) ---
        // Basilisk uses a fresh MonsterStats (V3 data may not abi.decode cleanly)
        _setBasiliskInventory();

        console.log("  All 11 monster inventories updated");
    }

    function _setInventory(uint256 mobId, uint256[] memory newInv) internal {
        MonsterStats memory stats = abi.decode(Mobs.getMobStats(mobId), (MonsterStats));
        stats.inventory = newInv;
        Mobs.setMobStats(mobId, abi.encode(stats));
        console.log("  Updated mob", mobId, "items:", newInv.length);
    }

    function _setBasiliskInventory() internal {
        // Rebuild Basilisk MonsterStats from scratch (V3 stats preserved)
        MonsterStats memory stats = MonsterStats({
            agility: 12,
            armor: 4,
            class: Classes.Warrior,
            experience: 10000,
            hasBossAI: true,
            hitPoints: 100,
            intelligence: 10,
            inventory: _basilisk(),
            level: 10,
            strength: 20
        });
        Mobs.setMobStats(12, abi.encode(stats));
        console.log("  Updated mob", 12, "items:", 23);
    }

    // =========================================================================
    //  MONSTER INVENTORIES
    //  Combat weapons at index 0 (non-boss) or 0+1 (boss)
    // =========================================================================

    function _direRat() internal view returns (uint256[] memory inv) {
        inv = new uint256[](16);
        uint256 i;
        inv[i++] = razorClaws;          // [0] combat weapon
        inv[i++] = brokenSword;
        inv[i++] = wornShortbow;
        inv[i++] = crackedWand;
        inv[i++] = tatteredCloth;
        inv[i++] = wornLeatherVest;
        inv[i++] = direRatFang;          // signature R3
        inv[i++] = minorHp;
        inv[i++] = antidote;
        inv[i++] = fortifyingStew;
        inv[i++] = quickeningBerries;
        inv[i++] = focusingTea;
        inv[i++] = ratTooth;
        inv[i++] = caveMoss;
        inv[i++] = crackedBone;
        inv[i++] = bentNail;
    }

    function _fungalShaman() internal view returns (uint256[] memory inv) {
        inv = new uint256[](17);
        uint256 i;
        inv[i++] = elementalBurst;       // [0] combat weapon
        inv[i++] = crackedWand;
        inv[i++] = apprenticeStaff;
        inv[i++] = tatteredCloth;
        inv[i++] = apprenticeRobes;
        inv[i++] = leatherJerkin;
        inv[i++] = sporecapWand;          // signature R2
        inv[i++] = sporeCloud;            // signature consumable (moved from Drake)
        inv[i++] = minorHp;
        inv[i++] = antidote;
        inv[i++] = fortifyingStew;
        inv[i++] = quickeningBerries;
        inv[i++] = focusingTea;
        inv[i++] = ratTooth;
        inv[i++] = caveMoss;
        inv[i++] = crackedBone;
        inv[i++] = bentNail;
    }

    function _cavernBrute() internal view returns (uint256[] memory inv) {
        inv = new uint256[](17);
        uint256 i;
        inv[i++] = stoneFist;             // [0] combat weapon
        inv[i++] = ironAxe;
        inv[i++] = brokenSword;
        inv[i++] = paddedArmor;
        inv[i++] = rustyChainmail;
        inv[i++] = wornLeatherVest;
        inv[i++] = notchedCleaver;        // signature R2
        inv[i++] = minorHp;
        inv[i++] = antidote;
        inv[i++] = fortifyingStew;
        inv[i++] = quickeningBerries;
        inv[i++] = focusingTea;
        inv[i++] = ratTooth;
        inv[i++] = caveMoss;
        inv[i++] = crackedBone;
        inv[i++] = bentNail;
        inv[i++] = tatteredHide;
    }

    function _crystalElemental() internal view returns (uint256[] memory inv) {
        inv = new uint256[](19);
        uint256 i;
        inv[i++] = elementalBurst;        // [0] combat weapon
        inv[i++] = channelingRod;
        inv[i++] = apprenticeStaff;
        inv[i++] = crackedWand;
        inv[i++] = acolyteVestments;
        inv[i++] = apprenticeRobes;
        inv[i++] = tatteredCloth;
        inv[i++] = crystalShard;           // signature R2
        inv[i++] = minorHp;
        inv[i++] = healthPotion;           // L4 gate
        inv[i++] = antidote;
        inv[i++] = fortifyingStew;
        inv[i++] = quickeningBerries;
        inv[i++] = focusingTea;
        inv[i++] = caveMoss;
        inv[i++] = crackedBone;
        inv[i++] = dullCrystal;
        inv[i++] = bentNail;
        inv[i++] = tatteredHide;
    }

    function _ironhideTroll() internal view returns (uint256[] memory inv) {
        inv = new uint256[](28);
        uint256 i;
        inv[i++] = crushingSlam;           // [0] combat weapon
        inv[i++] = lightMace;
        inv[i++] = notchedBlade;
        inv[i++] = ironAxe;
        inv[i++] = brokenSword;
        inv[i++] = studdedLeather;
        inv[i++] = paddedArmor;
        inv[i++] = rustyChainmail;
        inv[i++] = gnarledCudgel;          // signature R3
        inv[i++] = trollhideCleaver;       // signature R4 epic
        inv[i++] = bloodrageTonic;         // signature consumable
        inv[i++] = trollbloodAle;          // signature consumable
        inv[i++] = minorHp;
        inv[i++] = healthPotion;
        inv[i++] = antidote;
        inv[i++] = fortifyingStew;
        inv[i++] = quickeningBerries;
        inv[i++] = focusingTea;
        inv[i++] = stoneskinSalve;
        inv[i++] = venomVial;
        inv[i++] = sporeCloud;
        inv[i++] = sappingPoison;
        inv[i++] = flashpowder;
        inv[i++] = crackedBone;
        inv[i++] = bentNail;
        inv[i++] = tatteredHide;
        inv[i++] = dullCrystal;
        inv[i++] = caveMoss;
    }

    function _phaseSpider() internal view returns (uint256[] memory inv) {
        inv = new uint256[](28);
        uint256 i;
        inv[i++] = venomousBite;           // [0] combat weapon
        inv[i++] = shortbow;
        inv[i++] = huntingBow;
        inv[i++] = wornShortbow;
        inv[i++] = scoutArmor;
        inv[i++] = leatherJerkin;
        inv[i++] = wornLeatherVest;
        inv[i++] = webspinnerBow;          // signature R2
        inv[i++] = spiderSilkWraps;        // signature R2
        inv[i++] = phasefang;              // signature R4 epic
        inv[i++] = venomVial;              // signature consumable
        inv[i++] = minorHp;
        inv[i++] = healthPotion;
        inv[i++] = antidote;
        inv[i++] = fortifyingStew;
        inv[i++] = quickeningBerries;
        inv[i++] = focusingTea;
        inv[i++] = bloodrageTonic;
        inv[i++] = stoneskinSalve;
        inv[i++] = trollbloodAle;
        inv[i++] = sporeCloud;
        inv[i++] = sappingPoison;
        inv[i++] = flashpowder;
        inv[i++] = crackedBone;
        inv[i++] = tatteredHide;
        inv[i++] = dullCrystal;
        inv[i++] = bentNail;
        inv[i++] = caveMoss;
    }

    function _bonecaster() internal view returns (uint256[] memory inv) {
        inv = new uint256[](30);
        uint256 i;
        inv[i++] = darkMagic;             // [0] combat weapon
        inv[i++] = mageStaff;
        inv[i++] = channelingRod;
        inv[i++] = apprenticeStaff;
        inv[i++] = crackedWand;
        inv[i++] = mageRobes;
        inv[i++] = acolyteVestments;
        inv[i++] = apprenticeRobes;
        inv[i++] = boneStaff;             // signature R3
        inv[i++] = sporecapWand;           // cross-drop R2
        inv[i++] = minorHp;
        inv[i++] = healthPotion;
        inv[i++] = greaterHp;              // L7 gate
        inv[i++] = antidote;
        inv[i++] = fortifyingStew;
        inv[i++] = quickeningBerries;
        inv[i++] = focusingTea;
        inv[i++] = bloodrageTonic;
        inv[i++] = stoneskinSalve;
        inv[i++] = trollbloodAle;
        inv[i++] = venomVial;
        inv[i++] = sporeCloud;
        inv[i++] = sappingPoison;
        inv[i++] = flashpowder;
        inv[i++] = crackedBone;
        inv[i++] = dullCrystal;
        inv[i++] = bentNail;
        inv[i++] = caveMoss;
        inv[i++] = tatteredHide;
        inv[i++] = ratTooth;
    }

    function _rockGolem() internal view returns (uint256[] memory inv) {
        inv = new uint256[](33);
        uint256 i;
        inv[i++] = crushingSlam;           // [0] combat weapon
        inv[i++] = warhammer;
        inv[i++] = lightMace;
        inv[i++] = notchedBlade;
        inv[i++] = ironAxe;
        inv[i++] = brokenSword;
        inv[i++] = etchedChainmail;
        inv[i++] = studdedLeather;
        inv[i++] = paddedArmor;
        inv[i++] = rustyChainmail;
        inv[i++] = stoneMaul;              // signature R3
        inv[i++] = carvedStonePlate;       // signature R3
        inv[i++] = stoneskinSalve;         // signature consumable
        inv[i++] = gnarledCudgel;          // cross-drop R3
        inv[i++] = minorHp;
        inv[i++] = healthPotion;
        inv[i++] = greaterHp;
        inv[i++] = antidote;
        inv[i++] = fortifyingStew;
        inv[i++] = quickeningBerries;
        inv[i++] = focusingTea;
        inv[i++] = bloodrageTonic;
        inv[i++] = trollbloodAle;
        inv[i++] = venomVial;
        inv[i++] = sporeCloud;
        inv[i++] = sappingPoison;
        inv[i++] = flashpowder;
        inv[i++] = crackedBone;
        inv[i++] = dullCrystal;
        inv[i++] = tatteredHide;
        inv[i++] = bentNail;
        inv[i++] = caveMoss;
        inv[i++] = ratTooth;
    }

    function _paleStalker() internal view returns (uint256[] memory inv) {
        inv = new uint256[](32);
        uint256 i;
        inv[i++] = shadowStrike;           // [0] combat weapon
        inv[i++] = longbow;
        inv[i++] = shortbow;
        inv[i++] = huntingBow;
        inv[i++] = wornShortbow;
        inv[i++] = rangerLeathers;
        inv[i++] = scoutArmor;
        inv[i++] = leatherJerkin;
        inv[i++] = wornLeatherVest;
        inv[i++] = darkwoodBow;            // signature R3
        inv[i++] = stalkersCloak;          // signature R3
        inv[i++] = flashpowder;            // signature consumable
        inv[i++] = webspinnerBow;          // cross-drop R2
        inv[i++] = direRatFang;            // cross-drop R3
        inv[i++] = minorHp;
        inv[i++] = healthPotion;
        inv[i++] = greaterHp;
        inv[i++] = antidote;
        inv[i++] = fortifyingStew;
        inv[i++] = quickeningBerries;
        inv[i++] = focusingTea;
        inv[i++] = bloodrageTonic;
        inv[i++] = stoneskinSalve;
        inv[i++] = trollbloodAle;
        inv[i++] = venomVial;
        inv[i++] = sporeCloud;
        inv[i++] = sappingPoison;
        inv[i++] = crackedBone;
        inv[i++] = dullCrystal;
        inv[i++] = tatteredHide;
        inv[i++] = bentNail;
        inv[i++] = caveMoss;
    }

    function _duskDrake() internal view returns (uint256[] memory inv) {
        inv = new uint256[](39);
        uint256 i;
        inv[i++] = elementalBurst;         // [0] combat weapon
        inv[i++] = mageStaff;
        inv[i++] = warhammer;
        inv[i++] = longbow;
        inv[i++] = channelingRod;
        inv[i++] = lightMace;
        inv[i++] = shortbow;
        inv[i++] = notchedBlade;
        inv[i++] = mageRobes;
        inv[i++] = etchedChainmail;
        inv[i++] = rangerLeathers;
        inv[i++] = acolyteVestments;
        inv[i++] = scoutArmor;
        inv[i++] = studdedLeather;
        inv[i++] = smolderingRod;          // signature R3
        inv[i++] = scorchedScaleVest;      // signature R3
        inv[i++] = drakescaleStaff;        // signature R4 epic
        inv[i++] = drakesCowl;             // signature R4 epic
        inv[i++] = boneStaff;              // cross-drop R3
        inv[i++] = minorHp;
        inv[i++] = healthPotion;
        inv[i++] = greaterHp;
        inv[i++] = antidote;
        inv[i++] = fortifyingStew;
        inv[i++] = quickeningBerries;
        inv[i++] = focusingTea;
        inv[i++] = bloodrageTonic;
        inv[i++] = stoneskinSalve;
        inv[i++] = trollbloodAle;
        inv[i++] = venomVial;
        inv[i++] = sporeCloud;
        inv[i++] = sappingPoison;
        inv[i++] = flashpowder;
        inv[i++] = crackedBone;
        inv[i++] = dullCrystal;
        inv[i++] = tatteredHide;
        inv[i++] = bentNail;
        inv[i++] = caveMoss;
        inv[i++] = ratTooth;
    }

    function _basilisk() internal view returns (uint256[] memory inv) {
        inv = new uint256[](23);
        uint256 i;
        inv[i++] = basiliskFangs;          // [0] combat weapon
        inv[i++] = petrifyingGaze;         // [1] combat weapon (boss)
        inv[i++] = trollhideCleaver;
        inv[i++] = phasefang;
        inv[i++] = drakescaleStaff;
        inv[i++] = drakesCowl;
        inv[i++] = carvedStonePlate;
        inv[i++] = stalkersCloak;
        inv[i++] = scorchedScaleVest;
        inv[i++] = minorHp;
        inv[i++] = healthPotion;
        inv[i++] = greaterHp;
        inv[i++] = antidote;
        inv[i++] = fortifyingStew;
        inv[i++] = quickeningBerries;
        inv[i++] = focusingTea;
        inv[i++] = bloodrageTonic;
        inv[i++] = stoneskinSalve;
        inv[i++] = trollbloodAle;
        inv[i++] = venomVial;
        inv[i++] = sporeCloud;
        inv[i++] = sappingPoison;
        inv[i++] = flashpowder;
    }
}
