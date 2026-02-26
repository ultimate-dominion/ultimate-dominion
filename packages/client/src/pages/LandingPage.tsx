import {
  Box,
  HStack,
  Image,
  Input,
  keyframes,
  Text,
  VStack,
} from '@chakra-ui/react';
import { FormEvent, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link as RouterLink } from 'react-router-dom';

const float = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(8px); }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const glowPulse = keyframes`
  0%, 100% { box-shadow: 0 0 8px rgba(200, 122, 42, 0.3), inset 0 0 8px rgba(200, 122, 42, 0.1); }
  50% { box-shadow: 0 0 16px rgba(200, 122, 42, 0.5), inset 0 0 12px rgba(200, 122, 42, 0.15); }
`;

const NavLink = ({
  to,
  label,
  subtitle,
}: {
  to: string;
  label: string;
  subtitle: string;
}) => (
  <Box
    as={RouterLink}
    to={to}
    border="1px solid"
    borderColor="rgba(196, 184, 158, 0.25)"
    flex="1"
    maxW="220px"
    minW="160px"
    px={6}
    py={5}
    textAlign="center"
    textDecoration="none"
    transition="all 0.3s ease"
    _hover={{
      borderColor: 'rgba(200, 122, 42, 0.4)',
      bg: 'rgba(200, 122, 42, 0.05)',
      transform: 'translateY(-2px)',
    }}
  >
    <Text
      color="rgba(196, 184, 158, 0.9)"
      fontSize={{ base: '11px', sm: '12px' }}
      fontWeight={600}
      letterSpacing="0.2em"
      textTransform="uppercase"
    >
      {label}
    </Text>
    <Text
      color="rgba(196, 184, 158, 0.4)"
      fontSize="11px"
      fontStyle="italic"
      mt={1}
    >
      {subtitle}
    </Text>
  </Box>
);

