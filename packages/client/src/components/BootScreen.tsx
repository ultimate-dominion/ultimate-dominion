/**
 * Full-page dark boot screen used for both the initial React.lazy Suspense
 * fallback (see index.tsx) and the in-app game-ready gate (see App.tsx).
 *
 * Keeping a single component means the transition from "React is loading the
 * AppRoot chunk" → "AppRoot mounted but MUD setup / wallet / sync still
 * pending" is visually seamless — no flash to the orange app shell with a
 * footer "Loading..." text while game data hydrates.
 */

export const BootScreen = ({
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
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
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

export default BootScreen;
