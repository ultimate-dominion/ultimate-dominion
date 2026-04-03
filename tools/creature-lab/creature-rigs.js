// ==========================================================================
// creature-rigs.js — Archetype rig definitions for the 3D creature system
//
// Three archetypes cover all Z1 creatures:
//   biped       — goblin, kobold, skeleton, shaman, bugbear, hook-horror
//   quadruped   — basilisk, dire-rat, giant-spider
//   serpentine  — carrion-crawler, gelatinous-ooze
//
// Each rig defines normalized animation clips (position/scale/rotation in
// world units, time in seconds) and a weaponSocket hint.
//
// Track path conventions (Three.js PropertyBinding):
//   '.position'        — root group position
//   '.scale'           — root group scale
//   '.rotation'        — root group Euler rotation (xyz radians)
//   'weapon.position'  — weapon child group position
//   'weapon.rotation'  — weapon child group Euler rotation (xyz radians)
//
// loop values: 'repeat' | 'once'
// clampWhenFinished: true = hold last frame (block/death)
// returnToIdle: true = auto-crossfade to idle on finish (attack/hit)
// ==========================================================================

// ── BIPED ─────────────────────────────────────────────────────────────────
// Humanoids: goblin, kobold, skeleton, shaman, bugbear, hook-horror.
// Creature faces LEFT. Attack lunges left (neg x = toward player).
// Weapon arc: from overhead (rotation.z=0) → swings LEFT (rotation.z = -1.5)
// Block: weapon raised diagonally, weight shifts right (away from player).

export const BIPED_RIG = {
  name: 'biped',

  // Three idle stance variants — picked randomly when the creature spawns.
  // Applied as the group's initial transform; idle animation plays on top.
  stances: [
    // 0 — axe raised overhead, default upright threat
    { position: [0, 0, 0],       rotation: [0, 0, 0],     scale: [1, 1, 1] },
    // 1 — weight forward, forward lean into player
    { position: [-0.05, -0.04, 0], rotation: [0, 0, 0.06], scale: [1.00, 0.96, 1] },
    // 2 — wide planted stance, rotated slightly away
    { position: [0.04, 0.02, 0],  rotation: [0, 0, -0.05], scale: [1.05, 0.97, 1] },
  ],

  clips: {
    idle: {
      duration: 2.4,
      loop: 'repeat',
      tracks: [
        // subtle breathe — scale y
        { path: '.scale',    times: [0, 1.2, 2.4], values: [1,1,1, 1,1.028,1, 1,1,1] },
        // very subtle side sway
        { path: '.position', times: [0, 1.2, 2.4], values: [0,0,0, 0.018,-0.008,0, 0,0,0] },
      ],
    },

    attack: {
      duration: 0.65,
      loop: 'once',
      clampWhenFinished: false,
      returnToIdle: true,
      tracks: [
        // lunge toward player (left), then snap back
        { path: '.position', times: [0, 0.08, 0.26, 0.45, 0.65], values: [
          0, 0, 0,
         -0.04, 0.04, 0.05,   // slight lift before lunge
         -0.34, 0.02, 0.10,   // LUNGE — furthest left
         -0.14, 0.01, 0.04,
          0, 0, 0,
        ]},
        // axe sweep: default = pointing up → swing hard left (toward player)
        { path: 'weapon.rotation', times: [0, 0.10, 0.28, 0.50, 0.65], values: [
          0, 0,  0.00,    // rest
          0, 0,  0.45,    // windup — tilt further overhead
          0, 0, -1.55,    // SWING — axe sweeps through toward player
          0, 0, -0.80,    // follow-through
          0, 0,  0.00,    // reset
        ]},
      ],
    },

    block: {
      duration: 0.28,
      loop: 'once',
      clampWhenFinished: true,   // hold blocking pose until next clip
      returnToIdle: false,
      tracks: [
        // shift weight back (right = away from player)
        { path: '.position', times: [0, 0.18, 0.28], values: [
          0,0,0, 0.20,0,0, 0.20,0,0,
        ]},
        // weapon raises to blocking diagonal
        { path: 'weapon.rotation', times: [0, 0.28], values: [
          0, 0,  0.00,
          0, 0, -0.88,   // weapon diagonal across body — shields the left side
        ]},
      ],
    },

    hit: {
      duration: 0.38,
      loop: 'once',
      clampWhenFinished: false,
      returnToIdle: true,
      tracks: [
        // stumble right (away from player)
        { path: '.position', times: [0, 0.07, 0.18, 0.38], values: [
          0,0,0,
          0.24, 0.05, -0.05,   // recoil
          0.32, 0, -0.03,      // stumble peak
          0, 0, 0,
        ]},
        // weapon drops/wobbles on impact
        { path: 'weapon.rotation', times: [0, 0.07, 0.22, 0.38], values: [
          0, 0, 0.00,
          0, 0, 0.65,    // weapon jerks forward from impact
          0, 0, 0.20,
          0, 0, 0.00,
        ]},
      ],
    },

    death: {
      duration: 1.20,
      loop: 'once',
      clampWhenFinished: true,   // stay dead
      returnToIdle: false,
      tracks: [
        { path: '.position', times: [0, 0.40, 0.80, 1.20], values: [
          0, 0, 0,
          0.10,-0.15, 0,   // stumble right-down
          0.15,-0.40, 0,
          0.10,-0.80, 0,   // collapsed
        ]},
        { path: '.scale', times: [0, 0.60, 1.20], values: [
          1,1,1, 0.95,0.75,0.95, 0.05,0.02,0.05,
        ]},
        // weapon falls from dead hand
        { path: 'weapon.rotation', times: [0, 0.35, 0.80], values: [
          0, 0,  0.00,
          0, 0,  0.50,
          0, 0,  1.80,   // weapon dropped, points down
        ]},
      ],
    },
  },
};

