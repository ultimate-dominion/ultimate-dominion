/**
 * Minimal app shell for when the game isn't live (placeholder/landing mode).
 * Renders without any MUD, Web3, or Auth providers — just static pages.
 */
import { Box, Text, VStack } from '@chakra-ui/react';
import { Helmet } from 'react-helmet-async';
import {
  BrowserRouter,
  Link as RouterLink,
  Route,
  Routes,
} from 'react-router-dom';

import { LandingPage } from './pages/LandingPage';
import { ThemeMidnightSteel } from './pages/ThemeMidnightSteel';
import { ThemeObsidianVoid } from './pages/ThemeObsidianVoid';
import { ThemeTorchlitDungeon } from './pages/ThemeTorchlitDungeon';

/**
 * Dark-themed manifesto for the placeholder site.
 * The live game's Manifesto.tsx uses a light theme, so we re-implement
 * the content here to match the dark landing page aesthetic.
 */
const DarkManifesto = (): JSX.Element => (
  <Box bg="#0C1539" minH="100vh">
    <Helmet>
      <title>Manifesto | Ultimate Dominion</title>
    </Helmet>
    <VStack
      justify="center"
      maxW="650px"
      minH="100vh"
      mx="auto"
      px={{ base: 6, sm: 12 }}
      py={{ base: 16, sm: 24 }}
      spacing={8}
    >
      <Text
        color="rgba(162, 169, 176, 0.5)"
        fontSize={{ base: '11px', sm: '12px' }}
        fontWeight={600}
        letterSpacing="0.25em"
        textTransform="uppercase"
      >
        Manifesto
      </Text>

      <VStack spacing={6}>
        <Text
          color="rgba(162, 169, 176, 0.6)"
          fontSize={{ base: '14px', sm: '16px' }}
          fontStyle="italic"
          fontWeight={400}
          lineHeight="1.9"
          textAlign="center"
        >
          You wake in a cave with no memory and no name. Everything after
          that is yours.
        </Text>
        <Text
          color="rgba(162, 169, 176, 0.45)"
          fontSize={{ base: '13px', sm: '15px' }}
          fontWeight={400}
          lineHeight="1.9"
          textAlign="center"
        >
          This is a world built for years, not minutes. Progression is slow
          because the journey is the point. Stories are earned, not skipped.
          The lore isn&apos;t written for you &mdash; it&apos;s written by
          what you do, who you fight, what you choose to protect, and what
          you let burn.
        </Text>
        <Text
          color="rgba(162, 169, 176, 0.45)"
          fontSize={{ base: '13px', sm: '15px' }}
          fontWeight={400}
          lineHeight="1.9"
          textAlign="center"
        >
          Everything here is permanent. Your gold, your weapons, your scars
          &mdash; they belong to you. Not to a server. Not to us. No one
          can take them, alter them, or shut them off. You don&apos;t have
          to take our word for it. You can prove it.
        </Text>
        <Text
          color="rgba(162, 169, 176, 0.45)"
          fontSize={{ base: '13px', sm: '15px' }}
          fontWeight={400}
          lineHeight="1.9"
          textAlign="center"
        >
          You don&apos;t need to download anything. Open your browser. Step
          into the dark.
        </Text>
        <Text
          color="rgba(162, 169, 176, 0.6)"
          fontSize={{ base: '13px', sm: '15px' }}
          fontWeight={500}
          lineHeight="1.9"
          textAlign="center"
        >
          This is not a game you finish. It&apos;s a world that becomes
          part of you.
        </Text>
      </VStack>

      <Box
        as={RouterLink}
        color="rgba(162, 169, 176, 0.35)"
        fontSize="12px"
        letterSpacing="0.15em"
        mt={4}
        textDecoration="none"
        textTransform="uppercase"
        to="/"
        _hover={{ color: 'rgba(162, 169, 176, 0.6)' }}
      >
        &larr; Back
      </Box>
    </VStack>
  </Box>
);

const PlaceholderPage = ({
  title,
  description,
}: {
  title: string;
  description: string;
}): JSX.Element => (
  <Box bg="#0C1539" minH="100vh">
    <Helmet>
      <title>{title} | Ultimate Dominion</title>
    </Helmet>
    <VStack
      justify="center"
      minH="100vh"
      px={{ base: 6, sm: 12 }}
      spacing={8}
    >
      <Text
        color="rgba(162, 169, 176, 0.5)"
        fontSize={{ base: '11px', sm: '12px' }}
        fontWeight={600}
        letterSpacing="0.25em"
        textTransform="uppercase"
      >
        {title}
      </Text>
      <Text
        color="rgba(162, 169, 176, 0.4)"
        fontSize={{ base: '14px', sm: '16px' }}
        fontStyle="italic"
        fontWeight={400}
        lineHeight="1.9"
        maxW="500px"
        textAlign="center"
      >
        {description}
      </Text>
      <Box
        as={RouterLink}
        color="rgba(162, 169, 176, 0.35)"
        fontSize="12px"
        letterSpacing="0.15em"
        mt={4}
        textDecoration="none"
        textTransform="uppercase"
        to="/"
        _hover={{ color: 'rgba(162, 169, 176, 0.6)' }}
      >
        &larr; Back
      </Box>
    </VStack>
  </Box>
);

export const PlaceholderApp = (): JSX.Element => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/manifesto" element={<DarkManifesto />} />
      <Route
        path="/tavern"
        element={
          <PlaceholderPage
            title="The Tavern"
            description="A place where adventurers gather to share tales, trade rumors, and form alliances. The Tavern will open its doors soon."
          />
        }
      />
      <Route
        path="/guide"
        element={
          <PlaceholderPage
            title="Adventurer's Guide"
            description="Everything you need to know about surviving in the world of Ultimate Dominion. The Guide is being written."
          />
        }
      />
      <Route path="/theme/midnight-steel" element={<ThemeMidnightSteel />} />
      <Route path="/theme/torchlit-dungeon" element={<ThemeTorchlitDungeon />} />
      <Route path="/theme/obsidian-void" element={<ThemeObsidianVoid />} />
      <Route path="*" element={<LandingPage />} />
    </Routes>
  </BrowserRouter>
);
