import { IconButton, Tooltip } from '@chakra-ui/react';
import { useCallback } from 'react';
import { GiQuillInk } from 'react-icons/gi';

import { useCharacter } from '../contexts/CharacterContext';

const DISCOURSE_URL = 'https://tavern.ultimatedominion.com';
const CATEGORY_SLUG = 'beta-feedback';

/** Floating feedback button — opens Discourse with a pre-filled bug/feedback template */
export const FeedbackButton = (): JSX.Element => {
  const { character } = useCharacter();

  const openFeedback = useCallback(() => {
    const charInfo = character
      ? `- **Character**: ${character.name} (Level ${character.level})\n- **Class**: ${character.class ?? 'Unknown'}\n- **Zone**: ${character.zone ?? 'Unknown'}`
      : '- **Character**: (not loaded)';

    const body = [
      '## What happened?',
      '_Describe what you were doing when you noticed the issue or had the thought._\n',
      '## Expected behavior',
      '_What did you expect to happen instead?_\n',
      '## How does it feel?',
      '_Any thoughts — too slow, confusing, fun, frustrating, cool?_\n',
      '## Details',
      charInfo,
      `- **Browser**: ${navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'}`,
      `- **Time**: ${new Date().toISOString()}`,
    ].join('\n');

    const params = new URLSearchParams({
      title: 'Beta Feedback: ',
      body,
      category: CATEGORY_SLUG,
    });

    window.open(`${DISCOURSE_URL}/new-topic?${params.toString()}`, '_blank');
  }, [character]);

  return (
    <Tooltip
      bg="#2A2218"
      color="#C4B89E"
      fontFamily="Cinzel, serif"
      fontSize="xs"
      label="Send Feedback"
      placement="right"
    >
      <IconButton
        aria-label="Send feedback"
        bg="linear-gradient(135deg, #3A2E1A 0%, #2A2218 100%)"
        border="1px solid #C87A2A"
        borderRadius="lg"
        bottom={4}
        boxShadow="0 0 8px rgba(200, 122, 42, 0.3)"
        color="#D4A54A"
        icon={<GiQuillInk size={20} />}
        left={{ base: '50%', lg: 4 }}
        onClick={openFeedback}
        position="fixed"
        size="md"
        transform={{ base: 'translateX(-50%)', lg: 'none' }}
        zIndex={5}
        _hover={{ bg: '#3A3228', color: '#E8DCC8', borderColor: '#D4A54A', boxShadow: '0 0 12px rgba(212, 165, 74, 0.5)' }}
      />
    </Tooltip>
  );
};
