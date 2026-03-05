# Strategic Insight Engine

An AI-powered PESTEL strategic analyst. Enter a company name, select analysis lenses and a geographic focus, and get a structured three-layer intelligence report with deep-dive white papers per insight.

![Report layers: Signal → Insight → Outlook](https://img.shields.io/badge/layers-Signal%20→%20Insight%20→%20Outlook-60a5fa?style=flat-square)
![Powered by GPT-4o](https://img.shields.io/badge/AI-GPT--4o-10a37f?style=flat-square)
![NewsAPI](https://img.shields.io/badge/news-NewsAPI-orange?style=flat-square)

---

## Use the live app

The easiest way — no setup required:

**→ [https://strategic-insight-engin.onrender.com](https://strategic-insight-engin.onrender.com)**

Just open the URL and start using it. API keys are pre-configured server-side.

> **Note:** The free Render tier spins down after 15 min of inactivity. The first load after a period of inactivity may take ~30 seconds.

---

## Run locally

Only needed if you want to run your own instance (e.g. to use your own API keys or modify the code).

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- An [OpenAI API key](https://platform.openai.com/api-keys) (GPT-4o)
- A [NewsAPI key](https://newsapi.org/register) (free tier: 100 requests/day)

### Steps

**1. Clone the repo**

```bash
git clone https://github.com/frankyfol9672/strategic-insight-engin.git
```

**2. Enter the project folder**

```bash
cd strategic-insight-engin
```

> Every command from here must be run from inside this folder.

**3. Install dependencies**

```bash
npm install
```

**4. Add your API keys**

Create a file called `.env` inside the `strategic-insight-engin` folder:

```
OPENAI_API_KEY=sk-...your-openai-key...
NEWS_API_KEY=your-newsapi-key
```

The file should sit next to `server.js`:

```
strategic-insight-engin/
├── .env          ← create this file
├── server.js
├── package.json
└── public/
```

**5. Start the server**

```bash
node server.js
```

You should see:

```
[SIE] Running on http://localhost:3001
[SIE] OPENAI_API_KEY : set
[SIE] NEWS_API_KEY   : set
```

If either key shows `NOT SET`, check that `.env` is in the right folder and spelled correctly.

**6. Open the app**

Open **[http://localhost:3001](http://localhost:3001)** in your browser.

There is no second terminal or separate frontend step — the server serves everything.

---

## Features

- **Company Signals (Layer 00)** — company-specific news fetched alongside PESTEL signals
- **PESTEL analysis** — choose 1–3 lenses (Political, Economic, Social, Technological, Environmental, Legal)
- **Multi-language research** — fetch signals in up to 5 languages simultaneously; auto-suggests languages based on region
- **Report output language** — generate the full report in English, French, Spanish, German, and more
- **Location filter** — narrow from Global → Region → Country
- **3-layer report**
  - **Signal Layer** — real news articles per lens with language badges
  - **Insight Layer** — 3–5 cross-lens insight cards (Observation / Mechanism / Implication / Confidence / Watchpoint)
  - **Outlook Layer** — Bear / Base / Bull scenario analysis
- **Deep Dive panel** — full market intelligence white paper per insight or outlook section

---

## Project structure

```
strategic-insight-engin/
├── public/
│   ├── index.html   — page markup
│   ├── style.css    — dark terminal theme
│   ├── api.js       — API calls (proxied through server)
│   └── script.js    — UI logic, state, rendering
├── server.js        — Express server: static files + API proxies
├── .env             — your local API keys (git-ignored, never committed)
└── package.json
```

---

## Architecture

API keys live only on the server — they are never exposed to the browser.

```
Browser  →  Express server (port 3001)
                ├── GET  /       → serves public/index.html
                ├── GET  /news   → proxies NewsAPI  (uses NEWS_API_KEY)
                └── POST /ai     → proxies OpenAI   (uses OPENAI_API_KEY)
```

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request
