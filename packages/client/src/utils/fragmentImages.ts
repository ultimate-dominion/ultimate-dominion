/**
 * Maps fragment titles to their bundled image paths.
 * Images are in /public/images/fragments/ as optimized WebP files.
 */
const FRAGMENT_IMAGES: Record<string, string> = {
  'The Awakening': '/images/fragments/the-awakening.webp',
  "Betrayer's Truth": '/images/fragments/the-betrayers-truth.webp',
  'The Quartermaster': '/images/fragments/the-quartermaster.webp',
  'The Restless': '/images/fragments/the-restless.webp',
  'The Wound': '/images/fragments/the-wound.webp',
  'Blood Price': '/images/fragments/blood-price.webp',
  'Death of the Death God': '/images/fragments/death-of-the-death-god.webp',
  'Souls That Linger': '/images/fragments/souls-that-linger.webp',
};

export const getFragmentImage = (title: string): string | undefined => {
  return FRAGMENT_IMAGES[title];
};

/** Per-fragment thematic glow colors */
const FRAGMENT_COLORS: Record<string, string> = {
  'The Awakening': '#A8DEFF',       // pale ice blue — waking in cold stone
  'The Quartermaster': '#C87A2A',   // amber lantern — the old merchant's shop
  'The Restless': '#7B68AE',        // spectral violet — memories of the dead
  'Souls That Linger': '#5EC4D4',   // crystal teal — shattered elemental core
  'The Wound': '#CC3333',           // blood red — the pulsing heart beneath
  'Death of the Death God': '#E8DCC8', // bone white — a god's remains
  "Betrayer's Truth": '#8BC34A',    // sickly green — hidden knowledge, poison truth
  'Blood Price': '#D4A54A',         // dark gold — the cost of every soul
};

export const getFragmentColor = (title: string): string => {
  return FRAGMENT_COLORS[title] || '#A8DEFF';
};
