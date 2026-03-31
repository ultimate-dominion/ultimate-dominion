import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../i18n';

const CANONICAL_DOMAIN = 'https://ultimatedominion.com';

const HREFLANG_MAP: Record<string, string> = {
  en: 'en',
  ko: 'ko',
  ja: 'ja',
  zh: 'zh-Hans',
};

const OG_LOCALE_MAP: Record<string, string> = {
  en: 'en_US',
  ko: 'ko_KR',
  ja: 'ja_JP',
  zh: 'zh_CN',
};

/**
 * Renders hreflang <link> tags and og:locale meta tags for all supported locales.
 * Add to every public (crawlable) page.
 */
export const LocaleHead = ({ path }: { path: string }): JSX.Element => {
  const { i18n } = useTranslation();
  const currentLang = i18n.language?.substring(0, 2) || 'en';
  const currentOgLocale = OG_LOCALE_MAP[currentLang] || 'en_US';

  const langs = Object.keys(SUPPORTED_LANGUAGES) as string[];

  return (
    <Helmet>
      {langs.map(lang => (
        <link
          key={lang}
          rel="alternate"
          hrefLang={HREFLANG_MAP[lang] || lang}
          href={`${CANONICAL_DOMAIN}${path}?lang=${lang}`}
        />
      ))}
      <link rel="alternate" hrefLang="x-default" href={`${CANONICAL_DOMAIN}${path}`} />
      <meta property="og:locale" content={currentOgLocale} />
      {langs
        .filter(lang => lang !== currentLang)
        .map(lang => (
          <meta key={lang} property="og:locale:alternate" content={OG_LOCALE_MAP[lang] || lang} />
        ))}
    </Helmet>
  );
};
