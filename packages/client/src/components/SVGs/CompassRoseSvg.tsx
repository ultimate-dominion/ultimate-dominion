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

/**
 * Full compass rose ornament from rose 2.svg.
 * 8-point star with cardinal + intercardinal arms.
 * Themed for the dark game UI — muted gold/brown.
 */
export const CompassRoseOrnamentSvg = (props: IconProps): JSX.Element => (
  <Icon viewBox="-350 -350 700 700" {...props}>
    {/* Outer 16-point ring */}
    <path
      d="M 174.536,-34.717 L 285.615,0 L 174.536,34.717 L 263.874,109.3 L 147.965,98.867 L 201.96,201.96 L 98.867,147.965 L 109.3,263.874 L 34.717,174.536 L 0,285.615 L -34.717,174.536 L -109.3,263.874 L -98.867,147.965 L -201.96,201.96 L -147.965,98.867 L -263.874,109.3 L -174.536,34.717 L -285.615,0 L -174.536,-34.717 L -263.874,-109.3 L -147.965,-98.867 L -201.96,-201.96 L -98.867,-147.965 L -109.3,-263.874 L -34.717,-174.536 L 0,-285.615 L 34.717,-174.536 L 109.3,-263.874 L 98.867,-147.965 L 201.96,-201.96 L 147.965,-98.867 L 263.874,-109.3 L 174.536,-34.717"
      fill="none"
      stroke="#3A3228"
      strokeWidth="1.5"
      strokeLinejoin="round"
      opacity={0.5}
    />
    {/* Inner 8-point star — dark fill */}
    <path
      d="M 0,0 L 300,0 L 103.482,42.864 M 0,0 L 212.132,212.132 L 42.864,103.482 M 0,0 L 0,300 L -42.864,103.482 M 0,0 L -212.132,212.132 L -103.482,42.864 M 0,0 L -300,0 L -103.482,-42.864 M 0,0 L -212.132,-212.132 L -42.864,-103.482 M 0,0 L 0,-300 L 42.864,-103.482 M 0,0 L 212.132,-212.132 L 103.482,-42.864"
      fill="#2A2420"
      opacity={0.4}
    />
    {/* Inner 8-point star — outline */}
    <path
      d="M 103.482,-42.864 L 300,0 L 103.482,42.864 L 212.132,212.132 L 42.864,103.482 L 0,300 L -42.864,103.482 L -212.132,212.132 L -103.482,42.864 L -300,0 L -103.482,-42.864 L -212.132,-212.132 L -42.864,-103.482 L 0,-300 L 42.864,-103.482 L 212.132,-212.132 L 103.482,-42.864"
      fill="none"
      stroke="#5A5040"
      strokeWidth="1.5"
      strokeLinejoin="round"
      opacity={0.6}
    />
    {/* North accent — gold highlight on the N arm */}
    <path
      d="M 0,-300 L 42.864,-103.482 L 0,0 L -42.864,-103.482 Z"
      fill="#C87A2A"
      opacity={0.25}
    />
  </Icon>
);
