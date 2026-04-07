import {
  Box,
  Button,
  Divider,
  HStack,
  Text,
  useClipboard,
  VStack,
} from '@chakra-ui/react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueue } from '../contexts/QueueContext';

export const InvitePanel = (): JSX.Element => {
  const { t } = useTranslation('ui');
  const { inviteCodes, inviteStats, refreshInviteCodes } = useQueue();

  const availableCodes = inviteCodes.filter((c) => !c.usedBy);
  const usedCodes = inviteCodes.filter((c) => c.usedBy);

  return (
    <VStack align="stretch" spacing={6}>
      {/* Stats */}
      <Box border="1px solid" borderColor="#3A3228" p={4}>
        <Text fontFamily="Cinzel, serif" fontWeight={600} mb={3}>
          {t('invite.referralStats')}
        </Text>
        <HStack justify="space-around">
          <StatBox label={t('invite.codesSent')} value={inviteStats.codesUsed} />
          <StatBox label={t('invite.activated')} value={inviteStats.activated} />
          <StatBox label={t('invite.bonusEarned')} value={inviteStats.bonusCodes} />
        </HStack>
      </Box>

      {/* Available codes */}
      <Box border="1px solid" borderColor="#3A3228" p={4}>
        <Text fontFamily="Cinzel, serif" fontWeight={600} mb={3}>
          {t('invite.yourCodes')}
        </Text>
        {availableCodes.length === 0 ? (
          <VStack spacing={2}>
            <Text color="#8A7E6A" fontSize="sm">
              {t('invite.noCodes')}
            </Text>
            <VStack align="start" spacing={1}>
              <Text color="#8A7E6A" fontSize="sm">{t('invite.level3')}</Text>
              <Text color="#8A7E6A" fontSize="sm">{t('invite.level10')}</Text>
              <Text color="#8A7E6A" fontSize="sm">{t('invite.level20')}</Text>
              <Text color="#8A7E6A" fontSize="sm">{t('invite.friendLevel5')}</Text>
            </VStack>
          </VStack>
        ) : (
          <VStack align="stretch" spacing={3}>
            {availableCodes.map((code) => (
              <InviteCodeRow key={code.code} code={code.code} milestone={code.milestone} />
            ))}
          </VStack>
        )}
      </Box>

      {/* Used codes */}
      {usedCodes.length > 0 && (
        <Box border="1px solid" borderColor="#3A3228" p={4}>
          <Text fontFamily="Cinzel, serif" fontWeight={600} mb={3}>
            {t('invite.usedCodes')}
          </Text>
          <VStack align="stretch" spacing={2}>
            {usedCodes.map((code) => (
              <HStack key={code.code} justify="space-between">
                <Text color="#5A5040" fontFamily="mono" size="sm">
                  {code.code}
                </Text>
                <Text color="#5A5040" size="xs">
                  {t('invite.redeemed')}
                </Text>
              </HStack>
            ))}
          </VStack>
        </Box>
      )}

      <Button onClick={refreshInviteCodes} size="sm" variant="ghost">
        {t('invite.refreshCodes')}
      </Button>
    </VStack>
  );
};

const StatBox = ({ label, value }: { label: string; value: number }): JSX.Element => (
  <VStack spacing={0}>
    <Text fontFamily="mono" fontSize="xl" fontWeight={700}>
      {value}
    </Text>
    <Text color="#8A7E6A" size="xs">
      {label}
    </Text>
  </VStack>
);

const InviteCodeRow = ({ code, milestone }: { code: string; milestone: string }): JSX.Element => {
  const { t } = useTranslation('ui');
  const inviteUrl = `ultimatedominion.com?invite=${code}`;
  const { hasCopied, onCopy } = useClipboard(inviteUrl);

  const shareToX = useCallback(() => {
    const text = t('invite.tweetText', { inviteUrl });
    window.open(
      `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener',
    );
  }, [inviteUrl]);

  const milestoneLabel = milestone === 'activation_bonus'
    ? t('invite.bonus')
    : milestone.startsWith('starter')
      ? t('invite.starter')
      : milestone.replace('_', ' ');

  return (
    <Box border="1px solid" borderColor="#2A2520" p={3}>
      <HStack justify="space-between" mb={2}>
        <Text fontFamily="mono" fontWeight={700} letterSpacing="0.1em">
          {code}
        </Text>
        <Text color="#5A5040" fontSize="xs" textTransform="capitalize">
          {milestoneLabel}
        </Text>
      </HStack>
      <HStack spacing={2}>
        <Button onClick={onCopy} size="xs" variant="outline">
          {hasCopied ? t('share.copied') : t('invite.copyLink')}
        </Button>
        <Button onClick={shareToX} size="xs" variant="outline">
          {t('invite.shareToX')}
        </Button>
      </HStack>
    </Box>
  );
};
