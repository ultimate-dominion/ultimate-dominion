import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock useChat before importing WorldFeed
const mockUseChat = vi.fn();
vi.mock('../contexts/ChatContext', () => ({
  useChat: () => mockUseChat(),
}));

import { WorldFeed } from './WorldFeed';

// Chakra UI provider wrapper
import { ChakraProvider } from '@chakra-ui/react';
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider>{children}</ChakraProvider>
);

// Mock scrollIntoView (not available in jsdom)
Element.prototype.scrollIntoView = vi.fn();

describe('WorldFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows empty state when no messages', () => {
    mockUseChat.mockReturnValue({
      isOpen: true,
      messages: [],
      onClose: vi.fn(),
    });

    render(<WorldFeed inline />, { wrapper });
    expect(screen.getByText('Waiting for world events...')).toBeTruthy();
  });

  it('renders "World" heading instead of "Chat"', () => {
    mockUseChat.mockReturnValue({
      isOpen: true,
      messages: [],
      onClose: vi.fn(),
    });

    render(<WorldFeed inline />, { wrapper });
    const worldHeadings = screen.getAllByRole('heading', { name: 'World' });
    expect(worldHeadings.length).toBeGreaterThan(0);
    expect(screen.queryAllByRole('heading', { name: 'Chat' })).toHaveLength(0);
  });

  it('renders plain text messages (indexer events)', () => {
    mockUseChat.mockReturnValue({
      isOpen: true,
      messages: [
        {
          delivered: true,
          from: '0x0000000000000000000000000000000000000000',
          message: 'Kael reached Level 5',
          rarityColor: '#4A8B4A',
          timestamp: Date.now(),
        },
      ],
      onClose: vi.fn(),
    });

    render(<WorldFeed inline />, { wrapper });
    expect(screen.getByText('Kael reached Level 5')).toBeTruthy();
  });

  it('renders JSX messages (rich announcements)', () => {
    const jsx = <span data-testid="rich-announcement">Kael found Obsidian Blade</span>;
    mockUseChat.mockReturnValue({
      isOpen: true,
      messages: [
        {
          delivered: true,
          from: '0x0000000000000000000000000000000000000000',
          jsx,
          message: '',
          rarityColor: '#c47a2a',
          timestamp: Date.now(),
        },
      ],
      onClose: vi.fn(),
    });

    render(<WorldFeed inline />, { wrapper });
    expect(screen.getByTestId('rich-announcement')).toBeTruthy();
  });

  it('renders multiple event types', () => {
    const now = Date.now();
    mockUseChat.mockReturnValue({
      isOpen: true,
      messages: [
        {
          delivered: true,
          from: '0x0000000000000000000000000000000000000000',
          message: 'Kael reached Level 5',
          rarityColor: '#4A8B4A',
          timestamp: now - 3000,
        },
        {
          delivered: true,
          from: '0x0000000000000000000000000000000000000000',
          message: 'Anya fell in battle',
          rarityColor: '#8B4040',
          timestamp: now - 2000,
        },
        {
          delivered: true,
          from: '0x0000000000000000000000000000000000000000',
          message: 'Bjorn has entered the world',
          rarityColor: '#9B8EC4',
          timestamp: now - 1000,
        },
      ],
      onClose: vi.fn(),
    });

    const { container } = render(<WorldFeed inline />, { wrapper });
    const text = container.textContent || '';
    expect(text).toContain('Kael reached Level 5');
    expect(text).toContain('Anya fell in battle');
    expect(text).toContain('Bjorn has entered the world');
  });

  it('shows timestamp divider when messages are > 30 min apart', () => {
    const now = Date.now();
    const thirtyOneMinAgo = now - 31 * 60 * 1000;

    mockUseChat.mockReturnValue({
      isOpen: true,
      messages: [
        {
          delivered: true,
          from: '0x0000000000000000000000000000000000000000',
          message: 'Old event',
          rarityColor: '#4A8B4A',
          timestamp: thirtyOneMinAgo,
        },
        {
          delivered: true,
          from: '0x0000000000000000000000000000000000000000',
          message: 'New event',
          rarityColor: '#4A8B4A',
          timestamp: now,
        },
      ],
      onClose: vi.fn(),
    });

    const { container } = render(<WorldFeed inline />, { wrapper });
    // Both messages should have timestamp dividers since gap > 30 min
    const text = container.textContent || '';
    expect(text).toContain('Old event');
    expect(text).toContain('New event');
    // The em-dashes indicate timestamp dividers
    const dashCount = (text.match(/—/g) || []).length;
    expect(dashCount).toBeGreaterThanOrEqual(4); // 2 dividers x 2 dashes each
  });

  it('does not render login, join, or send UI elements', () => {
    mockUseChat.mockReturnValue({
      isOpen: true,
      messages: [],
      onClose: vi.fn(),
    });

    render(<WorldFeed inline />, { wrapper });

    // Should not have any chat-related UI
    expect(screen.queryByText('Login')).toBeNull();
    expect(screen.queryByText('Join Chat')).toBeNull();
    expect(screen.queryByPlaceholderText('Type a message...')).toBeNull();
  });
});
