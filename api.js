/**
 * api.js — Strategic Insight Engine
 * NewsAPI proxy calls + OpenAI API calls
 */

// ─── Lens → search query keywords ───────────────────────────────────────────
const LENS_KEYWORDS = {
  Political:     'regulation OR government OR policy OR politics OR legislation OR geopolitical',
  Economic:      'economy OR inflation OR interest rate OR GDP OR recession OR market OR investment',
  Social:        'consumer OR demographic OR culture OR labor OR workforce OR public opinion OR society',
  Technological: 'technology OR innovation OR AI OR patent OR R&D OR digital OR automation OR software',
  Environmental: 'climate OR sustainability OR carbon OR ESG OR environment OR emissions OR energy',
  Legal:         'lawsuit OR litigation OR compliance OR regulatory OR court OR antitrust OR legal',
};

/**
 * Build a NewsAPI query string for a company + PESTEL lens + optional location.
 * @param {string} company
 * @param {string} lens
 * @param {string} [location]  — 'Global', region name, or country name
 * @returns {string}
 */
export function buildNewsQuery(company, lens, location) {
  const keywords = LENS_KEYWORDS[lens] || lens.toLowerCase();
  const base = `"${company}" AND (${keywords})`;
  if (!location || location === 'Global') return base;
  return `${base} AND "${location}"`;
}

/**
 * Calculate the ISO date string N days ago.
 * @param {number} days
 * @returns {string}
 */
function daysAgoISO(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

/**
 * Fetch news articles for a single lens via the local proxy.
 * @param {object} opts
 * @param {string} opts.company
 * @param {string} opts.lens
 * @param {string} opts.proxyUrl
 * @param {string} opts.newsApiKey
 * @param {number} opts.pageSize
 * @param {number} opts.timeWindowDays
 * @param {string} [opts.location]
 * @returns {Promise<Array<{headline, source, date, url, lens}>>}
 */
export async function fetchLensSignals({ company, lens, proxyUrl, newsApiKey, pageSize, timeWindowDays, location }) {
  const q = buildNewsQuery(company, lens, location);
  const from = daysAgoISO(timeWindowDays);

  const params = new URLSearchParams({ q, from, pageSize, language: 'en', sortBy: 'relevancy' });
  const url = `${proxyUrl}/news?${params}`;

  const resp = await fetch(url, {
    headers: { 'x-news-api-key': newsApiKey },
  });

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.error || `NewsAPI proxy returned ${resp.status}`);
  }

  const data = await resp.json();
  const articles = (data.articles || []).slice(0, pageSize);

  return articles.map(a => ({
    lens,
    headline: a.title || '(no title)',
    source:   a.source?.name || 'Unknown',
    date:     a.publishedAt ? a.publishedAt.slice(0, 10) : '',
    url:      a.url || '#',
  }));
}

/**
 * Fetch signals for all selected lenses in parallel.
 * @param {object} opts
 * @param {string} [opts.location]
 * @returns {Promise<Record<string, Array>>}  { Political: [...], Economic: [...] }
 */
export async function fetchNewsSignals({ company, lenses, proxyUrl, newsApiKey, pageSize, timeWindowDays, location }) {
  const results = await Promise.allSettled(
    lenses.map(lens =>
      fetchLensSignals({ company, lens, proxyUrl, newsApiKey, pageSize, timeWindowDays, location })
    )
  );

  const signalMap = {};
  results.forEach((result, i) => {
    const lens = lenses[i];
    if (result.status === 'fulfilled') {
      signalMap[lens] = result.value;
    } else {
      console.warn(`Failed to fetch signals for lens "${lens}":`, result.reason?.message);
      signalMap[lens] = [];
    }
  });

  return signalMap;
}

// ─── OpenAI API ─────────────────────────────────────────────────────────────

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL   = 'gpt-4o';

