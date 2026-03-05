import express from 'express';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;
const NEWS_API_BASE  = 'https://newsapi.org/v2/everything';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL   = 'gpt-4o';

app.use(express.json({ limit: '2mb' }));

// Serve frontend static files
app.use(express.static(join(__dirname, 'public')));

// ─── NewsAPI proxy ────────────────────────────────────────────────────────────
app.get('/news', async (req, res) => {
  const apiKey = process.env.NEWS_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'NEWS_API_KEY is not configured on the server.' });
  }

  const { q, from, pageSize = 10, language = 'en', sortBy = 'publishedAt' } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required.' });
  }

  const params = new URLSearchParams({ q, language, sortBy, pageSize });
  if (from) params.set('from', from);

  try {
    const upstream = await fetch(`${NEWS_API_BASE}?${params}`, {
      headers: { 'X-Api-Key': apiKey },
    });
    const data = await upstream.json();
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: data.message || 'NewsAPI error' });
    }
    res.json(data);
  } catch (err) {
    console.error('NewsAPI proxy error:', err.message);
    res.status(502).json({ error: 'Failed to reach NewsAPI: ' + err.message });
  }
});

// ─── OpenAI proxy ─────────────────────────────────────────────────────────────
app.post('/ai', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server.' });
  }

  const { messages, response_format } = req.body;

  if (!messages) {
    return res.status(400).json({ error: 'Request body must include "messages".' });
  }

  try {
    const upstream = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: OPENAI_MODEL, messages, response_format }),
    });

    if (upstream.status === 401) return res.status(401).json({ error: 'OPENAI_401' });
    if (upstream.status === 429) return res.status(429).json({ error: 'OPENAI_429' });

    const data = await upstream.json();
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: data.error?.message || 'OpenAI error' });
    }
    res.json(data);
  } catch (err) {
    console.error('OpenAI proxy error:', err.message);
    res.status(502).json({ error: 'Failed to reach OpenAI: ' + err.message });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', port: PORT }));

// Fallback: serve index.html for any unmatched GET (SPA support)
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[SIE] Running on http://localhost:${PORT}`);
  console.log(`[SIE] OPENAI_API_KEY : ${process.env.OPENAI_API_KEY  ? 'set' : 'NOT SET'}`);
  console.log(`[SIE] NEWS_API_KEY   : ${process.env.NEWS_API_KEY    ? 'set' : 'NOT SET'}`);
});
