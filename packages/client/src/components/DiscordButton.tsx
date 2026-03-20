import { IconButton, Tooltip } from '@chakra-ui/react';
import { FaDiscord } from 'react-icons/fa';

const DISCORD_URL = 'https://discord.gg/sSkQW36Fvj';

/** Floating Discord button — positioned above the FeedbackButton quill */
export const DiscordButton = (): JSX.Element => {
  return (
    <Tooltip
      bg="#2A2218"
      color="#C4B89E"
      fontFamily="Cinzel, serif"
      fontSize="xs"
      label="Join Discord"
      placement="right"
    >
      <IconButton
        aria-label="Join Discord"
        as="a"
        bg="linear-gradient(135deg, #3A2E1A 0%, #2A2218 100%)"
        border="1px solid #C87A2A"
        borderRadius="lg"
        bottom={14}
        boxShadow="0 0 8px rgba(200, 122, 42, 0.3)"
        color="#D4A54A"
        href={DISCORD_URL}
        icon={<FaDiscord size={20} />}
        left={{ base: 'auto', lg: 4 }}
        position="fixed"
        rel="noopener noreferrer"
        right={{ base: 4, lg: 'auto' }}
        size="md"
        target="_blank"
        zIndex={5}
        _hover={{ bg: '#3A3228', color: '#E8DCC8', borderColor: '#D4A54A', boxShadow: '0 0 12px rgba(212, 165, 74, 0.5)' }}
      />
    </Tooltip>
  );
};