const SYSTEM_PROMPT = `You are a senior strategic analyst. Your task is to analyze news signals through PESTEL lenses and produce a structured strategic intelligence report.

CRITICAL RULES:
1. Respond ONLY with valid JSON. No markdown, no code fences, no explanation text.
2. The JSON must exactly match the schema provided in the user message.
3. All string values must be complete sentences or meaningful phrases.
4. confidence scores must be integers between 0 and 100.
5. Insight IDs must be formatted as I1, I2, I3, etc.
6. Base your analysis strictly on the provided signals. Do not hallucinate facts.
7. generatedAt must be a valid ISO 8601 timestamp.`;

/**
 * Build the user prompt from company, lenses, signals, and optional location.
 * @param {string} company
 * @param {string[]} lenses
 * @param {Record<string, Array>} signalMap
 * @param {string} [location]
 * @returns {string}
 */
function buildUserPrompt(company, lenses, signalMap, location) {
  const locationContext = location && location !== 'Global'
    ? `Geographic focus: ${location}`
    : 'Geographic focus: Global (no geographic restriction)';

  const signalSummary = lenses.map(lens => {
    const articles = signalMap[lens] || [];
    if (articles.length === 0) {
      return `## ${lens} Lens\n(No signals retrieved — treat confidence for this lens as low)`;
    }
    const lines = articles.map((a, i) => `  ${i + 1}. [${a.source}] ${a.headline} (${a.date})`).join('\n');
    return `## ${lens} Lens\n${lines}`;
  }).join('\n\n');

  return `Analyze the following news signals for **${company}** and produce a strategic intelligence report.
${locationContext}

=== NEWS SIGNALS ===
${signalSummary}

=== REQUIRED JSON OUTPUT SCHEMA ===
{
  "company": "${company}",
  "lenses": ${JSON.stringify(lenses)},
  "generatedAt": "<ISO 8601 timestamp>",
  "signalLayer": {
    "<LensName>": [
      { "headline": "<brief signal summary>", "relevance": "<1 sentence explaining why this signal matters>" }
    ]
  },
  "insightLayer": [
    {
      "id": "I1",
      "title": "<concise insight title>",
      "lenses": ["<lens1>", "<lens2>"],
      "observation": "<What pattern or fact is visible in the signals?>",
      "mechanism": "<How does this dynamic work? What are the causal links?>",
      "implication": "<What does this mean for ${company}'s strategy, operations, or competitive position${location && location !== 'Global' ? ` in ${location}` : ''}?>",
      "confidence": <integer 0-100>,
      "watchpoint": "<What specific future signal would confirm or invalidate this insight?>"
    }
  ],
  "outlookLayer": {
    "bearCase": "<negative scenario — what goes wrong and why>",
    "baseCase": "<most likely scenario given current signals>",
    "bullCase": "<positive scenario — what goes right and why>",
    "primaryRisk": "<single most important risk ${company} faces based on the signals>",
    "strategicRecommendation": "<1–2 sentence actionable recommendation for ${company}'s leadership>"
  }
}

Produce 3–5 insight cards. Each card must span at least 2 lenses where signals exist. Respond ONLY with the JSON object above — no other text.`;
}

/**
 * Call OpenAI API and return the parsed JSON report.
 * @param {object} opts
 * @param {string} opts.claudeKey  — OpenAI API key
 * @param {string} opts.company
 * @param {string[]} opts.lenses
 * @param {Record<string, Array>} opts.signalMap
 * @param {string} [opts.location]
 * @returns {Promise<object>}
 */
