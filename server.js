import express from 'express';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;
const NEWS_API_BASE = 'https://newsapi.org/v2/everything';

// Serve frontend static files
app.use(express.static(join(__dirname, 'public')));

// CORS headers (kept for local dev / cross-origin API clients)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-news-api-key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/news', async (req, res) => {
  // API key: env var takes priority, else client-provided header
  const apiKey = process.env.NEWS_API_KEY || req.headers['x-news-api-key'];

  if (!apiKey) {
    return res.status(400).json({
      error: 'No NewsAPI key. Set NEWS_API_KEY env var or pass x-news-api-key header.'
    });
  }

  const { q, from, pageSize = 10, language = 'en', sortBy = 'publishedAt' } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required.' });
  }

  const params = new URLSearchParams({ q, language, sortBy, pageSize });
  if (from) params.set('from', from);

  const url = `${NEWS_API_BASE}?${params}`;

  try {
    const upstream = await fetch(url, {
      headers: { 'X-Api-Key': apiKey }
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: data.message || 'NewsAPI error' });
    }

    res.json(data);
  } catch (err) {
    console.error('Proxy fetch error:', err.message);
    res.status(502).json({ error: 'Failed to reach NewsAPI: ' + err.message });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', port: PORT }));

// Fallback: serve index.html for any unmatched route (SPA support)
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[SIE] Running on http://localhost:${PORT}`);
  console.log(`[SIE] NEWS_API_KEY env: ${process.env.NEWS_API_KEY ? 'set' : 'not set (client must send header)'}`);
});
