import { Box, Heading, Link, Text, VStack } from '@chakra-ui/react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';

import { HOME_PATH } from '../Routes';

export const Terms = (): JSX.Element => {
  const navigate = useNavigate();

  return (
    <Box border="6px solid #3A3228" p={1.5}>
      <Helmet>
        <title>Terms of Service | Ultimate Dominion</title>
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
            Terms of Service
          </Heading>

          <VStack fontWeight={500} maxW="750px" spacing={6} textAlign="left" w="100%">
            <Text color="#8A7E6A" fontSize="sm">
              Last updated: March 8, 2026
            </Text>

            <Heading size="sm" w="100%">The Short Version</Heading>
            <Text>
              Ultimate Dominion is a browser-based game where your characters, items, and gold
              live on the Base blockchain. By playing, you agree to these terms. If you don't
              agree, don't play.
            </Text>

            <Heading size="sm" w="100%">The Game</Heading>
            <Text>
              Ultimate Dominion is provided as-is. We aim to keep it running and fair, but we
              make no guarantees about uptime, balance changes, or future development. The game
              is in active development — mechanics, economics, and systems may change.
            </Text>

            <Heading size="sm" w="100%">Your Account</Heading>
            <Text>
              You sign in with Google. A blockchain wallet is created for you automatically
              by our wallet provider,{' '}
              <Link href="https://www.privy.io" color="#C87A2A" isExternal>Privy</Link>.
              You are responsible for the account associated with your Google login.
              Don't share your credentials.
            </Text>

            <Heading size="sm" w="100%">On-Chain Assets</Heading>
            <Text>
              Characters, items, gold, and game actions are recorded on the Base blockchain.
              These are real on-chain assets. We do not control the blockchain and cannot reverse
              transactions. Once something happens on-chain, it's permanent. This is a feature,
              not a bug.
            </Text>

            <Heading size="sm" w="100%">Purchases</Heading>
            <Text>
              You can purchase Gold (the in-game currency) through the Gold Merchant using fiat
              currency. Payments are processed by{' '}
              <Link href="https://www.moonpay.com" color="#C87A2A" isExternal>MoonPay</Link>.
              All purchases are final. Purchased Gold is delivered to your blockchain wallet
              and is subject to the same permanence as all on-chain assets.
            </Text>

            <Heading size="sm" w="100%">Fair Play</Heading>
            <Text>
              Don't exploit bugs, automate gameplay with bots, manipulate the economy through
              multi-accounting, or do anything that ruins the experience for other players.
              We reserve the right to restrict access to game systems for accounts that
              violate fair play.
            </Text>

            <Heading size="sm" w="100%">Age Requirement</Heading>
            <Text>
              You must be at least 13 years old to play. If you're under 18, you need
              permission from a parent or guardian.
            </Text>

            <Heading size="sm" w="100%">Limitation of Liability</Heading>
            <Text>
              We are not liable for any loss of on-chain assets, including but not limited to
              characters, items, gold, or ETH, whether caused by smart contract bugs, blockchain
              issues, wallet provider failures, or any other cause. You play at your own risk.
              Our total liability to you shall not exceed the amount you've paid us in the
              last 12 months.
            </Text>

            <Heading size="sm" w="100%">Changes</Heading>
            <Text>
              We may update these terms. Continued play after changes constitutes acceptance.
              We'll note the update date at the top.
            </Text>

            <Heading size="sm" w="100%">Contact</Heading>
            <Text>
              Questions? Reach us at{' '}
              <Link href="mailto:hello@ultimatedominion.com" color="#C87A2A">
                hello@ultimatedominion.com
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