export const LandingPage = (): JSX.Element => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;

    // Store locally until a real backend is wired up
    const existing = JSON.parse(localStorage.getItem('ud:signups') || '[]');
    existing.push({ email, ts: Date.now() });
    localStorage.setItem('ud:signups', JSON.stringify(existing));

    setSubmitted(true);
  };

  return (
    <Box bg="#12100E" minH="100vh">
      <Helmet>
        <title>Ultimate Dominion — A Persistent On-Chain World</title>
      </Helmet>

      {/* ── Hero: full viewport ── */}
      <VStack
        align="center"
        h="100vh"
        justify="center"
        position="relative"
        px={4}
        spacing={6}
        // Radial vignette
        _before={{
          content: '""',
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)',
          pointerEvents: 'none',
        }}
      >
        <Image
          alt="Ultimate Dominion"
          maxW={{ base: '280px', sm: '380px', md: '480px' }}
          src="/images/ultimate-dominion-logo.svg"
        />

        <Text
          color="rgba(196, 184, 158, 0.7)"
          fontSize={{ base: '11px', sm: '13px' }}
          fontWeight={500}
          letterSpacing="0.35em"
          mt={2}
          textTransform="uppercase"
        >
          A Persistent On-Chain World
        </Text>

        {/* Scroll indicator */}
        <Box
          animation={`${float} 2.5s ease-in-out infinite`}
          bottom={{ base: '32px', sm: '48px' }}
          position="absolute"
        >
          <VStack spacing={1}>
            <Text
              color="rgba(196, 184, 158, 0.35)"
              fontSize="11px"
              letterSpacing="0.15em"
              textTransform="uppercase"
            >
              Enter
            </Text>
            <Text color="rgba(196, 184, 158, 0.3)" fontSize="18px">
              &#x2304;
            </Text>
          </VStack>
        </Box>
      </VStack>

      {/* ── Content: narrative + signup + links ── */}
      <VStack
        animation={`${fadeIn} 0.8s ease-out`}
        maxW="700px"
        mx="auto"
        pb={{ base: 20, sm: 28 }}
        pt={{ base: 16, sm: 24 }}
        px={{ base: 6, sm: 10 }}
        spacing={{ base: 14, sm: 18 }}
      >
        {/* Narrative */}
        <VStack spacing={8}>
          <Text
            color="rgba(196, 184, 158, 0.55)"
            fontSize={{ base: '14px', sm: '16px' }}
            fontStyle="italic"
            fontWeight={400}
            lineHeight="1.9"
            textAlign="center"
          >
            You wake in a cave with no memory and no name. The shadows
            around you hold secrets, whispering tales of survival and
            discovery.
          </Text>

          {/* Thin rule */}
          <Box bg="rgba(196, 184, 158, 0.12)" h="1px" w="60px" />

          <Text
            color="rgba(196, 184, 158, 0.5)"
            fontSize={{ base: '13px', sm: '15px' }}
            fontWeight={400}
            lineHeight="1.9"
            textAlign="center"
          >
            Everything here is permanent. Your gold, your weapons, your scars
            &mdash; they belong to you. Not to a server. Not to us. No one
            can take them, alter them, or shut them off.
          </Text>

          <Text
            color="rgba(196, 184, 158, 0.65)"
            fontSize={{ base: '13px', sm: '15px' }}
            fontWeight={500}
            lineHeight="1.9"
            textAlign="center"
          >
            This is not a game you finish. It&apos;s a world that becomes
            part of you.
          </Text>
        </VStack>

        {/* Email signup */}
        <VStack spacing={4} w="100%">
          {submitted ? (
            <VStack spacing={2}>
              <Text
                color="rgba(196, 184, 158, 0.7)"
                fontSize="14px"
                fontWeight={500}
                letterSpacing="0.05em"
              >
                You&apos;re on the list.
              </Text>
              <Text
                color="rgba(196, 184, 158, 0.4)"
                fontSize="13px"
                fontStyle="italic"
              >
                We&apos;ll send word when the gates open.
              </Text>
            </VStack>
          ) : (
            <Box as="form" maxW="420px" mx="auto" onSubmit={onSubmit} w="100%">
              <VStack spacing={3}>
                <Text
                  color="rgba(196, 184, 158, 0.5)"
                  fontSize={{ base: '12px', sm: '13px' }}
                  letterSpacing="0.1em"
                  textTransform="uppercase"
                >
                  Get notified when the gates open
                </Text>
                <HStack spacing={0} w="100%">
                  <Input
                    bg="rgba(196, 184, 158, 0.06)"
                    border="1px solid"
                    borderColor="rgba(196, 184, 158, 0.2)"
                    borderRadius="0"
                    color="rgba(232, 220, 200, 0.8)"
                    fontSize="14px"
                    h="44px"
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    type="email"
                    value={email}
                    _focus={{
                      borderColor: 'rgba(200, 122, 42, 0.6)',
                      boxShadow: 'none',
                    }}
                    _placeholder={{
                      color: 'rgba(196, 184, 158, 0.3)',
                    }}
                  />
                  <Box
                    as="button"
                    animation={`${glowPulse} 3s ease-in-out infinite`}
                    bg="rgba(200, 122, 42, 0.5)"
                    border="1px solid"
                    borderColor="rgba(200, 122, 42, 0.5)"
                    borderLeft="none"
                    color="rgba(232, 220, 200, 0.9)"
                    cursor="pointer"
                    flexShrink={0}
                    fontSize="12px"
                    fontWeight={600}
                    h="44px"
                    letterSpacing="0.15em"
                    px={6}
                    textTransform="uppercase"
                    transition="all 0.2s ease"
                    type="submit"
                    _hover={{
                      bg: 'rgba(200, 122, 42, 0.7)',
                      color: '#E8DCC8',
                    }}
                  >
                    Join
                  </Box>
                </HStack>
              </VStack>
            </Box>
          )}
        </VStack>

        {/* Thin rule */}
        <Box bg="rgba(196, 184, 158, 0.08)" h="1px" w="100%" />

        {/* Navigation links */}
        <HStack
          flexWrap="wrap"
          justify="center"
          spacing={{ base: 3, sm: 4 }}
          w="100%"
        >
          <NavLink
            label="Manifesto"
            subtitle="Our principles"
            to="/manifesto"
          />
          <NavLink
            label="Tavern"
            subtitle="Gather &amp; trade"
            to="/tavern"
          />
          <NavLink
            label="Guide"
            subtitle="Learn the way"
            to="/guide"
          />
        </HStack>
      </VStack>
    </Box>
  );
};
