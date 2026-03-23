import { Box, Button, Heading, keyframes, Text, VStack } from '@chakra-ui/react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';

import { HOME_PATH } from '../Routes';

const dragonPulse = keyframes`
  0%, 100% { opacity: 0.03; }
  50% { opacity: 0.045; }
`;

export const Manifesto = (): JSX.Element => {
  const navigate = useNavigate();

  return (
    <Box border="6px solid #3A3228" p={1.5}>
      <Helmet>
        <title>Manifesto | Ultimate Dominion</title>
      </Helmet>
      <Box
        border="0.5px solid #3A3228"
        position="relative"
      >
        {/* Warm glow behind dragon */}
        <Box
          background="radial-gradient(ellipse at center, rgba(200,122,42,0.035) 0%, transparent 65%)"
          height="80%"
          left="50%"
          pointerEvents="none"
          position="absolute"
          top="50%"
          transform="translate(-50%, -50%)"
          width="80%"
          zIndex={0}
        />
        {/* Dragon watermark */}
        <Box
          animation={`${dragonPulse} 6s ease-in-out infinite`}
          backgroundImage="url(/images/ud-dragon.svg)"
          backgroundPosition="center"
          backgroundRepeat="no-repeat"
          backgroundSize="contain"
          height="60%"
          left="50%"
          opacity={0.03}
          pointerEvents="none"
          position="absolute"
          top="50%"
          transform="translate(-50%, -50%)"
          width="60%"
          zIndex={0}
        />
        <VStack
          justifyContent="center"
          mb={16}
          mt={{ base: 20, sm: 32 }}
          px={{ base: 4, sm: 12, md: 20 }}
          spacing={{ base: 10, md: 14 }}
        >
          <Heading
            size={{ base: 'md', md: 'lg' }}
            textAlign="center"
            textTransform="uppercase"
          >
            Manifesto
          </Heading>
          <VStack fontWeight={500} maxW="750px" spacing={6} textAlign="center">
            <Text
              fontStyle="italic"
              size={{ base: 'xs', sm: 'sm', md: 'md' }}
            >
              You wake in a cave with no memory and no name. Everything after
              that is yours.
            </Text>
            <Text size={{ base: 'xs', sm: 'sm', md: 'md' }}>
              This is a world built for years, not minutes. Progression is slow
              because the journey is the point. Stories are earned, not skipped.
              The lore isn&apos;t written for you — it&apos;s written by what
              you do, who you fight, what you choose to protect, and what you
              let burn.
            </Text>
            <Text size={{ base: 'xs', sm: 'sm', md: 'md' }}>
              Everything here is permanent. Your gold, your weapons, your scars
              — they belong to you. Not to a server. Not to us. No one can take
              them, alter them, or shut them off. You don&apos;t have to take
              our word for it. You can prove it.
            </Text>
            <Text size={{ base: 'xs', sm: 'sm', md: 'md' }}>
              You don&apos;t need to download anything. Open your browser. Step
              into the dark.
            </Text>
            <Text
              fontWeight={600}
              size={{ base: 'xs', sm: 'sm', md: 'md' }}
            >
              This is not a game you finish. It&apos;s a world that becomes
              part of you.
            </Text>
          </VStack>
          <Button onClick={() => navigate(HOME_PATH)} variant="outline">
            Enter the World
          </Button>
        </VStack>
      </Box>
    </Box>
  );
};
