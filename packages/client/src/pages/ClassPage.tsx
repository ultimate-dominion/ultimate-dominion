import {
  Box,
  Grid,
  Heading,
  HStack,
  Image,
  keyframes,
  Link,
  Text,
  VStack,
} from '@chakra-ui/react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, Navigate, useParams } from 'react-router-dom';

import { CLASS_DATA, getClassBySlug } from '../data/classData';
import { LocaleHead } from '../components/LocaleHead';
import { GUIDE_PATH } from '../Routes';

/* ────────────────────────── Animations ────────────────────────── */

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const glowPulse = (color: string) => keyframes`
  0%, 100% { box-shadow: 0 0 30px ${color}15, 0 0 60px ${color}08; }
  50%      { box-shadow: 0 0 50px ${color}25, 0 0 80px ${color}12; }
`;

/* ────────────────────────── Sub-components ────────────────────────── */

const StatRow = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <HStack justify="space-between" w="100%">
    <Text color="#8A7E6A" fontSize="14px">{label}</Text>
    <Text
      color={highlight ? '#C87A2A' : '#C4B89E'}
      fontFamily="monospace"
      fontSize="14px"
      fontWeight={highlight ? 700 : 500}
    >
      {value}
    </Text>
  </HStack>
);

const SectionLabel = ({ children }: { children: string }) => (
  <Text
    color="rgba(200,122,42,0.5)"
    fontFamily="'Cinzel', serif"
    fontSize="12px"
    fontWeight={400}
    letterSpacing="0.3em"
    textTransform="uppercase"
  >
    {children}
  </Text>
);

const ClassNav = ({ currentSlug }: { currentSlug: string }) => {
  const { t } = useTranslation('classes');
  return (
    <HStack
      flexWrap="wrap"
      justify="center"
      spacing={0}
      gap={2}
    >
      {CLASS_DATA.map(c => (
        <Link
          key={c.slug}
          as={RouterLink}
          to={`${GUIDE_PATH}/classes/${c.slug}`}
          color={c.slug === currentSlug ? '#E8DCC8' : '#8A7E6A'}
          bg={c.slug === currentSlug ? 'rgba(200,122,42,0.12)' : 'transparent'}
          border="1px solid"
          borderColor={c.slug === currentSlug ? 'rgba(200,122,42,0.3)' : 'rgba(58,50,40,0.3)'}
          borderRadius="sm"
          fontSize="13px"
          fontWeight={c.slug === currentSlug ? 600 : 400}
          px={3}
          py={1}
          _hover={{ color: '#E8DCC8', borderColor: 'rgba(200,122,42,0.4)', textDecoration: 'none' }}
          transition="all 0.2s"
        >
          {t(`${c.slug}.name`)}
        </Link>
      ))}
    </HStack>
  );
};

/* ────────────────────────── Page ────────────────────────── */

