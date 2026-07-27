import { ChakraProvider } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';

import { CLASS_DATA } from '../data/classData';

import { ClassPage } from './ClassPage';

vi.mock('react-helmet-async', () => ({
  Helmet: () => null,
}));

const renderWithRoute = (path: string) =>
  render(
    <ChakraProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/classes/:className" element={<ClassPage />} />
          <Route path="/guide" element={<div>Guide page</div>} />
        </Routes>
      </MemoryRouter>
    </ChakraProvider>,
  );

describe('ClassPage', () => {
  it('renders warrior page heading and spell', () => {
    renderWithRoute('/classes/warrior');
    expect(screen.getByRole('heading', { name: 'Warrior' })).toBeTruthy();
    expect(screen.getAllByText('Battle Cry').length).toBeGreaterThan(0);
    expect(screen.getAllByText('+3 STR, +10 HP').length).toBeGreaterThan(0);
  });

  it('renders wizard page', () => {
    renderWithRoute('/classes/wizard');
    expect(screen.getByRole('heading', { name: 'Wizard' })).toBeTruthy();
    expect(screen.getAllByText('Arcane Blast').length).toBeGreaterThan(0);
  });

  it('renders rogue page', () => {
    renderWithRoute('/classes/rogue');
    expect(screen.getByRole('heading', { name: 'Rogue' })).toBeTruthy();
    expect(screen.getAllByText('Shadowstep').length).toBeGreaterThan(0);
  });

  it('redirects to guide for invalid class', () => {
    renderWithRoute('/classes/barbarian');
    expect(screen.getByText('Guide page')).toBeTruthy();
  });

  it('renders nav links for all 9 classes', () => {
    renderWithRoute('/classes/warrior');
    for (const c of CLASS_DATA) {
      expect(
        screen.getAllByRole('link', { name: c.name }).length,
      ).toBeGreaterThan(0);
    }
  });

  it('renders strengths and weaknesses', () => {
    renderWithRoute('/classes/cleric');
    expect(screen.getAllByText('Strengths').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Weaknesses').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText('Only class with healing multiplier (110%)').length,
    ).toBeGreaterThan(0);
  });

  it('renders multiplier labels', () => {
    renderWithRoute('/classes/druid');
    expect(screen.getAllByText('Physical Dmg').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Spell Dmg').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Crit Dmg').length).toBeGreaterThan(0);
  });

  it('renders lore section', () => {
    renderWithRoute('/classes/warlock');
    expect(screen.getAllByText('Lore').length).toBeGreaterThan(0);
  });

  it('renders playstyle section', () => {
    renderWithRoute('/classes/paladin');
    expect(screen.getAllByText('Playstyle').length).toBeGreaterThan(0);
  });

  it('renders class ability with spell name', () => {
    renderWithRoute('/classes/ranger');
    expect(screen.getAllByText('Class Ability').length).toBeGreaterThan(0);
    expect(screen.getAllByText("Hunter's Mark").length).toBeGreaterThan(0);
  });

  it('renders all 9 class pages without crashing', () => {
    for (const c of CLASS_DATA) {
      const { unmount } = renderWithRoute(`/classes/${c.slug}`);
      expect(
        screen.getAllByRole('heading', { name: c.name }).length,
      ).toBeGreaterThan(0);
      unmount();
    }
  }, 10_000);

  it('renders back links to Codex', () => {
    renderWithRoute('/classes/sorcerer');
    expect(
      screen.getAllByRole('link', { name: /codex/i }).length,
    ).toBeGreaterThan(0);
  });

  it('renders class identity without an image', () => {
    const { container } = renderWithRoute('/classes/warrior');
    expect(container.querySelector('img')).toBeNull();
    expect(
      screen.getAllByRole('group', { name: 'Warrior' }).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('STR').length).toBeGreaterThan(0);
  });

  it('shows archetype label', () => {
    renderWithRoute('/classes/wizard');
    expect(screen.getAllByText(/Intelligence Class/).length).toBeGreaterThan(0);
  });
});