// ── QUADRUPED ─────────────────────────────────────────────────────────────
// Low-slung 4-legged creatures: basilisk, dire-rat, giant-spider.
// Attack = head/body lunge forward (left). No weapon tracks.

export const QUADRUPED_RIG = {
  name: 'quadruped',

  // Three idle stances — low-slung body, variations in crouch depth and head angle.
  stances: [
    // 0 — default standing alert
    { position: [0, 0, 0],       rotation: [0, 0, 0],      scale: [1, 1, 1] },
    // 1 — stalking low, body closer to ground
    { position: [-0.04, -0.05, 0], rotation: [0, 0, 0],    scale: [1.04, 0.88, 1] },
    // 2 — reared warning, front raised
    { position: [0.04, 0.05, 0],  rotation: [0, 0, 0.12],  scale: [0.96, 1.08, 1] },
  ],

  clips: {
    idle: {
      duration: 2.2,
      loop: 'repeat',
      tracks: [
        { path: '.scale',    times: [0, 1.1, 2.2], values: [1,1,1, 1,1.022,1, 1,1,1] },
        { path: '.position', times: [0, 1.1, 2.2], values: [0,0,0, 0.01,-0.006,0, 0,0,0] },
      ],
    },

    attack: {
      duration: 0.52,
      loop: 'once',
      clampWhenFinished: false,
      returnToIdle: true,
      tracks: [
        { path: '.position', times: [0, 0.07, 0.22, 0.40, 0.52], values: [
          0,  0, 0,
         -0.05, 0.05, 0,   // coil
         -0.42, 0, 0,      // LUNGE forward
         -0.18, 0, 0,
          0,  0, 0,
        ]},
        // body compresses and extends
        { path: '.scale', times: [0, 0.07, 0.22, 0.52], values: [
          1,1,1, 0.9,1.1,1, 1.15,0.88,1, 1,1,1,
        ]},
      ],
    },

    block: {
      duration: 0.22,
      loop: 'once',
      clampWhenFinished: true,
      returnToIdle: false,
      tracks: [
        { path: '.position', times: [0, 0.22], values: [0,0,0, 0.22,0,0] },
        // lower head to block (scale makes it squat)
        { path: '.scale', times: [0, 0.22], values: [1,1,1, 1.05,0.88,1] },
      ],
    },

    hit: {
      duration: 0.32,
      loop: 'once',
      clampWhenFinished: false,
      returnToIdle: true,
      tracks: [
        { path: '.position', times: [0, 0.07, 0.32], values: [0,0,0, 0.28,0,0, 0,0,0] },
      ],
    },

    death: {
      duration: 1.10,
      loop: 'once',
      clampWhenFinished: true,
      returnToIdle: false,
      tracks: [
        { path: '.position', times: [0, 0.45, 1.10], values: [0,0,0, 0.05,-0.12,0, 0.08,-0.44,0] },
        { path: '.scale',    times: [0, 0.60, 1.10], values: [1,1,1, 1,0.78,1, 0.1,0.04,0.1] },
        // slight roll as it collapses
        { path: '.rotation', times: [0, 0.60, 1.10], values: [0,0,0, 0,0,0.18, 0,0,0.72] },
      ],
    },
  },
};

