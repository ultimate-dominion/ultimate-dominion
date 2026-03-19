import type { VercelRequest, VercelResponse } from '@vercel/node';

const GAME_URL = 'https://ultimatedominion.com';

const RARITY_NAMES: Record<string, string> = {
  '0': 'Worn', '1': 'Common', '2': 'Uncommon',
  '3': 'Rare', '4': 'Epic', '5': 'Legendary',
};

function getTitle(params: URLSearchParams): string {
  const type = params.get('type');
  switch (type) {
    case 'kill': {
      const player = params.get('player') || 'An adventurer';
      const monster = params.get('monster') || 'a monster';
      return `${player} slew ${monster}!`;
    }
    case 'pvp': {
      const winner = params.get('winner') || 'An adventurer';
      const loser = params.get('loser') || 'an opponent';
      return `${winner} defeated ${loser} in PvP!`;
    }
    case 'drop': {
      const player = params.get('player') || 'An adventurer';
      const item = params.get('item') || 'an item';
      const rarity = params.get('rarity') || '1';
      const rarityName = RARITY_NAMES[rarity] || '';
      return `${player} found ${rarityName ? `a ${rarityName} ` : ''}${item}!`;
    }
    case 'levelup': {
      const player = params.get('player') || 'An adventurer';
      const level = params.get('level') || '2';
      return `${player} reached Level ${level}!`;
    }
    case 'fragment': {
      const name = params.get('name') || 'a fragment';
      const num = params.get('num') || '1';
      return `Fragment ${num} Discovered: ${name}`;
    }
    case 'class': {
      const className = params.get('class') || 'an advanced class';
      return `Became a ${className}!`;
    }
    default:
      return 'Ultimate Dominion — Nothing Is Forgotten';
  }
}

function getDescription(params: URLSearchParams): string {
  const type = params.get('type');
  switch (type) {
    case 'kill':
      return 'Every kill is recorded. Every battle shapes the world. Play free at ultimatedominion.com.';
    case 'pvp':
      return 'PvP combat with real stakes. Gold seized, honor earned. Play free at ultimatedominion.com.';
    case 'drop':
      return 'Every item is permanent, on-chain, and tradeable. Play free at ultimatedominion.com.';
    case 'levelup':
      return 'The grind is real and the world is permanent. Play free at ultimatedominion.com.';
    case 'fragment':
      return 'The fallen speak in riddles. Discover their secrets. Play free at ultimatedominion.com.';
    case 'class':
      return 'Level 10 achieved. The path is chosen. Play free at ultimatedominion.com.';
    default:
      return 'A free multiplayer RPG where every battle, item, and scar is permanent. Play at ultimatedominion.com.';
  }
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/^elite\s+/i, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/** Pick the best OG image for this share type from existing game assets */
function getOgImage(params: URLSearchParams): string {
  const type = params.get('type');
  switch (type) {
    case 'kill': {
      const monster = params.get('monster') || '';
      return `${GAME_URL}/images/monsters/${slugify(monster)}.webp`;
    }
    case 'drop': {
      const item = params.get('item') || '';
      return `${GAME_URL}/images/items/${slugify(item)}.webp`;
    }
    case 'fragment': {
      const name = params.get('name') || '';
      return `${GAME_URL}/images/fragments/${slugify(name)}.webp`;
    }
    case 'class': {
      const className = params.get('class') || '';
      return `${GAME_URL}/images/classes/${slugify(className)}.webp`;
    }
    case 'levelup': {
      const level = params.get('level') || '2';
      return `${GAME_URL}/images/levelup/level-${level}.png`;
    }
    default:
      return `${GAME_URL}/og-image.png`;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  const url = new URL(req.url!, `https://${req.headers.host}`);
  const params = url.searchParams;

  const title = escapeHtml(getTitle(params));
  const description = escapeHtml(getDescription(params));
  const ogImage = escapeHtml(getOgImage(params));
  // Use summary card for square game assets, summary_large_image for level-up backgrounds
  const cardType = params.get('type') === 'levelup' ? 'summary_large_image' : 'summary';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title} — Ultimate Dominion</title>
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${GAME_URL}" />
  <meta property="og:image" content="${ogImage}" />
  <meta name="twitter:card" content="${cardType}" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${ogImage}" />
  <meta http-equiv="refresh" content="0;url=${GAME_URL}" />
</head>
<body>
  <p>Redirecting to <a href="${GAME_URL}">Ultimate Dominion</a>...</p>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  res.status(200).send(html);
}
