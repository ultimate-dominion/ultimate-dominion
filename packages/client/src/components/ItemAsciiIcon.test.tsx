import { ChakraProvider } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ItemType, Rarity } from '../utils/types';

import { ItemAsciiIcon } from './ItemAsciiIcon';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider>{children}</ChakraProvider>
);

describe('ItemAsciiIcon', () => {
  it('renders a future weapon from semantic data alone', () => {
    render(
      <ItemAsciiIcon
        itemType={ItemType.Weapon}
        name="Sword That Does Not Exist Yet"
        rarity={Rarity.Legendary}
      />,
      { wrapper },
    );

    expect(
      screen.getByRole('group', { name: /Sword That Does Not Exist Yet/i }),
    ).toBeTruthy();
    expect(screen.getByText('WPN')).toBeTruthy();
  });

  it('uses a type mark for consumables', () => {
    render(
      <ItemAsciiIcon itemType={ItemType.Consumable} name="Unknown Tonic" />,
      { wrapper },
    );

    expect(screen.getByText('USE')).toBeTruthy();
  });
});
