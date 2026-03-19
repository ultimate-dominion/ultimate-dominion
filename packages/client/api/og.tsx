import { ImageResponse } from '@vercel/og';
import type { VercelRequest } from '@vercel/node';

export const config = {
  runtime: 'edge',
};

const GAME_URL = 'https://ultimatedominion.com';

// Rarity colors matching the client
const RARITY_COLORS: Record<string, string> = {
  '0': '#8a8a8a',   // Worn
  '1': '#C4B89E',   // Common
  '2': '#3d8a4e',   // Uncommon
  '3': '#3d6fb5',   // Rare
  '4': '#7b4ab5',   // Epic
  '5': '#c47a2a',   // Legendary
};

const RARITY_NAMES: Record<string, string> = {
  '0': 'Worn', '1': 'Common', '2': 'Uncommon',
  '3': 'Rare', '4': 'Epic', '5': 'Legendary',
};

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Map monster display names to image filenames
function getMonsterImagePath(name: string): string {
  const clean = name.replace(/^Elite\s+/i, '');
  return `${GAME_URL}/images/monsters/${slugify(clean)}.webp`;
}

function getItemImagePath(name: string): string {
  return `${GAME_URL}/images/items/${slugify(name)}.webp`;
}

function getClassImagePath(name: string): string {
  return `${GAME_URL}/images/classes/${slugify(name)}.webp`;
}

function getFragmentImagePath(name: string): string {
  return `${GAME_URL}/images/fragments/${slugify(name)}.webp`;
}

function getLevelUpImagePath(level: string): string {
  return `${GAME_URL}/images/levelup/level-${level}.png`;
}

export default async function handler(req: VercelRequest) {
  const { searchParams } = new URL(req.url!, `https://${req.headers.host}`);
  const type = searchParams.get('type') || 'default';

  try {
    switch (type) {
      case 'kill':
        return renderKillCard(searchParams);
      case 'pvp':
        return renderPvpCard(searchParams);
      case 'drop':
        return renderDropCard(searchParams);
      case 'levelup':
        return renderLevelUpCard(searchParams);
      case 'fragment':
        return renderFragmentCard(searchParams);
      case 'class':
        return renderClassCard(searchParams);
      default:
        return renderDefaultCard();
    }
  } catch {
    return renderDefaultCard();
  }
}

