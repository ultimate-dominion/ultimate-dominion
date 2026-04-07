// Mock useChat before importing ChatPanel
const mockUseChat = vi.fn();
vi.mock('../contexts/ChatContext', () => ({
  useChat: () => mockUseChat(),
}));

// Mock useMap
vi.mock('../contexts/MapContext', () => ({
  useMap: () => ({ allCharacters: [] }),
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ChatPanel } from './ChatPanel';

// Suppress i18next missing key warnings
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const baseChatState = {
  activeTab: 'world' as const,
  setActiveTab: vi.fn(),
  worldMessages: [],
  globalMessages: [],
  guildMessages: [],
  guildId: null,
  sendMessage: vi.fn(),
  isSending: false,
  isOpen: true,
  onOpen: vi.fn(),
  onClose: vi.fn(),
  onSetMessageInputFocus: vi.fn(),
  isMessageInputFocused: false,
  worldUnread: 0,
  globalUnread: 0,
  guildUnread: 0,
  unreadCount: 0,
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

describe('ChatPanel', () => {
  beforeEach(() => {
    mockUseChat.mockReturnValue(baseChatState);
  });

  it('renders World and Global tabs', () => {
    render(<ChatPanel inline />, { wrapper });
    expect(screen.getByText('World')).toBeDefined();
    expect(screen.getByText('Global')).toBeDefined();
  });

  it('does not render Guild tab when guildId is null', () => {
    render(<ChatPanel inline />, { wrapper });
    expect(screen.queryByText('Guild')).toBeNull();
  });

  it('renders Guild tab when guildId is set', () => {
    mockUseChat.mockReturnValue({
      ...baseChatState,
      guildId: '0x1234',
    });
    render(<ChatPanel inline />, { wrapper });
    expect(screen.getByText('Guild')).toBeDefined();
  });

  it('shows empty state for world tab', () => {
    render(<ChatPanel inline />, { wrapper });
    expect(screen.getAllByText('The realm is silent...').length).toBeGreaterThan(0);
  });

  it('does not show input on world tab', () => {
    render(<ChatPanel inline />, { wrapper });
    expect(screen.queryByPlaceholderText('Say something...')).toBeNull();
  });

  it('shows input on global tab', () => {
    mockUseChat.mockReturnValue({
      ...baseChatState,
      activeTab: 'global',
    });
    render(<ChatPanel inline />, { wrapper });
    expect(screen.getByPlaceholderText('Say something...')).toBeDefined();
  });

  it('shows unread badge on tab', () => {
    mockUseChat.mockReturnValue({
      ...baseChatState,
      globalUnread: 3,
    });
    render(<ChatPanel inline />, { wrapper });
    expect(screen.getByText('3')).toBeDefined();
  });

  it('shows 9+ for large unread counts', () => {
    mockUseChat.mockReturnValue({
      ...baseChatState,
      globalUnread: 15,
    });
    render(<ChatPanel inline />, { wrapper });
    expect(screen.getByText('9+')).toBeDefined();
  });

  it('renders world feed messages', () => {
    mockUseChat.mockReturnValue({
      ...baseChatState,
      worldMessages: [
        {
          delivered: true,
          from: '0x0000000000000000000000000000000000000000',
          message: 'Test event happened',
          timestamp: Date.now(),
        },
      ],
    });
    render(<ChatPanel inline />, { wrapper });
    expect(screen.getByText('Test event happened')).toBeDefined();
  });

  it('renders chat messages on global tab', () => {
    mockUseChat.mockReturnValue({
      ...baseChatState,
      activeTab: 'global',
      globalMessages: [
        {
          id: '1',
          channel: 'global',
          senderAddress: '0xabc',
          senderName: 'TestPlayer',
          senderCharacterId: '0xdef',
          content: 'Hello world!',
          timestamp: Date.now(),
        },
      ],
    });
    render(<ChatPanel inline />, { wrapper });
    expect(screen.getByText('TestPlayer')).toBeDefined();
    expect(screen.getByText('Hello world!')).toBeDefined();
  });
});
