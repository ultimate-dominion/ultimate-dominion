// Polyfill Node.js globals for browser — required by Privy embedded wallet SDK
import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;
(globalThis as any).global = globalThis;

// CJK fonts loaded conditionally per locale (saves ~10MB for non-CJK users)
import i18n from './i18n';

function loadCjkFont(lang: string) {
  const code = lang?.substring(0, 2);
  if (code === 'ko') {
    import('@fontsource/noto-sans-kr/400.css');
    import('@fontsource/noto-sans-kr/500.css');
    import('@fontsource/noto-sans-kr/700.css');
  } else if (code === 'ja') {
    import('@fontsource/noto-sans-jp/400.css');
    import('@fontsource/noto-sans-jp/500.css');
    import('@fontsource/noto-sans-jp/700.css');
  } else if (code === 'zh') {
    import('@fontsource/noto-sans-sc/400.css');
    import('@fontsource/noto-sans-sc/500.css');
    import('@fontsource/noto-sans-sc/700.css');
  }
}

loadCjkFont(i18n.language);
i18n.on('languageChanged', loadCjkFont);

import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BootScreen } from './components/BootScreen';
import { initErrorReporter } from './utils/errorReporter';
import { initMetrics } from './utils/metricsReporter';

// Initialize error reporting and metrics before anything else
initErrorReporter();
initMetrics();

const rootElement = document.getElementById('react-root');
if (!rootElement) throw new Error('React root not found');
const root = createRoot(rootElement);

const isGameLive = import.meta.env.VITE_GAME_LIVE === 'true';
const appModulePromise = isGameLive
  ? import('./GameAppRoot')
  : import('./PlaceholderAppRoot');
const AppRoot = React.lazy(() => appModulePromise);

root.render(
  <Suspense
    fallback={(
      <BootScreen
        body={isGameLive ? 'Rebuilding the world state...' : 'Preparing the landing page...'}
        eyebrow={isGameLive ? 'Entering The Realm' : 'Opening The Gates'}
      />
    )}
  >
    <AppRoot />
  </Suspense>,
);
