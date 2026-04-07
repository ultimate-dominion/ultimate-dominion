/**
 * Minimal app shell for when the game isn't live (placeholder/landing mode).
 * Renders without any MUD, Web3, or Auth providers — just static pages.
 */
import { Box, Text, VStack } from '@chakra-ui/react';
import { Helmet } from 'react-helmet-async';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BrowserRouter,
  Link as RouterLink,
  Route,
  Routes,
} from 'react-router-dom';

import { LandingPage } from './pages/LandingPage';
import { Tavern } from './pages/Tavern';

const TAVERN_URL = 'https://tavern.ultimatedominion.com';
const ExternalRedirect = ({ to }: { to: string }) => {
  useEffect(() => { window.location.href = to; }, [to]);
  return null;
};

/**
 * Dark-themed manifesto for the placeholder site.
 * The live game's Manifesto.tsx uses a light theme, so we re-implement
 * the content here to match the dark landing page aesthetic.
 */
const DarkManifesto = (): JSX.Element => {
  const { t } = useTranslation('pages');
  return (
    <Box bg="#12100E" minH="100vh">
      <Helmet>
        <title>{t('manifesto.metaTitle')}</title>
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
          color="rgba(196, 184, 158, 0.5)"
          fontSize={{ base: '13px', sm: '14px' }}
          fontWeight={600}
          letterSpacing="0.25em"
          textTransform="uppercase"
        >
          {t('manifesto.title')}
        </Text>

        <VStack spacing={6}>
          <Text
            color="rgba(196, 184, 158, 0.6)"
            fontSize={{ base: '16px', sm: '18px' }}
            fontStyle="italic"
            fontWeight={400}
            lineHeight="1.9"
            textAlign="center"
          >
            {t('manifesto.opening')}
          </Text>
          <Text
            color="rgba(196, 184, 158, 0.45)"
            fontSize={{ base: '15px', sm: '17px' }}
            fontWeight={400}
            lineHeight="1.9"
            textAlign="center"
          >
            {t('manifesto.p1')}
          </Text>
          <Text
            color="rgba(196, 184, 158, 0.45)"
            fontSize={{ base: '15px', sm: '17px' }}
            fontWeight={400}
            lineHeight="1.9"
            textAlign="center"
          >
            {t('manifesto.p2')}
          </Text>
          <Text
            color="rgba(196, 184, 158, 0.45)"
            fontSize={{ base: '15px', sm: '17px' }}
            fontWeight={400}
            lineHeight="1.9"
            textAlign="center"
          >
            {t('manifesto.p3')}
          </Text>
          <Text
            color="rgba(196, 184, 158, 0.6)"
            fontSize={{ base: '15px', sm: '17px' }}
            fontWeight={500}
            lineHeight="1.9"
            textAlign="center"
          >
            {t('manifesto.closing')}
          </Text>
        </VStack>

        <Box
          as={RouterLink}
          color="rgba(196, 184, 158, 0.35)"
          fontSize="14px"
          letterSpacing="0.15em"
          mt={4}
          textDecoration="none"
          textTransform="uppercase"
          to="/"
          _hover={{ color: 'rgba(196, 184, 158, 0.6)' }}
        >
          &larr; Back
        </Box>
      </VStack>
    </Box>
  );
};

const PlaceholderPage = ({
  title,
  description,
}: {
  title: string;
  description: string;
}): JSX.Element => (
  <Box bg="#12100E" minH="100vh">
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
        color="rgba(196, 184, 158, 0.5)"
        fontSize={{ base: '13px', sm: '14px' }}
        fontWeight={600}
        letterSpacing="0.25em"
        textTransform="uppercase"
      >
        {title}
      </Text>
      <Text
        color="rgba(196, 184, 158, 0.4)"
        fontSize={{ base: '16px', sm: '18px' }}
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
        color="rgba(196, 184, 158, 0.35)"
        fontSize="14px"
        letterSpacing="0.15em"
        mt={4}
        textDecoration="none"
        textTransform="uppercase"
        to="/"
        _hover={{ color: 'rgba(196, 184, 158, 0.6)' }}
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
      <Route path="/guide" element={<Tavern />} />
      <Route path="/tavern" element={<ExternalRedirect to={TAVERN_URL} />} />
      <Route path="*" element={<LandingPage />} />
    </Routes>
  </BrowserRouter>
);
