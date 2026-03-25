// Vercel serverless proxy for Dune API — keeps API key server-side
const DUNE_API_KEY = process.env.DUNE_API_KEY;

const QUERY_IDS = {
  'player-growth': 6898724,
  'gold-price': 6898725,
  'dau': 6898726,
  'gold-supply': 6898727,
  'level-distribution': 6898728,
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q } = req.query;

  if (!DUNE_API_KEY) {
    return res.status(500).json({ error: 'DUNE_API_KEY not configured' });
  }

  // Fetch all queries if no specific one requested
  const queries = q ? [q] : Object.keys(QUERY_IDS);
  const results = {};

  await Promise.all(
    queries.map(async (key) => {
      const queryId = QUERY_IDS[key];
      if (!queryId) {
        results[key] = { error: `Unknown query: ${key}` };
        return;
      }
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

  return res.status(200).json(results);
}
