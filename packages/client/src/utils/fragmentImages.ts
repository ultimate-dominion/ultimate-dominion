/**
 * Maps fragment titles to their bundled image paths.
 * Images are in /public/images/fragments/ as optimized WebP files.
 */
const FRAGMENT_IMAGES: Record<string, string> = {
  'The Awakening': '/images/fragments/the-awakening.webp',
  "Betrayer's Truth": '/images/fragments/the-betrayers-truth.webp',
  'The Quartermaster': '/images/fragments/the-quartermaster.webp',
  'The Restless': '/images/fragments/the-restless.webp',
  'The Marrow': '/images/fragments/the-wound.webp',
  'Blood Price': '/images/fragments/blood-price.webp',
  'Death of the Death God': '/images/fragments/death-of-the-death-god.webp',
  'Souls That Linger': '/images/fragments/souls-that-linger.webp',
};

export const getFragmentImage = (title: string): string | undefined => {
  return FRAGMENT_IMAGES[title];
};

/** Fragment glow color — consistent cyan blue across all fragments */
const FRAGMENT_COLOR = '#A8DEFF';

export const getFragmentColor = (_title: string): string => {
  return FRAGMENT_COLOR;
};
