import {
  Box,
  Button,
  Heading,
  HStack,
  Input,
  Text,
  VStack,
} from '@chakra-ui/react';
import { FormEvent, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link as RouterLink } from 'react-router-dom';

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
    <Box border="6px solid #1A244E" p={1.5}>
      <Helmet>
        <title>Ultimate Dominion — A Persistent On-Chain World</title>
      </Helmet>
      <Box border="0.5px solid #1A244E">
        <VStack
          justifyContent="center"
          mb={16}
          mt={{ base: 20, sm: 32 }}
          px={{ base: 4, sm: 12, md: 20 }}
          spacing={{ base: 12, md: 16 }}
        >
          <VStack spacing={4}>
            <Heading
              size={{ base: 'md', md: 'lg' }}
              textAlign="center"
              textTransform="uppercase"
            >
              Ultimate Dominion
            </Heading>
            <Text
              fontStyle="italic"
              fontWeight={500}
              maxW="600px"
              size={{ base: 'xs', sm: 'sm' }}
              textAlign="center"
            >
              A persistent on-chain world where every choice is permanent
              and every story is yours.
            </Text>
          </VStack>

          <VStack fontWeight={500} maxW="750px" spacing={6} textAlign="center">
            <Text size={{ base: 'xs', sm: 'sm', md: 'md' }}>
              You wake in a cave with no memory and no name. The shadows around
              you hold secrets, whispering tales of survival and discovery.
            </Text>
            <Text size={{ base: 'xs', sm: 'sm', md: 'md' }}>
              Everything here is permanent. Your gold, your weapons, your scars
              — they belong to you. Not to a server. Not to us. No one can take
              them, alter them, or shut them off.
            </Text>
            <Text
              fontWeight={600}
              size={{ base: 'xs', sm: 'sm', md: 'md' }}
            >
              This is not a game you finish. It&apos;s a world that becomes
              part of you.
            </Text>
          </VStack>

          {/* Email signup */}
          <VStack spacing={3} w={{ base: '100%', sm: '400px' }}>
            {submitted ? (
              <Text fontWeight={600} size="sm">
                You&apos;re on the list. We&apos;ll be in touch.
              </Text>
            ) : (
              <Box as="form" onSubmit={onSubmit} w="100%">
                <VStack spacing={3}>
                  <Text fontWeight={500} size="sm">
                    Get notified when the gates open
                  </Text>
                  <HStack w="100%" spacing={2}>
                    <Input
                      bg="white"
                      borderColor="grey500"
                      borderRadius="8px"
                      onChange={e => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      size="md"
                      type="email"
                      value={email}
                    />
                    <Button
                      flexShrink={0}
                      type="submit"
                      variant="blue"
                    >
                      Notify Me
                    </Button>
                  </HStack>
                </VStack>
              </Box>
            )}
          </VStack>

          {/* Navigation links */}
          <HStack spacing={{ base: 4, sm: 8 }} flexWrap="wrap" justify="center">
            <Button
              as={RouterLink}
              to="/manifesto"
              variant="outline"
              size="sm"
            >
              Manifesto
            </Button>
            <Button
              as={RouterLink}
              to="/tavern"
              variant="outline"
              size="sm"
            >
              Tavern
            </Button>
            <Button
              as={RouterLink}
              to="/guide"
              variant="outline"
              size="sm"
            >
              Guide
            </Button>
          </HStack>
        </VStack>
      </Box>
    </Box>
  );
};