// ── SERPENTINE ───────────────────────────────────────────────────────────
// Worm/ooze creatures: carrion-crawler, gelatinous-ooze.
// Slower, flowing motion. No weapon tracks.

export const SERPENTINE_RIG = {
  name: 'serpentine',

  // Three idle stances — body weight distribution shifts the whole read.
  stances: [
    // 0 — default upright front
    { position: [0, 0, 0],       rotation: [0, 0, 0],      scale: [1, 1, 1] },
    // 1 — coiled compact, lower center of mass
    { position: [0, -0.05, 0],   rotation: [0, 0, 0],      scale: [1.06, 0.88, 1] },
    // 2 — raised front loom, head end tilted toward player
    { position: [-0.06, 0.05, 0], rotation: [0, 0, 0.14],  scale: [0.95, 1.10, 1] },
  ],

  clips: {
    idle: {
      duration: 3.0,
      loop: 'repeat',
      tracks: [
        { path: '.scale',    times: [0, 1.5, 3.0], values: [1,1,1, 1.03,0.97,1, 1,1,1] },
        { path: '.position', times: [0, 1.0, 2.0, 3.0], values: [0,0,0, 0.025,0.015,0, -0.012,0.008,0, 0,0,0] },
      ],
    },

    attack: {
      duration: 0.55,
      loop: 'once',
      clampWhenFinished: false,
      returnToIdle: true,
      tracks: [
        { path: '.position', times: [0, 0.10, 0.28, 0.42, 0.55], values: [
          0,0,0,
         -0.08,0.08,0,   // front end lifts
         -0.46,0.02,0,   // LUNGE
         -0.20,0,0,
          0,0,0,
        ]},
        { path: '.scale', times: [0, 0.10, 0.28, 0.55], values: [
          1,1,1, 0.88,1.15,1, 1.18,0.85,1, 1,1,1,
        ]},
      ],
    },

    block: {
      duration: 0.28,
      loop: 'once',
      clampWhenFinished: true,
      returnToIdle: false,
      tracks: [
        { path: '.position', times: [0, 0.28], values: [0,0,0, 0.18,0.06,0] },
        { path: '.scale',    times: [0, 0.28], values: [1,1,1, 1.08,0.90,1] },
      ],
    },

    hit: {
      duration: 0.32,
      loop: 'once',
      clampWhenFinished: false,
      returnToIdle: true,
      tracks: [
        { path: '.position', times: [0, 0.08, 0.32], values: [0,0,0, 0.22,0,0, 0,0,0] },
      ],
    },

    death: {
      duration: 1.40,
      loop: 'once',
      clampWhenFinished: true,
      returnToIdle: false,
      tracks: [
        { path: '.position', times: [0, 0.6, 1.40], values: [0,0,0, 0,-0.20,0, 0,-0.55,0] },
        { path: '.scale',    times: [0, 0.8, 1.40], values: [1,1,1, 1.1,0.72,1, 0.05,0.02,0.05] },
      ],
    },
  },
};

export const RIGS = {
  biped:      BIPED_RIG,
  quadruped:  QUADRUPED_RIG,
  serpentine: SERPENTINE_RIG,
};