function renderKillCard(params: URLSearchParams) {
  const monster = params.get('monster') || 'a monster';
  const player = params.get('player') || 'An adventurer';
  const imgSrc = getMonsterImagePath(monster);

  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', backgroundColor: '#0A0908', color: '#E8DCC8', fontFamily: 'serif', position: 'relative' }}>
        {/* Background image with overlay */}
        <img src={imgSrc} width="400" height="400" style={{ position: 'absolute', right: '40px', top: '115px', opacity: 0.7, objectFit: 'contain' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0A0908 40%, transparent 100%)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px', position: 'relative', flex: 1 }}>
          <div style={{ fontSize: '18px', color: '#6B8E6B', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '16px' }}>Monster Slain</div>
          <div style={{ fontSize: '52px', fontWeight: 700, lineHeight: 1.1, marginBottom: '24px', maxWidth: '600px' }}>{player} slew {monster}</div>
          <div style={{ fontSize: '20px', color: '#8A7E6A' }}>Ultimate Dominion — Nothing Is Forgotten</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

function renderPvpCard(params: URLSearchParams) {
  const winner = params.get('winner') || 'An adventurer';
  const loser = params.get('loser') || 'an opponent';

  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', backgroundColor: '#0A0908', color: '#E8DCC8', fontFamily: 'serif', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, #2A1510 0%, #0A0908 70%)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative', flex: 1, textAlign: 'center', padding: '60px' }}>
          <div style={{ fontSize: '18px', color: '#B85C3A', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '24px' }}>PvP Victory</div>
          <div style={{ fontSize: '56px', fontWeight: 700, lineHeight: 1.1, marginBottom: '16px' }}>{winner}</div>
          <div style={{ fontSize: '28px', color: '#8A7E6A', marginBottom: '16px' }}>defeated</div>
          <div style={{ fontSize: '44px', fontWeight: 700, color: '#8B4040', lineHeight: 1.1, marginBottom: '32px' }}>{loser}</div>
          <div style={{ fontSize: '20px', color: '#8A7E6A' }}>Ultimate Dominion — Nothing Is Forgotten</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

function renderDropCard(params: URLSearchParams) {
  const item = params.get('item') || 'an item';
  const rarity = params.get('rarity') || '1';
  const player = params.get('player') || 'An adventurer';
  const rarityColor = RARITY_COLORS[rarity] || '#C4B89E';
  const rarityName = RARITY_NAMES[rarity] || '';
  const imgSrc = getItemImagePath(item);

  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', backgroundColor: '#0A0908', color: '#E8DCC8', fontFamily: 'serif', position: 'relative' }}>
        <img src={imgSrc} width="350" height="350" style={{ position: 'absolute', right: '60px', top: '140px', opacity: 0.85, objectFit: 'contain' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0A0908 35%, transparent 100%)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px', position: 'relative', flex: 1 }}>
          <div style={{ fontSize: '18px', color: rarityColor, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '16px' }}>{rarityName} Item Found</div>
          <div style={{ fontSize: '52px', fontWeight: 700, color: rarityColor, lineHeight: 1.1, marginBottom: '16px', maxWidth: '600px' }}>{item}</div>
          <div style={{ fontSize: '24px', color: '#C4B89E', marginBottom: '32px' }}>found by {player}</div>
          <div style={{ fontSize: '20px', color: '#8A7E6A' }}>Ultimate Dominion — Nothing Is Forgotten</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

function renderLevelUpCard(params: URLSearchParams) {
  const level = params.get('level') || '2';
  const player = params.get('player') || 'An adventurer';
  const imgSrc = getLevelUpImagePath(level);

  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', backgroundColor: '#0A0908', color: '#E8DCC8', fontFamily: 'serif', position: 'relative' }}>
        <img src={imgSrc} width="1200" height="630" style={{ position: 'absolute', inset: 0, opacity: 0.3, objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #0A0908 10%, transparent 60%, #0A090880 100%)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative', flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '18px', color: '#D4A54A', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: '24px' }}>Level Up</div>
          <div style={{ fontSize: '96px', fontWeight: 700, color: '#D4A54A', lineHeight: 1, marginBottom: '16px' }}>{level}</div>
          <div style={{ fontSize: '32px', color: '#E8DCC8', marginBottom: '40px' }}>{player}</div>
          <div style={{ fontSize: '20px', color: '#8A7E6A' }}>Ultimate Dominion — Nothing Is Forgotten</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

function renderFragmentCard(params: URLSearchParams) {
  const name = params.get('name') || 'A Fragment';
  const num = params.get('num') || '1';
  const imgSrc = getFragmentImagePath(name);
  const color = '#A8DEFF';

  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', backgroundColor: '#0A0908', color: '#E8DCC8', fontFamily: 'serif', position: 'relative' }}>
        <img src={imgSrc} width="500" height="500" style={{ position: 'absolute', right: '20px', top: '65px', opacity: 0.6, objectFit: 'contain' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0A0908 30%, transparent 100%)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px', position: 'relative', flex: 1 }}>
          <div style={{ fontSize: '16px', color: `${color}`, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: '16px' }}>Fragment {num} of 8</div>
          <div style={{ fontSize: '52px', fontWeight: 700, color, lineHeight: 1.1, marginBottom: '24px', maxWidth: '550px' }}>{name}</div>
          <div style={{ fontSize: '22px', color: '#8A7E6A', fontStyle: 'italic' }}>The fallen speak in riddles.</div>
          <div style={{ fontSize: '20px', color: '#5A5347', marginTop: '32px' }}>Ultimate Dominion — Nothing Is Forgotten</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

function renderClassCard(params: URLSearchParams) {
  const className = params.get('class') || 'Warrior';
  const imgSrc = getClassImagePath(className);

  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', backgroundColor: '#0A0908', color: '#E8DCC8', fontFamily: 'serif', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 65% 50%, #1A1510 0%, #0A0908 65%)' }} />
        <img src={imgSrc} width="300" height="300" style={{ position: 'absolute', right: '80px', top: '165px', opacity: 0.9, objectFit: 'cover', borderRadius: '16px' }} />
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px', position: 'relative', flex: 1 }}>
          <div style={{ fontSize: '18px', color: '#D4A54A', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '16px' }}>Advanced Class Chosen</div>
          <div style={{ fontSize: '64px', fontWeight: 700, lineHeight: 1.1, marginBottom: '24px' }}>{className}</div>
          <div style={{ fontSize: '22px', color: '#8A7E6A' }}>Level 10 achieved. The path is set.</div>
          <div style={{ fontSize: '20px', color: '#5A5347', marginTop: '32px' }}>Ultimate Dominion — Nothing Is Forgotten</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

function renderDefaultCard() {
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', backgroundColor: '#0A0908', color: '#E8DCC8', fontFamily: 'serif', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
        <div style={{ fontSize: '64px', fontWeight: 700, marginBottom: '16px' }}>Ultimate Dominion</div>
        <div style={{ fontSize: '24px', color: '#8A7E6A' }}>Nothing Is Forgotten</div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
