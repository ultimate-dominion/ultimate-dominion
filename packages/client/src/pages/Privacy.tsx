import { Box, Heading, Link, Text, VStack } from '@chakra-ui/react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';

import { HOME_PATH } from '../Routes';

export const Privacy = (): JSX.Element => {
  const navigate = useNavigate();

  return (
    <Box border="6px solid #3A3228" p={1.5}>
      <Helmet>
        <title>Privacy Policy | Ultimate Dominion</title>
      </Helmet>
      <Box border="0.5px solid #3A3228">
        <VStack
          justifyContent="center"
          mb={16}
          mt={{ base: 12, sm: 20 }}
          px={{ base: 4, sm: 12, md: 20 }}
          spacing={{ base: 8, md: 10 }}
        >
          <Heading
            size={{ base: 'md', md: 'lg' }}
            textAlign="center"
            textTransform="uppercase"
          >
            Privacy Policy
          </Heading>

          <VStack fontWeight={500} maxW="750px" spacing={6} textAlign="left" w="100%">
            <Text color="#8A7E6A" fontSize="sm">
              Last updated: March 8, 2026
            </Text>

            <Heading size="sm" w="100%">What We Collect</Heading>
            <Text>
              When you sign in with Google, we receive your email address and create a blockchain wallet on your behalf.
              We store the association between your email and wallet address to provide game services
              (queue notifications, account recovery).
            </Text>

            <Text>
              We collect basic usage data (page views, feature interactions) through Vercel Analytics
              to improve the game. This data is anonymized and contains no personal identifiers.
            </Text>

            <Heading size="sm" w="100%">Your Wallet</Heading>
            <Text>
              Your embedded wallet is created and managed by{' '}
              <Link href="https://www.privy.io/privacy" color="#C87A2A" isExternal>Privy</Link>.
              Private keys are split across multiple parties using MPC (multi-party computation) and
              are never stored in full by any single entity. We do not have access to your private keys.
            </Text>

            <Heading size="sm" w="100%">On-Chain Data</Heading>
            <Text>
              Your character, items, gold, and game actions are recorded on the Base blockchain.
              This data is public and permanent by design. We cannot delete on-chain data,
              nor would we want to — your history belongs to you.
            </Text>

            <Heading size="sm" w="100%">Payments</Heading>
            <Text>
              If you purchase Gold through the Gold Merchant, payment processing is handled by{' '}
              <Link href="https://www.moonpay.com/legal/privacy_policy" color="#C87A2A" isExternal>MoonPay</Link>.
              We do not see or store your payment card details. MoonPay processes payments
              directly and sends cryptocurrency to your wallet.
            </Text>

            <Heading size="sm" w="100%">What We Don't Do</Heading>
            <Text>
              We don't sell your data. We don't run ads. We don't share your email with third parties
              beyond the services listed above. We don't track you across other websites.
            </Text>

            <Heading size="sm" w="100%">Data Retention</Heading>
            <Text>
              Your email is stored as long as you have an account. You can request deletion
              by contacting us. On-chain data (characters, items, transactions) is permanent
              and cannot be removed from the blockchain.
            </Text>

            <Heading size="sm" w="100%">Contact</Heading>
            <Text>
              Questions about your data? Reach us at{' '}
              <Link href="mailto:privacy@ultimatedominion.com" color="#C87A2A">
                privacy@ultimatedominion.com
              </Link>.
            </Text>
          </VStack>

          <Text
            color="#C87A2A"
            cursor="pointer"
            fontSize="sm"
            mt={4}
            onClick={() => navigate(HOME_PATH)}
            _hover={{ textDecoration: 'underline' }}
          >
            Back to game
          </Text>
        </VStack>
      </Box>
    </Box>
  );
};
