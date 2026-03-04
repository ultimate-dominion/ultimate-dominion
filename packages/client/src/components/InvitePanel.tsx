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
import { useQueue } from '../contexts/QueueContext';

export const InvitePanel = (): JSX.Element => {
  const { inviteCodes, inviteStats, refreshInviteCodes } = useQueue();

  const availableCodes = inviteCodes.filter((c) => !c.usedBy);
  const usedCodes = inviteCodes.filter((c) => c.usedBy);

  return (
    <VStack align="stretch" spacing={6}>
      {/* Stats */}
      <Box border="1px solid" borderColor="#3A3228" p={4}>
        <Text fontFamily="Cinzel, serif" fontWeight={600} mb={3}>
          Referral Stats
        </Text>
        <HStack justify="space-around">
          <StatBox label="Codes Sent" value={inviteStats.codesUsed} />
          <StatBox label="Activated" value={inviteStats.activated} />
          <StatBox label="Bonus Earned" value={inviteStats.bonusCodes} />
        </HStack>
      </Box>

      {/* Available codes */}
      <Box border="1px solid" borderColor="#3A3228" p={4}>
        <Text fontFamily="Cinzel, serif" fontWeight={600} mb={3}>
          Your Invite Codes
        </Text>
        {availableCodes.length === 0 ? (
          <VStack spacing={2}>
            <Text color="#8A7E6A" size="sm">
              No invite codes yet. Earn codes by reaching milestones:
            </Text>
            <VStack align="start" spacing={1}>
              <Text color="#8A7E6A" size="sm">Level 3 — 1 invite code</Text>
              <Text color="#8A7E6A" size="sm">Level 10 — 1 invite code</Text>
              <Text color="#8A7E6A" size="sm">Level 20 — 1 invite code</Text>
              <Text color="#8A7E6A" size="sm">Activated referral — bonus code</Text>
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
            Used Codes
          </Text>
          <VStack align="stretch" spacing={2}>
            {usedCodes.map((code) => (
              <HStack key={code.code} justify="space-between">
                <Text color="#5A5040" fontFamily="mono" size="sm">
                  {code.code}
                </Text>
                <Text color="#5A5040" size="xs">
                  Redeemed
                </Text>
              </HStack>
            ))}
          </VStack>
        </Box>
      )}

      <Button onClick={refreshInviteCodes} size="sm" variant="ghost">
        Refresh Codes
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
  const inviteUrl = `ultimatedominion.com?invite=${code}`;
  const { hasCopied, onCopy } = useClipboard(inviteUrl);

  const shareToX = useCallback(() => {
    const text = `I'm playing Ultimate Dominion — an RPG where every battle, every scar, and every piece of loot is permanent.\n\nUse my invite code to skip the line: ${inviteUrl}\n\n#UltimateDominion`;
    window.open(
      `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener',
    );
  }, [inviteUrl]);

  const milestoneLabel = milestone === 'activation_bonus' ? 'Bonus' : milestone.replace('_', ' ');

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
          {hasCopied ? 'Copied!' : 'Copy Link'}
        </Button>
        <Button onClick={shareToX} size="xs" variant="outline">
          Share to X
        </Button>
      </HStack>
    </Box>
  );
};
