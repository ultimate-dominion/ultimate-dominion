import { Box, Button, Heading, Text, VStack } from '@chakra-ui/react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { LocaleHead } from '../components/LocaleHead';
import { HOME_PATH } from '../Routes';

export const Manifesto = (): JSX.Element => {
  const navigate = useNavigate();
  const { t } = useTranslation('pages');

  return (
    <Box border="6px solid #3A3228" p={1.5}>
      <Helmet>
        <title>{t('manifesto.metaTitle')}</title>
        <meta name="description" content={t('manifesto.metaDescription')} />
        <link rel="canonical" href="https://ultimatedominion.com/manifesto" />
        <meta property="og:title" content={t('manifesto.ogTitle')} />
        <meta
          property="og:description"
          content={t('manifesto.ogDescription')}
        />
        <meta
          property="og:url"
          content="https://ultimatedominion.com/manifesto"
        />
      </Helmet>
      <LocaleHead path="/manifesto" />
      <Box border="0.5px solid #3A3228" position="relative">
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
            {t('manifesto.title')}
          </Heading>
          <VStack fontWeight={500} maxW="750px" spacing={6} textAlign="center">
            <Text fontStyle="italic" size={{ base: 'xs', sm: 'sm', md: 'md' }}>
              {t('manifesto.opening')}
            </Text>
            <Text size={{ base: 'xs', sm: 'sm', md: 'md' }}>
              {t('manifesto.p1')}
            </Text>
            <Text size={{ base: 'xs', sm: 'sm', md: 'md' }}>
              {t('manifesto.p2')}
            </Text>
            <Text size={{ base: 'xs', sm: 'sm', md: 'md' }}>
              {t('manifesto.p3')}
            </Text>
            <Text fontWeight={600} size={{ base: 'xs', sm: 'sm', md: 'md' }}>
              {t('manifesto.closing')}
            </Text>
          </VStack>
          <Button onClick={() => navigate(HOME_PATH)} variant="outline">
            {t('manifesto.enterWorld')}
          </Button>
        </VStack>
      </Box>
    </Box>
  );
};
