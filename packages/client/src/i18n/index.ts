import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import enUI from './locales/en/ui.json';
import enItems from './locales/en/items.json';
import enClasses from './locales/en/classes.json';
import enMonsters from './locales/en/monsters.json';
import enEffects from './locales/en/effects.json';
import enNarrative from './locales/en/narrative.json';
import enPages from './locales/en/pages.json';

import koUI from './locales/ko/ui.json';
import koItems from './locales/ko/items.json';
import koClasses from './locales/ko/classes.json';
import koMonsters from './locales/ko/monsters.json';
import koEffects from './locales/ko/effects.json';
import koNarrative from './locales/ko/narrative.json';
import koPages from './locales/ko/pages.json';

import jaUI from './locales/ja/ui.json';
import jaItems from './locales/ja/items.json';
import jaClasses from './locales/ja/classes.json';
import jaMonsters from './locales/ja/monsters.json';
import jaEffects from './locales/ja/effects.json';
import jaNarrative from './locales/ja/narrative.json';
import jaPages from './locales/ja/pages.json';

import zhUI from './locales/zh/ui.json';
import zhItems from './locales/zh/items.json';
import zhClasses from './locales/zh/classes.json';
import zhMonsters from './locales/zh/monsters.json';
import zhEffects from './locales/zh/effects.json';
import zhNarrative from './locales/zh/narrative.json';
import zhPages from './locales/zh/pages.json';

export const SUPPORTED_LANGUAGES = {
  en: 'English',
  ko: '한국어',
  ja: '日本語',
  zh: '中文',
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;


/** Maps i18n language codes to HTML lang attribute values. */
export const HTML_LANG_MAP: Record<string, string> = {
  en: 'en',
  ko: 'ko',
  ja: 'ja',
  zh: 'zh-Hans',
};

function setHtmlLang(lng: string) {
  document.documentElement.lang = HTML_LANG_MAP[lng] || lng;
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { ui: enUI, items: enItems, classes: enClasses, monsters: enMonsters, effects: enEffects, narrative: enNarrative, pages: enPages },
      ko: { ui: koUI, items: koItems, classes: koClasses, monsters: koMonsters, effects: koEffects, narrative: koNarrative, pages: koPages },
      ja: { ui: jaUI, items: jaItems, classes: jaClasses, monsters: jaMonsters, effects: jaEffects, narrative: jaNarrative, pages: jaPages },
      zh: { ui: zhUI, items: zhItems, classes: zhClasses, monsters: zhMonsters, effects: zhEffects, narrative: zhNarrative, pages: zhPages },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'ko', 'ja', 'zh'],
    defaultNS: 'ui',
    ns: ['ui', 'items', 'classes', 'monsters', 'effects', 'narrative', 'pages'],
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ['querystring', 'localStorage', 'navigator'],
      lookupQuerystring: 'lang',
      lookupLocalStorage: 'ud-language',
      caches: ['localStorage'],
    },
  });

// Set <html lang> on init and on every language change
setHtmlLang(i18n.language);
i18n.on('languageChanged', setHtmlLang);

export default i18n;
