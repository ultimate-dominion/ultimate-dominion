import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Heading,
  Link,
  Text,
  VStack,
} from '@chakra-ui/react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { HOME_PATH } from '../Routes';

const FAQ_COUNT = 10;

export const FAQ = (): JSX.Element => {
  const navigate = useNavigate();
  const { t } = useTranslation('pages');

  const faqs = Array.from({ length: FAQ_COUNT }, (_, i) => ({
    q: t(`faq.q${i + 1}`),
    a: t(`faq.a${i + 1}`),
  }));

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.a,
      },
    })),
  };

  return (
    <Box border="6px solid #3A3228" p={1.5}>
      <Helmet>
        <title>{t('faq.metaTitle')}</title>
        <meta
          name="description"
          content={t('faq.metaDescription')}
        />
        <link rel="canonical" href="https://ultimatedominion.com/faq" />
        <meta property="og:title" content={t('faq.ogTitle')} />
        <meta
          property="og:description"
          content={t('faq.ogDescription')}
        />
        <meta property="og:url" content="https://ultimatedominion.com/faq" />
        <script type="application/ld+json">
          {JSON.stringify(faqJsonLd)}
        </script>
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
            {t('faq.title')}
          </Heading>

          <Text
            color="#8A7E6A"
            maxW="650px"
            textAlign="center"
          >
            {t('faq.subtitle')}
          </Text>

          <VStack maxW="750px" spacing={0} w="100%">
            <Accordion allowMultiple w="100%">
              {faqs.map((faq, i) => (
                <AccordionItem
                  key={i}
                  border="none"
                  borderBottom="1px solid"
                  borderColor="#3A3228"
                >
                  <AccordionButton
                    px={0}
                    py={5}
                    _hover={{ bg: 'transparent' }}
                  >
                    <Text
                      flex="1"
                      fontWeight={600}
                      textAlign="left"
                    >
                      {faq.q}
                    </Text>
                    <AccordionIcon color="#8A7E6A" />
                  </AccordionButton>
                  <AccordionPanel pb={5} px={0}>
                    <Text color="#C4B89A" lineHeight="1.8">
                      {faq.a}
                    </Text>
                  </AccordionPanel>
                </AccordionItem>
              ))}
            </Accordion>
          </VStack>

          <VStack spacing={3} mt={4}>
            <Link
              href="https://ultimatedominion.com"
              color="#C87A2A"
              fontSize="sm"
              _hover={{ textDecoration: 'underline' }}
            >
              {t('faq.startPlaying')}
            </Link>
            <Text
              color="#C87A2A"
              cursor="pointer"
              fontSize="sm"
              onClick={() => navigate(HOME_PATH)}
              _hover={{ textDecoration: 'underline' }}
            >
              {t('faq.backToGame')}
            </Text>
          </VStack>
        </VStack>
      </Box>
    </Box>
  );
};
