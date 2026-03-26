import { Grid, GridItem, HStack, Link, Stack, VStack } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';

export const Footer = (): JSX.Element => {
  const { t } = useTranslation('ui');
  return (
    <HStack
      alignItems="center"
      as="footer"
      borderTop="1px solid #3A3228"
      px={20}
      py={4}
    >
      <Grid alignItems="center" templateColumns="repeat(4, 1fr)" w="100%">
        <GridItem colSpan={{ base: 3, sm: 2, md: 3 }}>
          <HStack spacing={{ base: 4, md: 10 }}>
            <Stack
              direction={{ base: 'column', md: 'row' }}
              spacing={{ base: 4, md: 10 }}
            >
              <Link
                alignSelf="start"
                borderColor="grey400"
                fontSize={{ base: 'xs', sm: 'sm' }}
                href="https://www.ultimatedominion.com/"
                isExternal
              >
                {t('footer.about')}
              </Link>
              <Link
                alignSelf="start"
                color="#8A7E6A"
                fontSize={{ base: 'xs', sm: 'sm' }}
                href="https://ultimatedominion.com/terms"
                isExternal
              >
                {t('footer.terms')}
              </Link>
              <Link
                alignSelf="start"
                color="#8A7E6A"
                fontSize={{ base: 'xs', sm: 'sm' }}
                href="https://ultimatedominion.com/privacy"
                isExternal
              >
                {t('footer.privacy')}
              </Link>
              <Link
                alignSelf="start"
                color="#8A7E6A"
                fontSize={{ base: 'xs', sm: 'sm' }}
                href="https://ultimatedominion.com/blog"
                isExternal
              >
                {t('footer.blog')}
              </Link>
            </Stack>
          </HStack>
        </GridItem>
        <GridItem colSpan={{ base: 1, sm: 2, md: 1 }} h="100%">
          <VStack
            alignItems="end"
            h="100%"
            justifyContent={{ base: 'start', md: 'center' }}
          >
            <Stack
              alignItems="center"
              direction={{ base: 'column', sm: 'row' }}
              spacing={{ base: 3, md: 8 }}
            >
            </Stack>
          </VStack>
        </GridItem>
      </Grid>
    </HStack>
  );
};
