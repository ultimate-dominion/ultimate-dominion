import { ChakraProvider } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CharacterMark, FragmentMark, MonsterMark } from './EntityMark';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider>{children}</ChakraProvider>
);

describe('text-only entity marks', () => {
  it('derives player initials from an arbitrary name', () => {
    render(<CharacterMark name="Mara Stone" />, { wrapper });

    expect(screen.getByRole('group', { name: 'Mara Stone' })).toBeTruthy();
    expect(screen.getByText('MS')).toBeTruthy();
  });

  it('renders an unknown monster without an asset registry', () => {
    render(<MonsterMark name="Future Content Beast" />, { wrapper });

    expect(
      screen.getByRole('group', { name: 'Future Content Beast' }),
    ).toBeTruthy();
    expect(screen.getByText('FOE')).toBeTruthy();
  });

  it('renders fragment identity from its sequence number', () => {
    render(<FragmentMark index={9} title="The Ninth Record" />, { wrapper });

    expect(
      screen.getByRole('group', { name: 'The Ninth Record' }),
    ).toBeTruthy();
    expect(screen.getByText('IX')).toBeTruthy();
  });
});
