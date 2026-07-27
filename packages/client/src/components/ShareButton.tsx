import {
  HStack,
  IconButton,
  Text,
  Tooltip,
  useClipboard,
} from '@chakra-ui/react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaCheck, FaCopy } from 'react-icons/fa';
import { FaShareNodes } from 'react-icons/fa6';

const GAME_URL = 'https://ultimatedominion.com';
const HASHTAG = '#UltimateDominion';

type ShareButtonProps = {
  text: string;
  shareParams?: Record<string, string>;
  colorAccent?: string;
};

function buildShareUrl(params?: Record<string, string>): string {
  if (!params) return GAME_URL;
  const qs = new URLSearchParams(params).toString();
  return `${GAME_URL}/s?${qs}`;
}

export const ShareButton = ({
  text,
  shareParams,
  colorAccent = '#8A7E6A',
}: ShareButtonProps): JSX.Element => {
  const { t } = useTranslation('ui');
  const shareUrl = buildShareUrl(shareParams);
  const fullText = `${text}\n\n${shareUrl}\n\n${HASHTAG}`;
  const { hasCopied, onCopy } = useClipboard(fullText);
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = useCallback(async () => {
    setIsSharing(true);
    try {
      if (navigator.share) {
        await navigator.share({ text, url: shareUrl });
        return;
      }
      window.open(
        `https://x.com/intent/tweet?text=${encodeURIComponent(fullText)}`,
        '_blank',
        'noopener',
      );
    } finally {
      setIsSharing(false);
    }
  }, [fullText, shareUrl, text]);

  return (
    <HStack spacing={1}>
      <Tooltip label={t('share.shareAria')} placement="top" hasArrow>
        <IconButton
          aria-label={t('share.shareAria')}
          icon={<FaShareNodes />}
          onClick={handleShare}
          isLoading={isSharing}
          variant="ghost"
          size="xs"
          color={colorAccent}
          _hover={{ color: '#E8DCC8', bg: `${colorAccent}20` }}
        />
      </Tooltip>
      <Tooltip
        label={hasCopied ? t('share.copied') : t('share.copyText')}
        placement="top"
        hasArrow
      >
        <IconButton
          aria-label={t('share.copyAria')}
          icon={hasCopied ? <FaCheck /> : <FaCopy />}
          onClick={onCopy}
          variant="ghost"
          size="xs"
          color={hasCopied ? '#5A8A3E' : colorAccent}
          _hover={{ color: '#E8DCC8', bg: `${colorAccent}20` }}
        />
      </Tooltip>
      {hasCopied && (
        <Text fontSize="9px" color="#5A8A3E" fontFamily="mono">
          {t('share.copied')}
        </Text>
      )}
    </HStack>
  );
};