export async function fetchStrategicInsights({ claudeKey, company, lenses, signalMap, location }) {
  const userPrompt = buildUserPrompt(company, lenses, signalMap, location);

  const body = {
    model: OPENAI_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: userPrompt },
    ],
  };

  const resp = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${claudeKey}`,
    },
    body: JSON.stringify(body),
  });

  if (resp.status === 401) throw new Error('CLAUDE_401');
  if (resp.status === 429) throw new Error('CLAUDE_429');
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`OpenAI API error ${resp.status}: ${err.error?.message || 'unknown'}`);
  }

  const data = await resp.json();
  const rawText = data.choices?.[0]?.message?.content || '';

  return parseClaudeResponse(rawText, { claudeKey, company, lenses, signalMap, location });
}

/**
 * Parse OpenAI response into JSON. Retries once with stricter prompt.
 */
export async function parseClaudeResponse(rawText, retryOpts, isRetry = false) {
  let cleaned = rawText.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  cleaned = cleaned.trim();

  const start = cleaned.indexOf('{');
  const end   = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1) {
    cleaned = cleaned.slice(start, end + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch (parseErr) {
    if (!isRetry) {
      console.warn('OpenAI returned non-JSON, retrying…', parseErr.message);
      return retryWithStricterPrompt(retryOpts);
    }
    console.error('JSON parse failed after retry. Returning raw output.');
    return {
      _parseError: true,
      _rawText:    rawText,
      company:     retryOpts.company,
      lenses:      retryOpts.lenses,
      generatedAt: new Date().toISOString(),
    };
  }
}

async function retryWithStricterPrompt({ claudeKey, company, lenses, signalMap, location }) {
  const userPrompt = buildUserPrompt(company, lenses, signalMap, location);

  const body = {
    model: OPENAI_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT + '\n\nIMPERATIVE: Output MUST be a single valid JSON object only.' },
      { role: 'user',   content: userPrompt },
    ],
  };

  const resp = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${claudeKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) throw new Error(`OpenAI retry failed: ${resp.status}`);

  const data    = await resp.json();
  const rawText = data.choices?.[0]?.message?.content || '';

  return parseClaudeResponse(rawText, { claudeKey, company, lenses, signalMap, location }, true);
}

// ─── Deep Dive API ──────────────────────────────────────────────────────────

const DEEP_DIVE_SYSTEM_PROMPT = `You are a senior market intelligence analyst authoring an industry white paper.
Your task is to produce a structured analytical report in JSON format.

