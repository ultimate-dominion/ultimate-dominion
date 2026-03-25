// Local dev server — proxies Dune API calls for testing the dashboard
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DUNE_API_KEY = process.env.DUNE_API_KEY;
const PORT = 3002;

const QUERY_IDS = {
  'player-growth': 6898724,
  'gold-price': 6898725,
  'dau': 6898726,
  'gold-supply': 6898727,
  'level-distribution': 6898728,
};

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
};

const server = http.createServer(async (req, res) => {
  // API proxy
  if (req.url.startsWith('/api/data')) {
    if (!DUNE_API_KEY) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Set DUNE_API_KEY env var' }));
    }

    const results = {};
    await Promise.all(
      Object.entries(QUERY_IDS).map(async ([key, queryId]) => {
        try {
          const resp = await fetch(
            `https://api.dune.com/api/v1/query/${queryId}/results?limit=1000`,
            { headers: { 'X-Dune-Api-Key': DUNE_API_KEY } }
          );
          const data = await resp.json();
          results[key] = {
            rows: data.result?.rows || [],
            metadata: data.result?.metadata || {},
            state: data.state,
          };
        } catch (err) {
          results[key] = { error: err.message };
        }
      })
    );

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    return res.end(JSON.stringify(results));
  }

  // Static files
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, 'public', filePath);
  const ext = path.extname(filePath);

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Dashboard dev server: http://localhost:${PORT}`);
  console.log(`DUNE_API_KEY: ${DUNE_API_KEY ? 'set' : 'MISSING — set DUNE_API_KEY env var'}`);
});
