/**
 * NPC narrative data — atmospheric flavor text keyed by metadataUri and quest state.
 *
 * Each NPC has a title, a default atmospheric line, and chain-specific flavors
 * that change as the player progresses through fragment chains.
 *
 * Flavor text is authored prose — NOT i18n-translated. Same pattern as fragmentNarratives.ts.
 */

export type NpcNarrative = {
  title: string;
  defaultFlavor: string;
  /** Keyed by fragmentType, then stepIndex within that chain */
  chainFlavors: Record<number, Record<number, string>>;
};

export const NPC_NARRATIVES: Record<string, NpcNarrative> = {
  'npc:vel_morrow': {
    title: 'The Blade',
    defaultFlavor: 'She watches the ridge with pale eyes. Always counting exits.',
    chainFlavors: {
      10: {
        0: 'Her hand rests on her blade. She heard you coming three tiles ago.',
        1: 'The markers are fresh. Someone from the Covenant is up here.',
      },
      11: {
        0: 'She traces a scar on her forearm without looking at it.',
        1: 'That letter. Let me see it.',
      },
      12: {
        0: 'Something was here. Recently.',
        1: 'Her face is blank. That is how you know it is bad.',
        2: 'I did this to people like you. Maybe to you specifically.',
      },
    },
  },

  'npc:edric_thorne': {
    title: 'The Mender',
    defaultFlavor: 'He kneels, hands together. Not praying \u2014 listening.',
    chainFlavors: {
      13: {
        0: 'His green eyes are too open for this place. They show everything.',
        1: 'They were both trying to survive. That is the worst part.',
        2: 'I prayed for you this morning. You do not have to believe it helped.',
      },
      14: {
        0: 'Something in this place still answers prayer. I can feel it.',
        1: 'Meet me at the shrine. There is something I need to show you.',
      },
      15: {
        0: 'The bones remember what the living have forgotten.',
        1: 'His hands are shaking. He does not notice.',
        2: 'Faith intact. Aware it is being tested.',
      },
    },
  },

  'worldobj:camp_journal': {
    title: 'Abandoned Camp',
    defaultFlavor: 'Pages flutter in the wind. The ink is still wet.',
    chainFlavors: {
      12: {
        1: 'A leather-bound log, left behind or left deliberately.',
      },
    },
  },

  'worldobj:shrine_inscriptions': {
    title: 'Ruined Shrine',
    defaultFlavor: 'Worn stone. The carvings are older than the mountain.',
    chainFlavors: {
      13: {
        2: 'The inscriptions pulse faintly. Waiting to be read.',
      },
    },
  },

  'worldobj:edric_at_shrine': {
    title: 'Edric at the Shrine',
    defaultFlavor: 'He stands among the ruins, listening to something you cannot hear.',
    chainFlavors: {
      14: {
        1: 'You came. He sounds surprised. He should not be.',
      },
    },
  },

  'worldobj:summit_stone': {
    title: 'Summit Stone',
    defaultFlavor: 'A monolith carved with thousands of names. A pilgrimage marker.',
    chainFlavors: {
      16: {
        2: 'The wind screams. Not figuratively.',
      },
    },
  },
};
