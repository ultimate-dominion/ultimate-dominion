import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ChakraProvider } from '@chakra-ui/react';

import { ClassPage } from './ClassPage';
import { CLASS_DATA } from '../data/classData';

vi.mock('react-helmet-async', () => ({
  Helmet: () => null,
}));

const renderWithRoute = (path: string) =>
  render(
    <ChakraProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/guide/classes/:className" element={<ClassPage />} />
          <Route path="/guide" element={<div>Guide page</div>} />
        </Routes>
      </MemoryRouter>
    </ChakraProvider>,
  );

describe('ClassPage', () => {
  it('renders warrior page heading and spell', () => {
    renderWithRoute('/guide/classes/warrior');
    expect(screen.getByRole('heading', { name: 'Warrior' })).toBeTruthy();
    expect(screen.getAllByText('Battle Cry').length).toBeGreaterThan(0);
    expect(screen.getAllByText('+3 STR, +10 HP').length).toBeGreaterThan(0);
  });

  it('renders wizard page', () => {
    renderWithRoute('/guide/classes/wizard');
    expect(screen.getByRole('heading', { name: 'Wizard' })).toBeTruthy();
    expect(screen.getAllByText('Arcane Blast').length).toBeGreaterThan(0);
  });

  it('renders rogue page', () => {
    renderWithRoute('/guide/classes/rogue');
    expect(screen.getByRole('heading', { name: 'Rogue' })).toBeTruthy();
    expect(screen.getAllByText('Shadowstep').length).toBeGreaterThan(0);
  });

  it('redirects to guide for invalid class', () => {
    renderWithRoute('/guide/classes/barbarian');
    expect(screen.getByText('Guide page')).toBeTruthy();
  });

  it('renders nav links for all 9 classes', () => {
    renderWithRoute('/guide/classes/warrior');
    for (const c of CLASS_DATA) {
      expect(screen.getAllByRole('link', { name: c.name }).length).toBeGreaterThan(0);
    }
  });

  it('renders strengths and weaknesses', () => {
    renderWithRoute('/guide/classes/cleric');
    expect(screen.getAllByText('Strengths').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Weaknesses').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Only class with healing multiplier (110%)').length).toBeGreaterThan(0);
  });

  it('renders multiplier labels', () => {
    renderWithRoute('/guide/classes/druid');
    expect(screen.getAllByText('Physical Dmg').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Spell Dmg').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Crit Dmg').length).toBeGreaterThan(0);
  });

  it('renders lore section', () => {
    renderWithRoute('/guide/classes/warlock');
    expect(screen.getAllByText('Lore').length).toBeGreaterThan(0);
  });

  it('renders playstyle section', () => {
    renderWithRoute('/guide/classes/paladin');
    expect(screen.getAllByText('Playstyle').length).toBeGreaterThan(0);
  });

  it('renders class ability with spell name', () => {
    renderWithRoute('/guide/classes/ranger');
    expect(screen.getAllByText('Class Ability').length).toBeGreaterThan(0);
    expect(screen.getAllByText("Hunter's Mark").length).toBeGreaterThan(0);
  });

  it('renders all 9 class pages without crashing', () => {
    for (const c of CLASS_DATA) {
      const { unmount } = renderWithRoute(`/guide/classes/${c.slug}`);
      expect(screen.getAllByRole('heading', { name: c.name }).length).toBeGreaterThan(0);
      unmount();
    }
  });

  it('renders back links to Codex', () => {
    renderWithRoute('/guide/classes/sorcerer');
    expect(screen.getAllByRole('link', { name: /codex/i }).length).toBeGreaterThan(0);
  });

  it('renders class image', () => {
    renderWithRoute('/guide/classes/warrior');
    const imgs = screen.getAllByAltText('Warrior');
    expect(imgs.length).toBeGreaterThan(0);
    expect(imgs[0].getAttribute('src')).toContain('warrior.webp');
  });

  it('shows archetype label', () => {
    renderWithRoute('/guide/classes/wizard');
    expect(screen.getAllByText(/Intelligence Class/).length).toBeGreaterThan(0);
  });
});
