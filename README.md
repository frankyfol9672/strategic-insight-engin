# Strategic Insight Engine

A single-page web app that acts as an AI-powered strategic analyst. Enter a company name, select PESTEL lenses and a geographic focus, and get a structured three-layer intelligence report — plus the ability to deep dive into any insight with a full market intelligence white paper.

![Report layers: Signal → Insight → Outlook](https://img.shields.io/badge/layers-Signal%20→%20Insight%20→%20Outlook-60a5fa?style=flat-square)
![Powered by GPT-4o](https://img.shields.io/badge/AI-GPT--4o-10a37f?style=flat-square)
![NewsAPI](https://img.shields.io/badge/news-NewsAPI-orange?style=flat-square)

---

## Features

- **Company Signals (Layer 00)** — company-specific news fetched separately to ground PESTEL insights
- **PESTEL analysis** — choose 1–3 lenses (Political, Economic, Social, Technological, Environmental, Legal)
- **Multi-language research** — fetch signals in up to 5 languages simultaneously; auto-suggests languages based on selected region
- **Report output language** — generate the full report in English, French, Spanish, German, and more
- **Location filter** — narrow from Global → Region → Country
- **3-layer report**
  - **Signal Layer** — real news articles fetched per lens with language badges
  - **Insight Layer** — 3–5 cross-lens insight cards with Observation / Mechanism / Implication / Confidence / Watchpoint
  - **Outlook Layer** — Bear / Base / Bull scenario analysis
- **Deep Dive panel** — full market intelligence white paper per insight or outlook section
- **Dark terminal theme** — Bloomberg/terminal aesthetic

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- An [OpenAI API key](https://platform.openai.com/api-keys) (GPT-4o)
- A [NewsAPI key](https://newsapi.org/register) (free tier: 100 requests/day)

---

## Local setup

**1. Clone the repo and enter the project folder**

```bash
git clone https://github.com/frankyfol9672/strategic-insight-engin.git
cd strategic-insight-engin
```

> All commands from this point must be run from inside the `strategic-insight-engin` folder.

**2. Install dependencies**

```bash
npm install
```

**3. Set your API keys**

Create a `.env` file in the project root (this file is git-ignored):

```bash
OPENAI_API_KEY=sk-...your-openai-key...
NEWS_API_KEY=your-newsapi-key
```

Or export them inline when starting the server (step 4).

**4. Start the server**

```bash
node server.js
```

You should see:

```
[SIE] Running on http://localhost:3001
[SIE] OPENAI_API_KEY : set
[SIE] NEWS_API_KEY   : set
```

**5. Open the app**

Open **http://localhost:3001** in your browser.

That's it — there is no second terminal or separate frontend step. The Express server serves the app and handles all API calls.

---

## Architecture

All API keys live on the server and are never sent to the browser.

```
Browser  →  Express server (localhost:3001)
                ├── GET  /          → serves public/index.html
                ├── GET  /news      → proxies NewsAPI (uses NEWS_API_KEY)
                └── POST /ai        → proxies OpenAI  (uses OPENAI_API_KEY)
```

---

## Project structure

```
strategic-insight-engin/
├── public/
│   ├── index.html   — page markup
│   ├── style.css    — dark terminal theme
│   ├── api.js       — all API calls (hits /news and /ai on this server)
│   └── script.js    — UI logic, state, rendering
├── server.js        — Express server: static files + API proxies
└── package.json
```

---

## Deploying to Render

1. Push your repo to GitHub
2. Go to [render.com](https://render.com) → **New Web Service** → connect your repo
3. Set:
   - **Build command:** `npm install`
   - **Start command:** `node server.js`
4. Add environment variables in the Render dashboard:
   - `OPENAI_API_KEY` — your OpenAI key
   - `NEWS_API_KEY` — your NewsAPI key
5. Deploy — your public URL is ready

---

## Cost

- **NewsAPI** — free tier: 100 requests/day (each report uses 1 request per lens selected)
- **OpenAI GPT-4o** — roughly $0.01–0.05 per report, $0.05–0.15 per deep dive

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request
