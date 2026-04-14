/**
 * Tests that HealthBar reserves a fixed-height row for status effect badges
 * regardless of whether any effects are currently active. The battle HUD
 * stacks multiple HealthBars and previously grew/shrank when effects were
 * applied mid-fight, causing a visible "snap down" of the battle scene.
 *
 * See TileDetailsPanel.tsx (cinematic battle block) for the consumer that
 * depends on this invariant.
 */
import { ChakraProvider } from '@chakra-ui/react';
import { cleanup, render, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { HealthBar } from './HealthBar';

afterEach(() => cleanup());

const wrap = (ui: JSX.Element) =>
  render(<ChakraProvider>{ui}</ChakraProvider>);

describe('HealthBar', () => {
  it('renders the HP text for the bar', () => {
    const { getAllByText } = wrap(
      <HealthBar maxHp={BigInt(100)} currentHp={BigInt(42)} />,
    );
    expect(getAllByText('42/100').length).toBeGreaterThan(0);
  });

  it('renders without a status-effects badge when none are supplied', () => {
    const { queryByText } = wrap(
      <HealthBar maxHp={BigInt(100)} currentHp={BigInt(60)} />,
    );
    // No badge text should appear.
    expect(queryByText('poison')).toBeNull();
    expect(queryByText('weaken')).toBeNull();
  });

  it('renders a badge for each supplied status effect (up to 3)', () => {
    const { getAllByText } = wrap(
      <HealthBar
        maxHp={BigInt(100)}
        currentHp={BigInt(60)}
        statusEffects={['poison', 'weaken']}
      />,
    );
    expect(getAllByText('poison').length).toBeGreaterThan(0);
    expect(getAllByText('weaken').length).toBeGreaterThan(0);
  });

  it('caps the visible badges at the first 3 to keep row height stable', () => {
    const { queryAllByText } = wrap(
      <HealthBar
        maxHp={BigInt(100)}
        currentHp={BigInt(60)}
        statusEffects={['poison', 'weaken', 'blind', 'drunk', 'Venom']}
      />,
    );
    expect(queryAllByText('poison').length).toBeGreaterThan(0);
    expect(queryAllByText('weaken').length).toBeGreaterThan(0);
    expect(queryAllByText('blind').length).toBeGreaterThan(0);
    // Fourth and fifth must not appear.
    expect(queryAllByText('drunk').length).toBe(0);
    expect(queryAllByText('Venom').length).toBe(0);
  });

  it('reserves the badges row container even with no effects (stable HUD height)', () => {
    // With no status effects, the HStack that holds the badges must still be
    // in the DOM so the HUD height is constant. We detect it by confirming
    // the HealthBar's VStack has two children rows (bar row + badges row).
    const { container } = wrap(
      <HealthBar maxHp={BigInt(100)} currentHp={BigInt(60)} />,
    );
    // The top-level VStack has HP HStack + badges HStack = 2 rows.
    // Use a simple heuristic: query for elements that are direct children of
    // the root wrapper and assert we have both rows present.
    const topVStack = container.firstElementChild?.firstElementChild;
    expect(topVStack).toBeTruthy();
    expect((topVStack as HTMLElement).children.length).toBeGreaterThanOrEqual(2);
  });
});
