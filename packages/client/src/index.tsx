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

const BootScreen = ({
  body,
  eyebrow,
}: {
  body: string;
  eyebrow: string;
}): JSX.Element => (
  <div
    style={{
      alignItems: 'center',
      background:
        'radial-gradient(circle at top, rgba(122, 76, 28, 0.18), transparent 45%), #12100E',
      color: '#E8DCC8',
      display: 'flex',
      fontFamily: '"Cormorant Garamond", Georgia, serif',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '2rem',
    }}
  >
    <div
      style={{
        maxWidth: '28rem',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontFamily: '"Inter", system-ui, sans-serif',
          fontSize: '0.75rem',
          fontWeight: 600,
          letterSpacing: '0.32em',
          marginBottom: '1rem',
          opacity: 0.7,
          textTransform: 'uppercase',
        }}
      >
        {eyebrow}
      </div>
      <div
        style={{
          fontFamily: '"Cinzel", Georgia, serif',
          fontSize: 'clamp(2rem, 5vw, 3.5rem)',
          letterSpacing: '0.08em',
          marginBottom: '1rem',
          textTransform: 'uppercase',
        }}
      >
        Ultimate Dominion
      </div>
      <div
        style={{
          fontSize: '1.15rem',
          lineHeight: 1.6,
          opacity: 0.82,
        }}
      >
        {body}
      </div>
    </div>
  </div>
);

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
