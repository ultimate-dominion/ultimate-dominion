// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IWorld} from "@world/IWorld.sol";

/**
 * @title SeedFragmentMetadata
 * @notice Seeds all 8 fragment narratives via setFragmentMetadata (admin-gated).
 *
 * Usage:
 *   source .env.mainnet && forge script script/SeedFragmentMetadata.s.sol \
 *     --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" \
 *     --broadcast --skip-simulation --sig "run(address)" $WORLD_ADDRESS
 */
contract SeedFragmentMetadata is Script {
    function run(address _worldAddress) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        IWorld world = IWorld(_worldAddress);

        console.log("=== SeedFragmentMetadata ===");
        console.log("World:", _worldAddress);

        // Fragment I: The Awakening
        world.UD__setFragmentMetadata(
            1,
            "The Awakening",
            "You open your eyes to darkness. Cold stone beneath your back. The taste of dust and something... older.\n\nHow long have you been here? Days? Years? Time feels meaningless in this place.\n\nA whisper echoes through the cavern - not words, but a feeling. Something ancient stirs in the depths below, and it knows you're here.\n\nYou remember nothing of who you were. Only that you must move forward. Only that something waits for you in the heart of this cave.\n\nRise, fallen one. Your journey begins.",
            "Begin your journey in the Dark Cave."
        );
        console.log("  Fragment I seeded");

        // Fragment II: The Quartermaster
        world.UD__setFragmentMetadata(
            2,
            "The Quartermaster",
            "\"Ah, another one wakes,\" the old man rasps, barely looking up from his wares. \"They always wake eventually.\"\n\nTal Carden - that's what the faded sign reads. His eyes are milky, unseeing, yet he seems to know exactly where you stand.\n\n\"You're wondering about the cave, aren't you? Why you're here. What happened to the others.\"\n\nHe laughs, a dry sound like bones rattling.\n\n\"I've been selling to the lost ones for... longer than I can remember. They come, they fight, they fall. And still the cave hungers.\"\n\nHe slides something across the counter. \"Take this. You'll need it where you're going. As for answers - the crystals remember. They trapped the old souls inside, you know. Shatter one, and maybe it'll talk.\"",
            "Speak with Tal Carden at his shop."
        );
        console.log("  Fragment II seeded");

        // Fragment III: The Restless
        world.UD__setFragmentMetadata(
            3,
            "The Restless",
            "The creature falls, dissipating into motes of shadow.\n\nBut as it dies, something passes through you - memories that aren't your own:\n\nA soldier, marching beneath unfamiliar stars.\nA child, playing in streets that no longer exist.\nA merchant, counting coins that have long since crumbled to dust.\n\nThese monsters were people once. You feel it with terrible certainty. They died here, in this cave, and something... refused to let them rest.\n\nThe darkness seems thicker now, watching.\n\nWhat makes you any different from them?",
            "Defeat your first monster."
        );
        console.log("  Fragment III seeded");

        // Fragment IV: Souls That Linger
        world.UD__setFragmentMetadata(
            4,
            "Souls That Linger",
            "The Crystal Elemental shatters, and from within its fractured core, a constellation of pale light spills free.\n\nUnlike the shards that scatter and fade, these motes hover, waiting, and you hear a voice like wind through empty halls:\n\n\"You seek the truth. They all did, once.\"\n\nImages flood your mind: A great ritual. Hooded figures around a pit of absolute darkness. Power being summoned - and something going terribly, horribly wrong.\n\n\"We were the witnesses. We are all that remains of the world before. Trapped in crystal, waiting to be freed.\"\n\nThe light begins to fade.\n\n\"Find the Wound at the center. There, you will understand what we became.\"\n\nAnd then it's gone, leaving only the echo of ancient sorrow.",
            "Defeat a Crystal Elemental."
        );
        console.log("  Fragment IV seeded");

        // Fragment V: The Wound
        world.UD__setFragmentMetadata(
            5,
            "The Wound",
            "You stand at the center of the cave, and the ground... breathes.\n\nNo, not breathes. Pulses. Like a heart. Like something alive beneath your feet.\n\nHere, the air tastes of iron and regret. Faint scratches cover the stone - thousands of them, carved by countless desperate hands. Among them, you make out fragments of text:\n\n\"THE DOOR MUST NEVER OPEN\"\n\"HE PROMISED US POWER\"\n\"WE WERE FOOLS\"\n\nAnd beneath all of them, older than the rest, two words carved so deep they've worn smooth:\n\n\"FORGIVE US\"\n\nThe pulsing grows stronger. Something beneath the cave knows you've found this place.\n\nSomething is pleased.",
            "Reach the center of the cave."
        );
        console.log("  Fragment V seeded");

        // Fragment VI: Death of the Death God
        world.UD__setFragmentMetadata(
            6,
            "Death of the Death God",
            "The Lich Acolyte crumbles, and with its destruction comes a flood of knowledge:\n\nThere was a god of death once. Not cruel, not kind - simply the keeper of the final door. Souls passed through it, and found rest beyond.\n\nBut the mages of this place wanted more. They wanted power over death itself. They performed a ritual to bind the Death God, to steal its dominion.\n\nThey succeeded.\n\nAnd when the Death God died, the doors to the beyond closed forever.\n\nNow the dead cannot leave. They linger, twist, become the monsters that haunt these halls. The mages too are trapped here, their consciousness scattered across a thousand screaming forms.\n\nThis isn't a dungeon. It's a tomb. A tomb for a god.\n\nAnd somewhere in its depths, the god's corpse still holds power.",
            "Defeat the Lich Acolyte."
        );
        console.log("  Fragment VI seeded");

        // Fragment VII: Betrayer's Truth
        world.UD__setFragmentMetadata(
            7,
            "Betrayer's Truth",
            "As the Shadow Stalker dissolves into the darkness it once commanded, its final message burns into your mind:\n\n\"There was one among them who knew the truth. Who tried to stop it.\"\n\nYou see him: a young mage, face twisted with horror as his colleagues complete the ritual. He screams, tries to break the circle, but it's too late.\n\n\"He was the first to realize what they'd done. The first to try to undo it.\"\n\n\"For a thousand years he's worked in shadow. Guiding the lost. Hoping one would finally be strong enough.\"\n\nThe voice fades, but not before whispering one last thing:\n\n\"Tal Carden was there, at the beginning. Ask him about the door. Ask him why he really stays.\"\n\nThe merchant with blind eyes. The quartermaster who never leaves.\n\nHow long has he truly been waiting?",
            "Defeat the Shadow Stalker."
        );
        console.log("  Fragment VII seeded");

        // Fragment VIII: Blood Price
        world.UD__setFragmentMetadata(
            8,
            "Blood Price",
            "They fall, and you feel the weight of what you've done.\n\nAnother soul, trapped here forever because of you. Another consciousness that will twist and warp until it becomes something monstrous.\n\nBut with that weight comes understanding:\n\nThis is the cave's true hunger. Not for death, but for souls. Each one that falls here feeds something ancient. Something waiting. Something that grows stronger with every battle.\n\nThe ritual didn't just kill the Death God.\n\nIt replaced it.\n\nAnd the new god growing in the darkness... it's almost ready to wake.\n\nEvery fallen warrior - monster and hero alike - has been building toward this moment. Including you.\n\nThe question is: will you feed the darkness, or find a way to end the cycle forever?\n\nThe choice approaches. The door waits.",
            "Defeat another player in combat."
        );
        console.log("  Fragment VIII seeded");

        vm.stopBroadcast();
        console.log("=== All 8 fragments seeded ===");
    }
}
