/**
 * Minimal app shell for when the game isn't live (placeholder/landing mode).
 * Renders without any MUD, Web3, or Auth providers — just static pages.
 */
import { Box, Button, Heading, Text, VStack } from '@chakra-ui/react';
import { Helmet } from 'react-helmet-async';
import {
  BrowserRouter,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom';

import { LandingPage } from './pages/LandingPage';
import { Manifesto } from './pages/Manifesto';

const PlaceholderPage = ({
  title,
  description,
}: {
  title: string;
  description: string;
}): JSX.Element => {
  const navigate = useNavigate();

  return (
    <Box border="6px solid #1A244E" p={1.5}>
      <Helmet>
        <title>{title} | Ultimate Dominion</title>
      </Helmet>
      <Box border="0.5px solid #1A244E">
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
            {title}
          </Heading>
          <Text
            fontWeight={500}
            maxW="600px"
            size={{ base: 'xs', sm: 'sm', md: 'md' }}
            textAlign="center"
          >
            {description}
          </Text>
          <Button onClick={() => navigate('/')} variant="outline">
            Back
          </Button>
        </VStack>
      </Box>
    </Box>
  );
};

export const PlaceholderApp = (): JSX.Element => (
  <BrowserRouter>
    <Box maxW="1200px" mx="auto" px={{ base: 2, sm: 4 }} py={4}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/manifesto" element={<Manifesto />} />
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
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </Box>
  </BrowserRouter>
);
