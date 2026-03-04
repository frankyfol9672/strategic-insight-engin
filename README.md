# Strategic Insight Engine

A stateless single-page web app that acts as an AI-powered strategic analyst. Enter a company name, select PESTEL lenses and a geographic focus, and get a structured three-layer intelligence report — plus the ability to deep dive into any insight with a full market intelligence white paper.

![Report layers: Signal → Insight → Outlook](https://img.shields.io/badge/layers-Signal%20→%20Insight%20→%20Outlook-60a5fa?style=flat-square)
![Powered by GPT-4o](https://img.shields.io/badge/AI-GPT--4o-10a37f?style=flat-square)
![NewsAPI](https://img.shields.io/badge/news-NewsAPI-orange?style=flat-square)

---

## Features

- **PESTEL analysis** — choose 1–3 lenses (Political, Economic, Social, Technological, Environmental, Legal)
- **Location filter** — narrow from Global → Region → Country
- **3-layer report**
  - **Signal Layer** — real news articles fetched per lens
  - **Insight Layer** — 3–5 cross-lens insight cards with Observation / Mechanism / Implication / Confidence / Watchpoint
  - **Outlook Layer** — Bear / Base / Bull scenario analysis
- **Deep Dive panel** — click any insight or the Outlook section to get a full market intelligence white paper (Executive Summary, Situation Analysis, Key Findings, Market Implications, Signal Strength, Watchlist)
- **Dark terminal theme** — Bloomberg/terminal aesthetic

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- An [OpenAI API key](https://platform.openai.com/api-keys) (GPT-4o)
- A [NewsAPI key](https://newsapi.org/register) (free tier: 100 requests/day)

---

## Setup

**1. Clone the repo**

```bash
git clone https://github.com/frankyfol9672/strategic-insight-engin.git
cd strategic-insight-engin
```

**2. Install dependencies**

```bash
npm install
```

**3. Start the NewsAPI proxy**

The proxy runs on `localhost:3001` and adds your NewsAPI key server-side to bypass CORS.

```bash
node server.js
```

You should see:
```
[SIE Proxy] Running on http://localhost:3001
```

**4. Serve the frontend**

In a second terminal:

```bash
npx serve .
```

Open **http://localhost:3000** in your browser.

---

## API Keys

Keys are stored in your browser's `localStorage` — they never leave your machine except to call the respective APIs directly.

On first load, the Settings panel opens automatically. Enter:

| Field | Where to get it |
|---|---|
| **OpenAI API Key** | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) — starts with `sk-...` |
| **NewsAPI Key** | [newsapi.org/register](https://newsapi.org/register) — free, instant |
| **Proxy URL** | Leave as `http://localhost:3001` (default) |

Click **Save Settings**.

> **Note:** NewsAPI free tier only works from `localhost`. The local proxy handles this — do not call NewsAPI directly from the browser.

---

## Usage

1. Enter a **company name** (e.g. Tesla, Apple, Volkswagen)
2. Select **1–3 PESTEL lenses**
3. Optionally narrow the **location** (e.g. Europe → Germany)
4. Set **articles per lens** and **time window**
5. Click **Generate Report**
6. Click **Deep Dive →** on any insight card or the Outlook section for a full white paper

---

## Project Structure

```
strategic-insight-engine/
├── index.html      — Full page markup and element IDs
├── style.css       — Dark terminal theme with CSS design tokens
├── api.js          — ES module: NewsAPI + OpenAI API calls, prompt builders
├── script.js       — ES module: UI logic, state, orchestration, rendering
├── server.js       — Express proxy for NewsAPI (bypasses CORS)
└── package.json    — express + node-fetch dependencies
```

### Architecture

```
Browser
  ├── OpenAI (GPT-4o) ──────────── called directly (CORS supported)
  └── NewsAPI proxy (localhost:3001)
        └── newsapi.org ─────────── API key added server-side
```

---

## Environment Variables

Optionally set the NewsAPI key as an environment variable so teammates don't need to enter it manually:

```bash
NEWS_API_KEY=your_key_here node server.js
```

If set, the proxy uses this key and ignores the client-supplied header.

---

## Cost

- **NewsAPI** — free tier gives 100 requests/day (each report uses 1 request per lens selected)
- **OpenAI GPT-4o** — roughly $0.01–0.05 per report, $0.05–0.15 per deep dive

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request