CRITICAL RULES:
1. Respond ONLY with valid JSON matching the schema exactly. No markdown, no code fences, no text outside the JSON.
2. Write as a neutral market intelligence analyst — not a consultant giving prescriptive advice.
3. Focus on what the signals mean and imply for the firm, not what the firm should do.
4. Use analytical language: "signals suggest", "evidence indicates", "this dynamic implies" — not "we recommend" or "the firm should".
5. All prose must be substantive, evidence-grounded, white-paper-quality writing.
6. The situationAnalysis object keys MUST exactly match the lens names provided (case-sensitive).
7. marketImplications must contain 2–4 themed implication blocks, never an empty array.
8. signalStrength.assessment must be exactly one of: "Strong", "Moderate", or "Emerging".
9. watchlist must contain 2–4 forward-looking signals as an array of strings.
10. keyFindings must contain 3–5 findings as an array of strings.
11. Base all analysis strictly on the provided data and signals. Do not fabricate facts.
12. generatedAt must be a valid ISO 8601 timestamp.`;

/**
 * Build the deep dive user prompt.
 * @param {'insight'|'outlook'} type
 * @param {object} data  — insight card or outlookLayer object
 * @param {string} company
 * @param {string[]} lenses
 * @param {Record<string, Array>} signalMap
 * @param {string} [location]
 * @returns {string}
 */
function buildDeepDivePrompt(type, data, company, lenses, signalMap, location) {
  const locationContext = location && location !== 'Global'
    ? `Geographic focus: ${location}`
    : 'Geographic focus: Global';

  const signalSummary = lenses.map(lens => {
    const articles = signalMap[lens] || [];
    if (articles.length === 0) {
      return `## ${lens} Lens\n(No signals retrieved)`;
    }
    const lines = articles.map((a, i) => `  ${i + 1}. [${a.source}] ${a.headline} (${a.date})`).join('\n');
    return `## ${lens} Lens\n${lines}`;
  }).join('\n\n');

  const lensKeysNote = `The situationAnalysis object MUST contain exactly these keys: ${lenses.join(', ')}`;
  const subtitleLocation = location && location !== 'Global' ? ` | ${location}` : '';

  let sourceBlock;
  if (type === 'insight') {
    sourceBlock = `=== INSIGHT TO ANALYSE ===
ID: ${data.id}
Title: ${data.title}
Lenses: ${(data.lenses || []).join(', ')}
Observation: ${data.observation}
Mechanism: ${data.mechanism}
Implication: ${data.implication}
Confidence: ${data.confidence}%
Watchpoint: ${data.watchpoint}`;
  } else {
    sourceBlock = `=== OUTLOOK SCENARIOS TO ANALYSE ===
Bear Case: ${data.bearCase}
Base Case: ${data.baseCase}
Bull Case: ${data.bullCase}
Primary Risk: ${data.primaryRisk}
Strategic Recommendation: ${data.strategicRecommendation}`;
  }

  const focus = type === 'insight'
    ? `the market intelligence insight "${data.title}" as it relates to ${company}`
    : `the scenario outlook and market dynamics for ${company}`;

  return `Write a market intelligence white paper analysing ${focus}.
${locationContext}

=== NEWS SIGNALS ===
${signalSummary}

${sourceBlock}

=== REQUIRED JSON OUTPUT SCHEMA ===
{
  "title": "<white paper title — specific, analytical, not advisory>",
  "subtitle": "${company}${subtitleLocation} | ${lenses.join(' · ')} Intelligence Brief",
  "generatedAt": "<ISO 8601 timestamp>",
  "executiveSummary": "<3-5 sentences: key intelligence finding, its market significance, and the broader context — analytical tone, not prescriptive>",
  "situationAnalysis": {
    ${lenses.map(l => `"${l}": "<2-4 sentences: what the ${l} signals reveal about the environment ${company} operates in>"`).join(',\n    ')}
  },
  "keyFindings": [
    "<finding 1 — specific, evidence-backed analytical statement>",
    "<finding 2>",
    "<finding 3>"
  ],
  "marketImplications": [
    {
      "theme": "<implication theme title — e.g. 'Competitive Pressure', 'Regulatory Exposure', 'Demand Shift'>",
      "analysis": "<2-3 sentences: what this dynamic implies for ${company}'s market position, operating environment, or competitive landscape — analytical, not directive>"
    }
  ],
  "signalStrength": {
    "assessment": "<exactly one of: Strong | Moderate | Emerging>",
    "rationale": "<2-3 sentences: explain the evidential basis, consistency across sources, and confidence level of these signals>"
  },
  "watchlist": [
    "<forward-looking signal or development to monitor — specific and observable>",
    "<watchlist item 2>"
  ]
}

${lensKeysNote}
Respond ONLY with the JSON object above — no other text.`;
}

/**
 * Parse deep dive response — strip fences, parse JSON, throw on failure.
 */
function parseDeepDiveResponse(rawText) {
  let cleaned = rawText.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

  const start = cleaned.indexOf('{');
  const end   = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1) {
    cleaned = cleaned.slice(start, end + 1);
  }

  return JSON.parse(cleaned);
}

/**
 * Fetch a market intelligence white paper for an insight or the outlook section.
 * @param {object} opts
 * @param {string} opts.claudeKey         — OpenAI API key
 * @param {'insight'|'outlook'} opts.type
 * @param {object} opts.data              — insight card OR outlookLayer object
 * @param {string} opts.company
 * @param {string[]} opts.lenses
 * @param {Record<string, Array>} opts.signalMap
 * @param {string} [opts.location]
 * @returns {Promise<object>}
 */
export async function fetchDeepDive({ claudeKey, type, data, company, lenses, signalMap, location }) {
  const userPrompt = buildDeepDivePrompt(type, data, company, lenses, signalMap, location);

  const body = {
    model: OPENAI_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: DEEP_DIVE_SYSTEM_PROMPT },
      { role: 'user',   content: userPrompt },
    ],
  };

  const resp = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${claudeKey}`,
    },
    body: JSON.stringify(body),
  });

  if (resp.status === 401) throw new Error('CLAUDE_401');
  if (resp.status === 429) throw new Error('CLAUDE_429');
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`OpenAI API error ${resp.status}: ${err.error?.message || 'unknown'}`);
  }

  const responseData = await resp.json();
  const rawText      = responseData.choices?.[0]?.message?.content || '';

  return parseDeepDiveResponse(rawText);
}
