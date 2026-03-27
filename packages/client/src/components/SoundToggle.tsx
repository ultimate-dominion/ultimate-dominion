import { IconButton, Tooltip } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { GiSpeaker, GiSpeakerOff } from 'react-icons/gi';
import { useGameAudio } from '../contexts/SoundContext';

type SoundToggleProps = {
  size?: string;
  variant?: 'ghost' | 'subtle';
};

export const SoundToggle = ({ size = 'sm', variant = 'ghost' }: SoundToggleProps): JSX.Element => {
  const { t } = useTranslation('ui');
  const { soundEnabled, toggleSound } = useGameAudio();

  return (
    <Tooltip
      hasArrow
      label={soundEnabled ? t('sound.mute') : t('sound.unmute')}
      placement="top"
      shouldWrapChildren
    >
      <IconButton
        aria-label={soundEnabled ? t('sound.muteAria') : t('sound.enableAria')}
        icon={soundEnabled ? <GiSpeaker size={18} /> : <GiSpeakerOff size={18} />}
        onClick={toggleSound}
        size={size}
        variant={variant === 'ghost' ? 'ghost' : 'unstyled'}
        color={soundEnabled ? '#D4A54A' : '#5A5248'}
        opacity={soundEnabled ? 1 : 0.6}
        _hover={{ color: '#D4A54A', opacity: 1 }}
        transition="all 0.2s"
        minW={0}
      />
    </Tooltip>
  );
};
