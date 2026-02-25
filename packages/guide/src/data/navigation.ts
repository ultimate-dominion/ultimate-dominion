export interface NavItem {
  title: string;
  href: string;
  icon?: string;
  children?: NavItem[];
}

export const navigation: NavItem[] = [
  { title: "Adventurer's Codex", href: '/guide/', icon: '📜' },
  {
    title: 'Basics',
    href: '#',
    children: [
      { title: 'Getting Started', href: '/guide/getting-started', icon: '🗡️' },
      { title: 'Character Creation', href: '/guide/character-creation', icon: '⚔️' },
      { title: 'Classes', href: '/guide/classes', icon: '🛡️' },
    ],
  },
  {
    title: 'Combat & PvP',
    href: '#',
    children: [
      { title: 'Combat', href: '/guide/combat', icon: '⚔️' },
      { title: 'PvP', href: '/guide/pvp', icon: '💀' },
    ],
  },
  {
    title: 'World',
    href: '#',
    children: [
      { title: 'The Dark Cave', href: '/guide/dark-cave', icon: '🕳️' },
      { title: 'Bestiary', href: '/guide/bestiary', icon: '🐉' },
      { title: 'Items', href: '/guide/items', icon: '🎒' },
    ],
  },
  {
    title: 'Systems',
    href: '#',
    children: [
      { title: 'Economy', href: '/guide/economy', icon: '💰' },
      { title: 'Progression', href: '/guide/progression', icon: '📈' },
    ],
  },
  {
    title: 'Lore & More',
    href: '#',
    children: [
      { title: 'Lore', href: '/guide/lore', icon: '📖' },
      { title: 'Badges', href: '/guide/badges', icon: '🏅' },
    ],
  },
];

export const allPages = navigation.flatMap((item) =>
  item.children ? item.children : item.href !== '#' ? [item] : []
);
