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
        bg="#2A2218"
        border="1px solid #3A3228"
        borderRadius="lg"
        bottom={4}
        color="#8A7E6A"
        icon={<GiQuillInk size={18} />}
        left={4}
        onClick={openFeedback}
        position="fixed"
        size="sm"
        zIndex={10}
        _hover={{ bg: '#3A3228', color: '#D4A54A', borderColor: '#C87A2A' }}
      />
    </Tooltip>
  );
};
