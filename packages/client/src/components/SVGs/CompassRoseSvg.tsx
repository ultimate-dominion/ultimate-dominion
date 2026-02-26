import { Icon, IconProps } from '@chakra-ui/react';

const DARK_BROWN = '#3A3228';
const GOLD = '#D4A54A';

/**
 * Kite-shaped directional arrow derived from rose 2's cardinal star points.
 * Gold left half, dark brown right half — matching the compass rose light/shadow convention.
 * Default orientation: points north (up). Rotate via parent `transform` for other directions.
 */
export const CompassArrowSvg = (props: IconProps): JSX.Element => (
  <Icon viewBox="0 0 100 140" {...props}>
    <path d="M 50,0 L 8,90 L 50,140 Z" fill={GOLD} />
    <path d="M 50,0 L 92,90 L 50,140 Z" fill={DARK_BROWN} />
    <path
      d="M 50,0 L 92,90 L 50,140 L 8,90 Z"
      stroke={DARK_BROWN}
      strokeWidth="4"
      fill="none"
      strokeLinejoin="round"
    />
  </Icon>
);