export const ClassPage = (): JSX.Element => {
  const { t } = useTranslation('pages');
  const { t: tc } = useTranslation('classes');
  const { className } = useParams<{ className: string }>();
  const classData = className ? getClassBySlug(className) : undefined;

  if (!classData) {
    return <Navigate to={GUIDE_PATH} replace />;
  }

  const { color } = classData;

  return (
    <Box
      bg="#12100E"
      minH="100vh"
      position="relative"
      _after={{
        content: '""',
        position: 'fixed',
        inset: 0,
        opacity: 0.04,
        mixBlendMode: 'overlay',
        pointerEvents: 'none',
        zIndex: 1,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }}
    >
      <Helmet>
        <title>{t('classPage.metaTitle', { name: tc(`${classData.slug}.name`) })}</title>
        <meta name="description" content={t('classPage.metaDescription', { name: tc(`${classData.slug}.name`), ns: 'pages' })} />
        <meta property="og:title" content={t('classPage.ogTitle', { name: tc(`${classData.slug}.name`), ns: 'pages' })} />
        <meta property="og:description" content={t('classPage.ogDescription', { name: tc(`${classData.slug}.name`), ns: 'pages' })} />
      </Helmet>
      <LocaleHead path={`/guide/classes/${classData.slug}`} />

      {/* Class-colored radial glow */}
      <Box
        animation={`${glowPulse(color)} 5s ease-in-out infinite`}
        bg={`radial-gradient(ellipse at center top, ${color}08 0%, transparent 50%)`}
        height="100%"
        left={0}
        pointerEvents="none"
        position="fixed"
        top={0}
        width="100%"
        zIndex={0}
      />

      <VStack
        animation={`${fadeUp} 0.6s ease-out`}
        maxW="860px"
        mx="auto"
        pb={{ base: 20, md: 28 }}
        position="relative"
        pt={{ base: 10, md: 16 }}
        px={{ base: 5, sm: 8, md: 10 }}
        spacing={0}
        zIndex={2}
      >
        {/* ── Back link ── */}
        <HStack justify="flex-start" w="100%" mb={6}>
          <Link
            as={RouterLink}
            color="#8A7E6A"
            fontSize="14px"
            to={GUIDE_PATH}
            _hover={{ color: '#C87A2A', textDecoration: 'none' }}
          >
            &larr; {t('classPage.backToCodex')}
          </Link>
        </HStack>

        {/* ── Class navigation ── */}
        <Box mb={{ base: 8, md: 10 }} w="100%">
          <ClassNav currentSlug={classData.slug} />
        </Box>

        {/* ── Hero: Image + Title ── */}
        <VStack spacing={5} mb={{ base: 8, md: 12 }}>
          {classData.image && (
            <Box
              borderRadius="lg"
              boxShadow={`0 0 40px ${color}30, 0 0 80px ${color}15`}
              overflow="hidden"
              border="1px solid"
              borderColor={`${color}40`}
            >
              <Image
                src={classData.image}
                alt={tc(`${classData.slug}.name`)}
                maxH={{ base: '200px', md: '280px' }}
                objectFit="cover"
              />
            </Box>
          )}

          <Text
            color="rgba(200,122,42,0.5)"
            fontFamily="'Cinzel', serif"
            fontSize={{ base: '11px', sm: '12px' }}
            fontWeight={400}
            letterSpacing="0.4em"
            textTransform="uppercase"
          >
            {t('classPage.archetypeClass', { archetype: tc(`${classData.slug}.archetype`) })}
          </Text>

          <Heading
            color="#E8DCC8"
            fontFamily="'Cinzel', serif"
            fontSize={{ base: '32px', sm: '40px', md: '48px' }}
            fontWeight={500}
            letterSpacing="0.06em"
            textAlign="center"
          >
            {tc(`${classData.slug}.name`)}
          </Heading>

          <Text
            color="rgba(196,184,158,0.6)"
            fontSize={{ base: '16px', sm: '17px' }}
            fontStyle="italic"
            lineHeight="1.9"
            maxW="600px"
            textAlign="center"
          >
            {tc(`${classData.slug}.description`)}
          </Text>
        </VStack>

        {/* ── Separator ── */}
        <Box bg={`${color}20`} h="1px" mb={{ base: 8, md: 10 }} w="100%" />

        {/* ── Lore ── */}
        <VStack align="flex-start" mb={{ base: 8, md: 10 }} spacing={3} w="100%">
          <SectionLabel>{t('classPage.sectionLore')}</SectionLabel>
          <Text
            color="#C4B89E"
            fontSize={{ base: '15px', sm: '16px' }}
            fontStyle="italic"
            lineHeight="2"
          >
            &ldquo;{tc(`${classData.slug}.lore`)}&rdquo;
          </Text>
        </VStack>

        {/* ── Stats + Spell side-by-side ── */}
        <Grid
          gap={{ base: 4, md: 6 }}
          mb={{ base: 8, md: 10 }}
          templateColumns={{ base: '1fr', md: '1fr 1fr' }}
          w="100%"
        >
          {/* Bonuses & Multipliers */}
          <Box
            bg="#1C1814"
            border="1px solid"
            borderColor="rgba(58,50,40,0.5)"
            p={{ base: 5, sm: 6 }}
          >
            <VStack align="flex-start" spacing={4}>
              <SectionLabel>{t('classPage.sectionBonuses')}</SectionLabel>
              <Box bg="rgba(58,50,40,0.4)" h="1px" w="100%" />
              <VStack align="stretch" spacing={2} w="100%">
                <HStack justify="space-between" w="100%">
                  <Text color="#8A7E6A" fontSize="14px">{t('classPage.flatBonuses')}</Text>
                  <Text color="#4A8B4A" fontFamily="monospace" fontSize="14px" fontWeight={700}>
                    {tc(`${classData.slug}.flatBonuses`)}
                  </Text>
                </HStack>
                <Box bg="rgba(58,50,40,0.3)" h="1px" w="100%" />
                <StatRow label={t('classPage.physicalDmg')} value={classData.multipliers.phys} highlight={classData.multipliers.phys !== '100%'} />
                <StatRow label={t('classPage.spellDmg')} value={classData.multipliers.spell} highlight={classData.multipliers.spell !== '100%'} />
                <StatRow label={t('classPage.healing')} value={classData.multipliers.heal} highlight={classData.multipliers.heal !== '100%'} />
                <StatRow label={t('classPage.critDmg')} value={classData.multipliers.crit} highlight={classData.multipliers.crit !== '100%'} />
                <StatRow label={t('classPage.maxHp')} value={classData.multipliers.maxHp} highlight={classData.multipliers.maxHp !== '100%'} />
              </VStack>
            </VStack>
          </Box>

          {/* Class Spell */}
          <Box
            bg="#1C1814"
            border="1px solid"
            borderColor={`${color}30`}
            p={{ base: 5, sm: 6 }}
          >
            <VStack align="flex-start" spacing={4}>
              <SectionLabel>{t('classPage.sectionAbility')}</SectionLabel>
              <Box bg="rgba(58,50,40,0.4)" h="1px" w="100%" />
              <VStack align="flex-start" spacing={2}>
                <Text
                  color={color}
                  fontFamily="'Cinzel', serif"
                  fontSize={{ base: '18px', sm: '20px' }}
                  fontWeight={600}
                >
                  {tc(`${classData.slug}.spellName`)}
                </Text>
                <Text color="#C4B89E" fontSize="15px" lineHeight="1.7">
                  {tc(`${classData.slug}.spellDesc`)}
                </Text>
              </VStack>
              <Box bg="rgba(58,50,40,0.3)" h="1px" w="100%" />
              <Text color="#8A7E6A" fontSize="13px" fontStyle="italic" lineHeight="1.7">
                {t('classPage.abilityNote')}
              </Text>
            </VStack>
          </Box>
        </Grid>

        {/* ── Playstyle ── */}
        <VStack align="flex-start" mb={{ base: 8, md: 10 }} spacing={3} w="100%">
          <SectionLabel>{t('classPage.sectionPlaystyle')}</SectionLabel>
          <Text color="#C4B89E" fontSize={{ base: '15px', sm: '16px' }} lineHeight="2">
            {tc(`${classData.slug}.playstyle`)}
          </Text>
        </VStack>

        {/* ── Strengths / Weaknesses ── */}
        <Grid
          gap={{ base: 4, md: 6 }}
          mb={{ base: 8, md: 10 }}
          templateColumns={{ base: '1fr', sm: '1fr 1fr' }}
          w="100%"
        >
          <Box
            bg="rgba(20,18,15,0.6)"
            border="1px solid rgba(74,139,74,0.2)"
            p={{ base: 5, sm: 6 }}
          >
            <VStack align="flex-start" spacing={3}>
              <Text
                color="#4A8B4A"
                fontFamily="'Cinzel', serif"
                fontSize="12px"
                fontWeight={400}
                letterSpacing="0.2em"
                textTransform="uppercase"
              >
                {t('classPage.sectionStrengths')}
              </Text>
              {(tc(`${classData.slug}.strengths`, { returnObjects: true }) as string[]).map((s, i) => (
                <HStack key={i} align="flex-start" spacing={3}>
                  <Text color="#4A8B4A" fontSize="12px" mt="2px">+</Text>
                  <Text color="#C4B89E" fontSize="14px" lineHeight="1.6">{s}</Text>
                </HStack>
              ))}
            </VStack>
          </Box>
          <Box
            bg="rgba(20,18,15,0.6)"
            border="1px solid rgba(139,64,64,0.2)"
            p={{ base: 5, sm: 6 }}
          >
            <VStack align="flex-start" spacing={3}>
              <Text
                color="#8B4040"
                fontFamily="'Cinzel', serif"
                fontSize="12px"
                fontWeight={400}
                letterSpacing="0.2em"
                textTransform="uppercase"
              >
                {t('classPage.sectionWeaknesses')}
              </Text>
              {(tc(`${classData.slug}.weaknesses`, { returnObjects: true }) as string[]).map((w, i) => (
                <HStack key={i} align="flex-start" spacing={3}>
                  <Text color="#8B4040" fontSize="12px" mt="2px">-</Text>
                  <Text color="#C4B89E" fontSize="14px" lineHeight="1.6">{w}</Text>
                </HStack>
              ))}
            </VStack>
          </Box>
        </Grid>

        {/* ── Multiplier formula ── */}
        <Box
          bg="rgba(200,122,42,0.04)"
          border="1px solid rgba(200,122,42,0.08)"
          mb={{ base: 8, md: 10 }}
          p={{ base: 5, sm: 6 }}
          w="100%"
        >
          <VStack spacing={3}>
            <SectionLabel>{t('classPage.sectionMultipliers')}</SectionLabel>
            <Text
              color="#C4B89E"
              fontFamily="monospace"
              fontSize={{ base: '13px', sm: '14px' }}
              textAlign="center"
            >
              {t('classPage.multiplierFormula')}
            </Text>
            <Text color="#8A7E6A" fontSize="14px" lineHeight="1.7" textAlign="center" maxW="500px">
              {t('classPage.multiplierDesc')}
            </Text>
          </VStack>
        </Box>

        {/* ── Footer nav ── */}
        <HStack spacing={4}>
          <Box bg="rgba(200,122,42,0.15)" h="1px" w="30px" />
          <Link
            as={RouterLink}
            color="#8A7E6A"
            fontFamily="'Cinzel', serif"
            fontSize="14px"
            letterSpacing="0.15em"
            textTransform="uppercase"
            to={GUIDE_PATH}
            _hover={{ color: '#C87A2A', textDecoration: 'none' }}
          >
            &larr; {t('classPage.backToCodex')}
          </Link>
          <Box bg="rgba(200,122,42,0.15)" h="1px" w="30px" />
        </HStack>
      </VStack>
    </Box>
  );
};
