/**
 * api.js — Strategic Insight Engine
 * All API calls go through the server proxy — no keys in the browser.
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

export function buildNewsQuery(company, lens, location) {
  const keywords = LENS_KEYWORDS[lens] || lens.toLowerCase();
  const base = `"${company}" AND (${keywords})`;
  if (!location || location === 'Global') return base;
  return `${base} AND "${location}"`;
}

export function buildCompanyQuery(company, location) {
  const base = `"${company}"`;
  if (!location || location === 'Global') return base;
  return `${base} AND "${location}"`;
}

function daysAgoISO(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

// ─── NewsAPI (via server proxy) ───────────────────────────────────────────────

export async function fetchLensSignals({ company, lens, pageSize, timeWindowDays, location, language = 'en' }) {
  const q = buildNewsQuery(company, lens, location);
  const from = daysAgoISO(timeWindowDays);

  const params = new URLSearchParams({ q, from, pageSize, language, sortBy: 'relevancy' });
  const resp = await fetch(`/news?${params}`);

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.error || `NewsAPI proxy returned ${resp.status}`);
  }

  const data = await resp.json();
  return (data.articles || []).slice(0, pageSize).map(a => ({
    lens,
    headline: a.title || '(no title)',
    source:   a.source?.name || 'Unknown',
    date:     a.publishedAt ? a.publishedAt.slice(0, 10) : '',
    url:      a.url || '#',
    language: language.toUpperCase(),
  }));
}

export async function fetchNewsSignals({ company, lenses, pageSize, timeWindowDays, location, languages = ['en'] }) {
  const tasks = [];
  lenses.forEach(lens => languages.forEach(lang => tasks.push({ lens, lang })));

  const results = await Promise.allSettled(
    tasks.map(({ lens, lang }) =>
      fetchLensSignals({ company, lens, pageSize, timeWindowDays, location, language: lang })
    )
  );

  const signalMap = {};
  lenses.forEach(l => { signalMap[l] = []; });

  results.forEach((result, i) => {
    const { lens } = tasks[i];
    if (result.status === 'fulfilled') {
      signalMap[lens].push(...result.value);
    } else {
      console.warn(`Failed signals for "${tasks[i].lens}" [${tasks[i].lang}]:`, result.reason?.message);
    }
  });

  lenses.forEach(lens => {
    const seen = new Set();
    signalMap[lens] = signalMap[lens].filter(a => {
      if (seen.has(a.url)) return false;
      seen.add(a.url);
      return true;
    });
  });

  return signalMap;
}

export async function fetchCompanySignals({ company, pageSize, timeWindowDays, languages = ['en'], location }) {
  const q    = buildCompanyQuery(company, location);
  const from = daysAgoISO(timeWindowDays);

  const results = await Promise.allSettled(
    languages.map(lang => {
      const params = new URLSearchParams({ q, from, pageSize, language: lang, sortBy: 'relevancy' });
      return fetch(`/news?${params}`)
        .then(resp => {
          if (!resp.ok) return resp.json().catch(() => ({})).then(body => { throw new Error(body.error || `NewsAPI proxy returned ${resp.status}`); });
          return resp.json();
        })
        .then(data =>
          (data.articles || []).slice(0, pageSize).map(a => ({
            headline: a.title || '(no title)',
            source:   a.source?.name || 'Unknown',
            date:     a.publishedAt ? a.publishedAt.slice(0, 10) : '',
            url:      a.url || '#',
            language: lang.toUpperCase(),
          }))
        );
    })
  );

  const all = [];
  results.forEach(r => {
    if (r.status === 'fulfilled') all.push(...r.value);
    else console.warn('fetchCompanySignals call failed:', r.reason?.message);
  });

  const seen = new Set();
  return all.filter(a => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });
}

// ─── OpenAI (via server proxy at /ai) ────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior strategic analyst. Your task is to analyze news signals through PESTEL lenses and produce a structured strategic intelligence report.

CRITICAL RULES:
1. Respond ONLY with valid JSON. No markdown, no code fences, no explanation text.
2. The JSON must exactly match the schema provided in the user message.
3. All string values must be complete sentences or meaningful phrases.
4. confidence scores must be integers between 0 and 100.
5. Insight IDs must be formatted as I1, I2, I3, etc.
6. Base your analysis strictly on the provided signals. Do not hallucinate facts.
7. generatedAt must be a valid ISO 8601 timestamp.`;

function buildUserPrompt(company, lenses, signalMap, location, outputLanguage = 'English', companySignals = []) {
  const locationContext = location && location !== 'Global'
    ? `Geographic focus: ${location}`
    : 'Geographic focus: Global (no geographic restriction)';

  const outputLangLine = `Output language: ${outputLanguage}. Respond entirely in ${outputLanguage}.`;

  let companySignalSection = '';
  if (companySignals.length > 0) {
    const lines = companySignals
      .map((a, i) => `  ${i + 1}. [${a.source}] ${a.headline} (${a.date}) [${a.language}]`)
      .join('\n');
    companySignalSection = `## Company Signals (company-specific news)\n${lines}\n\nWhen writing insights, explicitly note when a Company Signal corroborates or contrasts a PESTEL macro finding.\n\n`;
  }

  const signalSummary = lenses.map(lens => {
    const articles = signalMap[lens] || [];
    if (articles.length === 0) {
      return `## ${lens} Lens\n(No signals retrieved — treat confidence for this lens as low)`;
    }
    const lines = articles.map((a, i) => `  ${i + 1}. [${a.source}] ${a.headline} (${a.date}) [${a.language}]`).join('\n');
    return `## ${lens} Lens\n${lines}`;
  }).join('\n\n');

  return `Analyze the following news signals for **${company}** and produce a strategic intelligence report.
${locationContext}
${outputLangLine}

=== NEWS SIGNALS ===
${companySignalSection}${signalSummary}

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

async function callAI(messages) {
  const resp = await fetch('/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, response_format: { type: 'json_object' } }),
  });

  if (resp.status === 401) throw new Error('CLAUDE_401');
  if (resp.status === 429) throw new Error('CLAUDE_429');
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`OpenAI API error ${resp.status}: ${err.error || 'unknown'}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function fetchStrategicInsights({ company, lenses, signalMap, location, outputLanguage = 'English', companySignals = [] }) {
  const userPrompt = buildUserPrompt(company, lenses, signalMap, location, outputLanguage, companySignals);
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user',   content: userPrompt },
  ];

  const rawText = await callAI(messages);
  return parseAIResponse(rawText, { company, lenses, signalMap, location, outputLanguage, companySignals });
}

export async function parseAIResponse(rawText, retryOpts, isRetry = false) {
  let cleaned = rawText.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  const start = cleaned.indexOf('{');
  const end   = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1) cleaned = cleaned.slice(start, end + 1);

  try {
    return JSON.parse(cleaned);
  } catch (parseErr) {
    if (!isRetry) {
      console.warn('AI returned non-JSON, retrying…', parseErr.message);
      return retryWithStricterPrompt(retryOpts);
    }
    console.error('JSON parse failed after retry.');
    return {
      _parseError: true,
      _rawText:    rawText,
      company:     retryOpts.company,
      lenses:      retryOpts.lenses,
      generatedAt: new Date().toISOString(),
    };
  }
}

async function retryWithStricterPrompt({ company, lenses, signalMap, location, outputLanguage = 'English', companySignals = [] }) {
  const userPrompt = buildUserPrompt(company, lenses, signalMap, location, outputLanguage, companySignals);
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT + '\n\nIMPERATIVE: Output MUST be a single valid JSON object only.' },
    { role: 'user',   content: userPrompt },
  ];

  const rawText = await callAI(messages);
  return parseAIResponse(rawText, { company, lenses, signalMap, location, outputLanguage, companySignals }, true);
}

// ─── Deep Dive (via server proxy) ────────────────────────────────────────────

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

function buildDeepDivePrompt(type, data, company, lenses, signalMap, location, outputLanguage = 'English') {
  const locationContext = location && location !== 'Global'
    ? `Geographic focus: ${location}`
    : 'Geographic focus: Global';

  const outputLangLine = `Output language: ${outputLanguage}. Respond entirely in ${outputLanguage}.`;

  const signalSummary = lenses.map(lens => {
    const articles = signalMap[lens] || [];
    if (articles.length === 0) return `## ${lens} Lens\n(No signals retrieved)`;
    const lines = articles.map((a, i) => `  ${i + 1}. [${a.source}] ${a.headline} (${a.date}) [${a.language || 'EN'}]`).join('\n');
    return `## ${lens} Lens\n${lines}`;
  }).join('\n\n');

  const lensKeysNote = `The situationAnalysis object MUST contain exactly these keys: ${lenses.join(', ')}`;
  const subtitleLocation = location && location !== 'Global' ? ` | ${location}` : '';

  const sourceBlock = type === 'insight'
    ? `=== INSIGHT TO ANALYSE ===
ID: ${data.id}
Title: ${data.title}
Lenses: ${(data.lenses || []).join(', ')}
Observation: ${data.observation}
Mechanism: ${data.mechanism}
Implication: ${data.implication}
Confidence: ${data.confidence}%
Watchpoint: ${data.watchpoint}`
    : `=== OUTLOOK SCENARIOS TO ANALYSE ===
Bear Case: ${data.bearCase}
Base Case: ${data.baseCase}
Bull Case: ${data.bullCase}
Primary Risk: ${data.primaryRisk}
Strategic Recommendation: ${data.strategicRecommendation}`;

  const focus = type === 'insight'
    ? `the market intelligence insight "${data.title}" as it relates to ${company}`
    : `the scenario outlook and market dynamics for ${company}`;

  return `Write a market intelligence white paper analysing ${focus}.
${locationContext}
${outputLangLine}

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
      "theme": "<implication theme title>",
      "analysis": "<2-3 sentences: analytical implication for ${company}>"
    }
  ],
  "signalStrength": {
    "assessment": "<exactly one of: Strong | Moderate | Emerging>",
    "rationale": "<2-3 sentences explaining evidential basis>"
  },
  "watchlist": [
    "<forward-looking signal to monitor>",
    "<watchlist item 2>"
  ]
}

${lensKeysNote}
Respond ONLY with the JSON object above — no other text.`;
}

export async function fetchDeepDive({ type, data, company, lenses, signalMap, location, outputLanguage = 'English' }) {
  const userPrompt = buildDeepDivePrompt(type, data, company, lenses, signalMap, location, outputLanguage);
  const messages = [
    { role: 'system', content: DEEP_DIVE_SYSTEM_PROMPT },
    { role: 'user',   content: userPrompt },
  ];

  const rawText = await callAI(messages);

  let cleaned = rawText.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  const start = cleaned.indexOf('{');
  const end   = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1) cleaned = cleaned.slice(start, end + 1);

  return JSON.parse(cleaned);
}
