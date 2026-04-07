import {
  Box,
  HStack,
  Image,
  keyframes,
  Link,
  Text,
  VStack,
} from '@chakra-ui/react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import SafeTypist from '../components/SafeTypist';

const torchGlow = keyframes`
  0%, 100% {
    box-shadow: 0 0 8px rgba(200,122,42,0.3), inset 0 0 8px rgba(200,122,42,0.1);
  }
  50% {
    box-shadow: 0 0 16px rgba(200,122,42,0.5), inset 0 0 12px rgba(200,122,42,0.15);
  }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
`;

const dragonPulse = keyframes`
  0%, 100% { opacity: 0.03; }
  50% { opacity: 0.045; }
`;

export const LandingPage = (): JSX.Element => {
  const { t } = useTranslation('pages');

  return (
    <Box
      minH="100vh"
      px={{ base: 2, sm: 12, md: 20 }}
      py={{ base: 4, lg: 8 }}
    >
    {/* Logo — centered above the frame */}
    <Box
      display="flex"
      justifyContent="center"
      mb={{ base: 3, md: 4 }}
      animation={`${fadeIn} 1.5s ease-out`}
    >
      <Image
        alt="Ultimate Dominion"
        src="/images/ud-logo-dark-horizontal.svg"
        width={{ base: '260px', sm: '340px', md: '400px' }}
      />
    </Box>

    <Box
      border="6px solid #3A3228"
      display="flex"
      flexDirection="column"
      minH={{ base: 'calc(100vh - 100px)', lg: 'calc(100vh - 160px)' }}
      p={1.5}
      _after={{
        content: '""',
        position: 'fixed',
        inset: 0,
        opacity: 0.05,
        mixBlendMode: 'overlay',
        pointerEvents: 'none',
        zIndex: 1,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }}
    >
      <Helmet>
        <title>{t('landing.metaTitle')}</title>
      </Helmet>
      <Box
        border="0.5px solid #3A3228"
        flex="1"
        position="relative"
        _before={{
          content: '""',
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(10,8,6,0.6) 100%)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
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
        {/* Dragon watermark — subtle pulse like firelight */}
        <Box
          animation={`${dragonPulse} 6s ease-in-out infinite`}
          backgroundImage="url(/images/ud-dragon.svg)"
          backgroundPosition="center"
          backgroundRepeat="no-repeat"
          backgroundSize="contain"
          height="60%"
          left="50%"
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
          mt={{ base: 14, sm: 20 }}
          position="relative"
          px={{ base: 2, sm: 14, md: 18 }}
          spacing={{ base: 10, md: 14 }}
          zIndex={2}
        >
          <VStack spacing={{ base: 4, md: 5 }}>
            <Text
              color="#8A7E6A"
              fontFamily="'Cinzel', serif"
              fontSize={{ base: '13px', sm: '15px' }}
              fontStyle="italic"
              letterSpacing="0.3em"
              textAlign="center"
              textTransform="uppercase"
            >
              {t('intro.tagline')}
            </Text>
            {/* Ornamental divider */}
            <Box
              bg="linear-gradient(90deg, transparent 0%, rgba(200,122,42,0.15) 30%, rgba(212,165,74,0.4) 50%, rgba(200,122,42,0.15) 70%, transparent 100%)"
              h="1px"
              w={{ base: '100px', sm: '140px' }}
            />
          </VStack>

          <Box position="relative" w="100%">
            {/* Invisible spacer — reserves final text height */}
            <VStack
              fontWeight={500}
              maxW="850px"
              mx="auto"
              spacing={6}
              textAlign="center"
              visibility="hidden"
              aria-hidden="true"
            >
              <Text size={{ base: 'sm', sm: 'md', md: 'lg' }}>
                {t('intro.p1')}
              </Text>
              <Text size={{ base: 'sm', sm: 'md', md: 'lg' }} mt={10}>
                {t('intro.p2')}
              </Text>
              <Text size={{ base: 'sm', sm: 'md', md: 'lg' }} mt={10}>
                {t('intro.p3')}
              </Text>
              <Text size={{ base: 'sm', sm: 'md', md: 'lg' }} mt={10}>
                {t('intro.p4')}
              </Text>
            </VStack>
            {/* Typing animation overlaid at exact same position */}
            <Box position="absolute" top={0} left={0} right={0}>
              <VStack fontWeight={500} maxW="850px" mx="auto" spacing={6} textAlign="center">
                <SafeTypist
                  avgTypingDelay={35}
                  stdTypingDelay={20}
                  cursor={{ show: true, blink: true, element: '\u258C', hideWhenDone: true, hideWhenDoneDelay: 500 }}
                >
                  <Text size={{ base: 'sm', sm: 'md', md: 'lg' }}>
                    {t('intro.p1')}
                  </Text>
                  <SafeTypist.Delay ms={800} />
                  <Text size={{ base: 'sm', sm: 'md', md: 'lg' }} mt={10}>
                    {t('intro.p2')}
                  </Text>
                  <SafeTypist.Delay ms={600} />
                  <Text size={{ base: 'sm', sm: 'md', md: 'lg' }} mt={10}>
                    {t('intro.p3')}
                  </Text>
                  <SafeTypist.Delay ms={1000} />
                  <Text size={{ base: 'sm', sm: 'md', md: 'lg' }} mt={10}>
                    {t('intro.p4')}
                  </Text>
                </SafeTypist>
              </VStack>
            </Box>
          </Box>

          <Box
            as={RouterLink}
            to="/character-creation"
            animation={`${torchGlow} 3s ease-in-out infinite`}
            bg="rgba(200, 122, 42, 0.5)"
            border="1px solid rgba(200, 122, 42, 0.5)"
            color="#E8DCC8"
            cursor="pointer"
            display="inline-block"
            fontFamily="'Cinzel', serif"
            fontSize={{ base: '14px', sm: '16px' }}
            fontWeight={600}
            letterSpacing="0.3em"
            px={{ base: 10, sm: 12 }}
            py={3}
            textAlign="center"
            textDecoration="none"
            textTransform="uppercase"
            transition="all 0.3s"
            _hover={{ bg: 'rgba(200, 122, 42, 0.7)', color: '#E8DCC8', textDecoration: 'none' }}
          >
            {t('intro.enter')}
          </Box>

          <HStack
            fontFamily="'Cinzel', serif"
            fontSize={{ base: '13px', sm: '15px' }}
            spacing={3}
          >
            <Link
              as={RouterLink}
              color="#8A7E6A"
              to="/manifesto"
              _hover={{ color: '#D4A54A', textDecoration: 'none' }}
            >
              {t('landing.manifesto')}
            </Link>
            <Text color="#3A3228" userSelect="none">|</Text>
            <Link
              as={RouterLink}
              color="#8A7E6A"
              to="/guide"
              _hover={{ color: '#D4A54A', textDecoration: 'none' }}
            >
              {t('landing.guide')}
            </Link>
            <Text color="#3A3228" userSelect="none">|</Text>
            <Link
              color="#8A7E6A"
              href="https://tavern.ultimatedominion.com"
              isExternal
              _hover={{ color: '#D4A54A', textDecoration: 'none' }}
            >
              {t('landing.tavern')}
            </Link>
            <Text color="#3A3228" userSelect="none">|</Text>
            <Link
              color="#8A7E6A"
              href="https://x.com/DominionMMO"
              isExternal
              _hover={{ color: '#D4A54A', textDecoration: 'none' }}
            >
              X
            </Link>
            <Text color="#3A3228" userSelect="none">|</Text>
            <Link
              color="#8A7E6A"
              href="https://discord.gg/sSkQW36Fvj"
              isExternal
              _hover={{ color: '#D4A54A', textDecoration: 'none' }}
            >
              {t('landing.discord')}
            </Link>
          </HStack>
        </VStack>
      </Box>
    </Box>
    </Box>
  );
};
