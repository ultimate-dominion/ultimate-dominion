/**
 * Fragment Narratives for "Fragments of the Fallen"
 * 8 collectible lore fragments that reveal the game's narrative
 */

export type FragmentInfo = {
  id: number;
  name: string;
  narrative: string;
  hint: string;
};

export const FRAGMENT_NARRATIVES: Record<number, FragmentInfo> = {
  1: {
    id: 1,
    name: 'The Awakening',
    narrative: `You open your eyes to darkness. Cold stone beneath your back. The taste of dust and something... older.

How long have you been here? Days? Years? Time feels meaningless in this place.

A whisper echoes through the cavern - not words, but a feeling. Something ancient stirs in the depths below, and it knows you're here.

You remember nothing of who you were. Only that you must move forward. Only that something waits for you in the heart of this cave.

Rise, fallen one. Your journey begins.`,
    hint: 'Begin your journey in the Dark Cave.',
  },
  2: {
    id: 2,
    name: 'The Quartermaster',
    narrative: `"Ah, another one wakes," the old man rasps, barely looking up from his wares. "They always wake eventually."

Tal Carden - that's what the faded sign reads. His eyes are milky, unseeing, yet he seems to know exactly where you stand.

"You're wondering about the cave, aren't you? Why you're here. What happened to the others."

He laughs, a dry sound like bones rattling.

"I've been selling to the lost ones for... longer than I can remember. They come, they fight, they fall. And still the cave hungers."

He slides something across the counter. "Take this. You'll need it where you're going. As for answers - the crystals remember. They trapped the old souls inside, you know. Shatter one, and maybe it'll talk."`,
    hint: 'Speak with Tal Carden at his shop.',
  },
  3: {
    id: 3,
    name: 'The Restless',
    narrative: `The creature falls, dissipating into motes of shadow.

But as it dies, something passes through you - memories that aren't your own:

*A soldier, marching beneath unfamiliar stars.*
*A child, playing in streets that no longer exist.*
*A merchant, counting coins that have long since crumbled to dust.*

These monsters were people once. You feel it with terrible certainty. They died here, in this cave, and something... refused to let them rest.

The darkness seems thicker now, watching.

What makes you any different from them?`,
    hint: 'Defeat your first monster.',
  },
  4: {
    id: 4,
    name: 'Souls That Linger',
    narrative: `The Crystal Elemental shatters, and from within its fractured core, a constellation of pale light spills free.

Unlike the shards that scatter and fade, these motes hover, waiting, and you hear a voice like wind through empty halls:

*"You seek the truth. They all did, once."*

Images flood your mind: A great ritual. Hooded figures around a pit of absolute darkness. Power being summoned - and something going terribly, horribly wrong.

*"We were the witnesses. We are all that remains of the world before. Trapped in crystal, waiting to be freed."*

The light begins to fade.

*"Find the Wound at the center. There, you will understand what we became."*

And then it's gone, leaving only the echo of ancient sorrow.`,
    hint: 'Defeat a Crystal Elemental.',
  },
  5: {
    id: 5,
    name: 'The Wound',
    narrative: `You stand at the center of the cave, and the ground... breathes.

No, not breathes. Pulses. Like a heart. Like something alive beneath your feet.

Here, the air tastes of iron and regret. Faint scratches cover the stone - thousands of them, carved by countless desperate hands. Among them, you make out fragments of text:

*"THE DOOR MUST NEVER OPEN"*
*"HE PROMISED US POWER"*
*"WE WERE FOOLS"*

And beneath all of them, older than the rest, two words carved so deep they've worn smooth:

*"FORGIVE US"*

The pulsing grows stronger. Something beneath the cave knows you've found this place.

Something is pleased.`,
    hint: 'Reach the center of the cave.',
  },
  6: {
    id: 6,
    name: 'Death of the Death God',
    narrative: `The Bonecaster crumbles, and with its destruction comes a flood of knowledge:

There was a god of death once. Not cruel, not kind - simply the keeper of the final door. Souls passed through it, and found rest beyond.

But the mages of this place wanted more. They wanted power over death itself. They performed a ritual to bind the Death God, to steal its dominion.

They succeeded.

And when the Death God died, the doors to the beyond closed forever.

Now the dead cannot leave. They linger, twist, become the monsters that haunt these halls. The mages too are trapped here, their consciousness scattered across a thousand screaming forms.

This isn't a dungeon. It's a tomb. A tomb for a god.

And somewhere in its depths, the god's corpse still holds power.`,
    hint: 'Defeat the Bonecaster.',
  },
  7: {
    id: 7,
    name: "Betrayer's Truth",
    narrative: `As the Pale Stalker dissolves into the darkness it once commanded, its final message burns into your mind:

*"There was one among them who knew the truth. Who tried to stop it."*

You see him: a young mage, face twisted with horror as his colleagues complete the ritual. He screams, tries to break the circle, but it's too late.

*"He was the first to realize what they'd done. The first to try to undo it."*

*"For a thousand years he's worked in shadow. Guiding the lost. Hoping one would finally be strong enough."*

The voice fades, but not before whispering one last thing:

*"Tal Carden was there, at the beginning. Ask him about the door. Ask him why he really stays."*

The merchant with blind eyes. The quartermaster who never leaves.

How long has he truly been waiting?`,
    hint: 'Defeat the Pale Stalker.',
  },
  8: {
    id: 8,
    name: 'Blood Price',
    narrative: `They fall, and you feel the weight of what you've done.

Another soul, trapped here forever because of you. Another consciousness that will twist and warp until it becomes something monstrous.

But with that weight comes understanding:

This is the cave's true hunger. Not for death, but for souls. Each one that falls here feeds something ancient. Something waiting. Something that grows stronger with every battle.

The ritual didn't just kill the Death God.

It replaced it.

And the new god growing in the darkness... it's almost ready to wake.

Every fallen warrior - monster and hero alike - has been building toward this moment. Including you.

The question is: will you feed the darkness, or find a way to end the cycle forever?

The choice approaches. The door waits.`,
    hint: 'Defeat another player in combat.',
  },
};

export const TOTAL_FRAGMENTS = 8;

export const getFragmentInfo = (fragmentType: number): FragmentInfo | null => {
  return FRAGMENT_NARRATIVES[fragmentType] ?? null;
};

export const getRomanNumeral = (num: number): string => {
  const numerals: Record<number, string> = {
    1: 'I',
    2: 'II',
    3: 'III',
    4: 'IV',
    5: 'V',
    6: 'VI',
    7: 'VII',
    8: 'VIII',
  };
  return numerals[num] ?? num.toString();
};
