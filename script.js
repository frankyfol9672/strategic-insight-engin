/**
 * script.js — Strategic Insight Engine
 * UI logic, state management, orchestration, rendering
 */

import { fetchNewsSignals, fetchStrategicInsights, fetchDeepDive } from './api.js';

// ─── PESTEL lens color map ───────────────────────────────────────────────────
const LENS_COLORS = {
  Political:     'var(--lens-P)',
  Economic:      'var(--lens-E)',
  Social:        'var(--lens-S)',
  Technological: 'var(--lens-T)',
  Environmental: 'var(--lens-En)',
  Legal:         'var(--lens-L)',
};

// ─── Location data ───────────────────────────────────────────────────────────
const REGIONS = {
  Global:                  [],
  'Asia Pacific':          ['China', 'Japan', 'South Korea', 'India', 'Australia', 'Singapore', 'Indonesia', 'Vietnam', 'Thailand', 'Malaysia'],
  Europe:                  ['United Kingdom', 'Germany', 'France', 'Netherlands', 'Sweden', 'Switzerland', 'Italy', 'Spain', 'Poland', 'Belgium'],
  'North America':         ['United States', 'Canada', 'Mexico'],
  'Latin America':         ['Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru'],
  'Middle East & Africa':  ['Saudi Arabia', 'UAE', 'South Africa', 'Nigeria', 'Egypt', 'Israel', 'Turkey'],
};

// ─── Application State ───────────────────────────────────────────────────────
const state = {
  selectedLenses:  [],
  lastFormValues:  null,
  lastSignalMap:   null,
  isGenerating:    false,
  deepDiveOpen:    false,
  selectedRegion:  'Global',
  selectedCountry: '',
};

// ─── DOM References ──────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const els = {
  // Header
  settingsToggle:  $('settings-toggle'),
  settingsPanel:   $('settings-panel'),
  settingsClose:   $('settings-close'),
  settingsSave:    $('settings-save'),
  settingsSavedMsg: $('settings-saved-msg'),
  // Settings inputs
  claudeKeyInput:  $('claude-key-input'),
  newsKeyInput:    $('news-key-input'),
  proxyUrlInput:   $('proxy-url-input'),
  // Form
  companyInput:    $('company-input'),
  pestelBtns:      document.querySelectorAll('.pestel-btn'),
  lensValidation:  $('lens-validation-msg'),
  articlesPerLens: $('articles-per-lens'),
  timeWindow:      $('time-window'),
  locationRegion:  $('location-region'),
  locationCountry: $('location-country'),
  generateBtn:     $('generate-btn'),
  generateBtnText: $('generate-btn-text'),
  generateBtnIcon: $('generate-btn-icon'),
  // Error
  errorBanner:     $('error-banner'),
  errorMessage:    $('error-message'),
  errorDismiss:    $('error-dismiss'),
  // Report
  reportIdle:      $('report-idle'),
  reportLoading:   $('report-loading'),
  reportContent:   $('report-content'),
  loadingDetail:   $('loading-detail'),
  phase1:          $('phase-1'),
  phase2:          $('phase-2'),
  phase3:          $('phase-3'),
  // Report content areas
  reportCompanyName:   $('report-company-name'),
  reportLensesDisplay: $('report-lenses-display'),
  reportTimestamp:     $('report-timestamp'),
  signalLayerContent:  $('signal-layer-content'),
  insightLayerContent: $('insight-layer-content'),
  outlookLayerContent: $('outlook-layer-content'),
  reportRegenerate:    $('report-regenerate'),
  // Offline banner
  offlineBanner:   $('offline-banner'),
  // Deep Dive panel
  deepDiveOverlay:   $('deep-dive-overlay'),
  deepDivePanel:     $('deep-dive-panel'),
  deepDiveClose:     $('deep-dive-close'),
  ddpTitle:          $('ddp-title'),
  ddpBadges:         $('ddp-badges'),
  ddpBody:           $('ddp-body'),
  ddpLoading:        $('ddp-loading'),
  ddpError:          $('ddp-error'),
  ddpErrorMessage:   $('ddp-error-message'),
  ddpReport:         $('ddp-report'),
  ddpExecSummary:    $('ddp-exec-summary'),
  ddpSituation:      $('ddp-situation'),
  ddpFindings:       $('ddp-findings'),
  ddpOptionsTbody:   $('ddp-options-tbody'),
  ddpImplications:          $('ddp-implications'),
  ddpSignalStrengthBadge:   $('ddp-ss-badge'),
  ddpSignalStrengthRationale: $('ddp-ss-rationale'),
  ddpWatchlist:             $('ddp-watchlist'),
};

// ─── LocalStorage Helpers ────────────────────────────────────────────────────
const LS_KEYS = {
  claudeKey: 'sie_claude_key',
  newsKey:   'sie_news_key',
  proxyUrl:  'sie_proxy_url',
};

function loadSettings() {
  els.claudeKeyInput.value = localStorage.getItem(LS_KEYS.claudeKey) || '';
  els.newsKeyInput.value   = localStorage.getItem(LS_KEYS.newsKey)   || '';
  els.proxyUrlInput.value  = localStorage.getItem(LS_KEYS.proxyUrl)  || 'http://localhost:3001';
}

function saveSettings() {
  localStorage.setItem(LS_KEYS.claudeKey, els.claudeKeyInput.value.trim());
  localStorage.setItem(LS_KEYS.newsKey,   els.newsKeyInput.value.trim());
  localStorage.setItem(LS_KEYS.proxyUrl,  els.proxyUrlInput.value.trim() || 'http://localhost:3001');
}

function getSettings() {
  return {
    claudeKey: localStorage.getItem(LS_KEYS.claudeKey) || '',
    newsKey:   localStorage.getItem(LS_KEYS.newsKey)   || '',
    proxyUrl:  localStorage.getItem(LS_KEYS.proxyUrl)  || 'http://localhost:3001',
  };
}

// ─── Settings Panel ──────────────────────────────────────────────────────────
function openSettings() {
  els.settingsPanel.classList.remove('collapsed');
  els.settingsToggle.setAttribute('aria-label', 'Close settings');
}

function closeSettings() {
  els.settingsPanel.classList.add('collapsed');
  els.settingsToggle.setAttribute('aria-label', 'Open settings');
}

function toggleSettings() {
  const isCollapsed = els.settingsPanel.classList.contains('collapsed');
  isCollapsed ? openSettings() : closeSettings();
}

els.settingsToggle.addEventListener('click', toggleSettings);
els.settingsClose.addEventListener('click', closeSettings);

els.settingsSave.addEventListener('click', () => {
  saveSettings();
  els.settingsSavedMsg.classList.remove('hidden');
  setTimeout(() => els.settingsSavedMsg.classList.add('hidden'), 2000);
});

// ─── Location Filter ─────────────────────────────────────────────────────────
els.locationRegion.addEventListener('change', () => {
  const region = els.locationRegion.value;
  state.selectedRegion  = region;
  state.selectedCountry = '';

  const countries = REGIONS[region] || [];
  els.locationCountry.innerHTML = '<option value="">All countries</option>';
  countries.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    els.locationCountry.appendChild(opt);
  });

  els.locationCountry.disabled = countries.length === 0;
});

els.locationCountry.addEventListener('change', () => {
  state.selectedCountry = els.locationCountry.value;
});

/** Returns the most specific location selected. */
function getLocation() {
  if (state.selectedCountry) return state.selectedCountry;
  if (state.selectedRegion && state.selectedRegion !== 'Global') return state.selectedRegion;
  return 'Global';
}

// ─── PESTEL Lens Toggles ─────────────────────────────────────────────────────
els.pestelBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const lens = btn.dataset.lens;
    const idx  = state.selectedLenses.indexOf(lens);

    if (idx === -1) {
      // Add if under limit
      if (state.selectedLenses.length >= 3) return;
      state.selectedLenses.push(lens);
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
    } else {
      // Remove
      state.selectedLenses.splice(idx, 1);
      btn.classList.remove('active');
      btn.setAttribute('aria-pressed', 'false');
    }

    els.lensValidation.classList.add('hidden');
  });
});

// ─── Error Banner ────────────────────────────────────────────────────────────
function showError(msg) {
  els.errorMessage.textContent = msg;
  els.errorBanner.classList.remove('hidden');
}

function hideError() {
  els.errorBanner.classList.add('hidden');
  els.errorMessage.textContent = '';
}

els.errorDismiss.addEventListener('click', hideError);

// ─── Loading State ───────────────────────────────────────────────────────────
function showLoading(phase, detail) {
  // 1 = gathering signals, 2 = synthesizing, 3 = building
  [els.phase1, els.phase2, els.phase3].forEach((el, i) => {
    const num = i + 1;
    el.classList.remove('active', 'done');
    if (num < phase)  el.classList.add('done');
    if (num === phase) el.classList.add('active');
  });
  if (detail) els.loadingDetail.textContent = detail;
}

function setReportState(state) {
  els.reportIdle.classList.add('hidden');
  els.reportLoading.classList.add('hidden');
  els.reportContent.classList.add('hidden');

  if (state === 'idle')    els.reportIdle.classList.remove('hidden');
  if (state === 'loading') els.reportLoading.classList.remove('hidden');
  if (state === 'report')  els.reportContent.classList.remove('hidden');
}

// ─── Form Validation ─────────────────────────────────────────────────────────
function validateForm() {
  const { claudeKey, newsKey } = getSettings();
  const company = els.companyInput.value.trim();

  if (!claudeKey || !newsKey) {
    showError('API keys are missing. Please open Settings and enter your OpenAI and NewsAPI keys.');
    openSettings();
    return false;
  }

  if (!company) {
    showError('Please enter a company or organization name.');
    els.companyInput.focus();
    return false;
  }

  if (state.selectedLenses.length === 0) {
    els.lensValidation.classList.remove('hidden');
    return false;
  }

  return true;
}

// ─── Generate Report ─────────────────────────────────────────────────────────
async function generateReport() {
  if (state.isGenerating) return;
  if (!validateForm()) return;

  hideError();

  if (!navigator.onLine) {
    showError('You are offline. Please reconnect and try again.');
    return;
  }

  const { claudeKey, newsKey, proxyUrl } = getSettings();
  const company        = els.companyInput.value.trim();
  const lenses         = [...state.selectedLenses];
  const pageSize       = parseInt(els.articlesPerLens.value, 10);
  const timeWindowDays = parseInt(els.timeWindow.value, 10);
  const location       = getLocation();

  state.isGenerating = true;
  state.lastFormValues = { claudeKey, newsKey, proxyUrl, company, lenses, pageSize, timeWindowDays, location };

  // Disable generate button
  els.generateBtn.disabled = true;
  els.generateBtnText.textContent = 'Generating…';

  setReportState('loading');
  showLoading(1, 'Querying NewsAPI for signals…');

  try {
    // Phase 1: Fetch news signals
    showLoading(1, `Fetching signals for ${lenses.join(', ')}…`);
    let signalMap;
    try {
      signalMap = await fetchNewsSignals({
        company, lenses, proxyUrl, newsApiKey: newsKey, pageSize, timeWindowDays, location,
      });
      state.lastSignalMap = signalMap;
    } catch (err) {
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        throw new Error(`PROXY_OFFLINE:${proxyUrl}`);
      }
      throw err;
    }

    // Phase 2: Synthesize with OpenAI
    showLoading(2, 'Sending signals to GPT-4o for synthesis…');
    const report = await fetchStrategicInsights({ claudeKey, company, lenses, signalMap, location });

    // Phase 3: Render
    showLoading(3, 'Building report…');

    // Small delay so phase 3 is visible
    await new Promise(r => setTimeout(r, 400));

    renderReport(report, signalMap);
    setReportState('report');

  } catch (err) {
    setReportState('idle');
    handleFetchError(err, proxyUrl);
  } finally {
    state.isGenerating = false;
    els.generateBtn.disabled = false;
    els.generateBtnText.textContent = 'Generate Report';
  }
}

function handleFetchError(err, proxyUrl) {
  const msg = err.message || '';

  if (msg === 'CLAUDE_401') {
    showError('Invalid OpenAI API key. Please check your key in Settings.');
    openSettings();
    return;
  }
  if (msg === 'CLAUDE_429') {
    showError('OpenAI rate limit reached. Please wait 60 seconds and try again.');
    return;
  }
  if (msg.startsWith('PROXY_OFFLINE')) {
    showError(`Cannot reach the local proxy at ${proxyUrl}. Make sure the server is running: node server.js`);
    return;
  }

  showError(`An error occurred: ${msg}`);
  console.error('[SIE] Generate error:', err);
}

els.generateBtn.addEventListener('click', generateReport);
els.reportRegenerate?.addEventListener('click', () => {
  if (state.lastFormValues) generateReport();
});

// ─── Rendering ───────────────────────────────────────────────────────────────

/** Escape HTML to prevent XSS */
function esc(str) {
  const d = document.createElement('div');
  d.textContent = String(str ?? '');
  return d.innerHTML;
}

/** Build a lens badge element */
function createLensBadge(lens) {
  const span = document.createElement('span');
  span.className = 'lens-badge';
  span.textContent = lens;
  const color = LENS_COLORS[lens] || 'var(--text-muted)';
  span.style.color = color;
  span.style.borderColor = color;
  return span;
}

/** Determine confidence bar color */
function confidenceColor(score) {
  if (score >= 70) return 'var(--conf-high)';
  if (score >= 45) return 'var(--conf-mid)';
  return 'var(--conf-low)';
}

/** Format ISO date string */
function formatTimestamp(iso) {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ─── Render Report Header ────────────────────────────────────────────────────
function renderReportHeader(report) {
  els.reportCompanyName.textContent = report.company || '—';

  // Lenses
  els.reportLensesDisplay.innerHTML = '';
  (report.lenses || []).forEach(lens => {
    els.reportLensesDisplay.appendChild(createLensBadge(lens));
  });

  // Timestamp
  els.reportTimestamp.textContent = report.generatedAt
    ? formatTimestamp(report.generatedAt)
    : '';
}

// ─── Render Signal Layer ─────────────────────────────────────────────────────
function renderSignalLayer(report, rawSignalMap) {
  const container = els.signalLayerContent;
  container.innerHTML = '';

  const lenses = report.lenses || [];

  lenses.forEach(lens => {
    const group = document.createElement('div');
    group.className = 'signal-lens-group';

    // Lens label
    const label = document.createElement('div');
    label.className = 'signal-lens-label';
    const dot = document.createElement('span');
    dot.className = 'signal-lens-dot';
    dot.style.background = LENS_COLORS[lens] || '#888';
    label.appendChild(dot);
    label.appendChild(document.createTextNode(lens));
    group.appendChild(label);

    // Articles — use raw signal map (actual fetched articles)
    const articles = (rawSignalMap && rawSignalMap[lens]) || [];
    const cards = document.createElement('div');
    cards.className = 'signal-cards';

    if (articles.length === 0) {
      const noData = document.createElement('div');
      noData.className = 'signal-no-data';
      noData.textContent = 'No signals retrieved for this lens';
      cards.appendChild(noData);
    } else {
      articles.forEach(article => {
        const card = document.createElement('div');
        card.className = 'signal-card';
        card.style.borderLeftColor = LENS_COLORS[lens] || '#888';

        card.innerHTML = `
          <div class="signal-headline">
            <a href="${esc(article.url)}" target="_blank" rel="noopener noreferrer">
              ${esc(article.headline)}
            </a>
          </div>
          <div class="signal-meta">
            <span class="signal-source">${esc(article.source)}</span>
            <span>·</span>
            <span>${esc(article.date)}</span>
          </div>
        `;
        cards.appendChild(card);
      });
    }

    group.appendChild(cards);
    container.appendChild(group);
  });
}

// ─── Render Insight Layer ────────────────────────────────────────────────────
function renderInsightLayer(report) {
  const container = els.insightLayerContent;
  container.innerHTML = '';

  const insights = report.insightLayer || [];

  if (insights.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:0.875rem;">No insights generated.</p>';
    return;
  }

  const cards = document.createElement('div');
  cards.className = 'insight-cards';

  insights.forEach(insight => {
    const primaryLens  = (insight.lenses || [])[0] || '';
    const borderColor  = LENS_COLORS[primaryLens] || 'var(--border-default)';
    const confScore    = Math.min(100, Math.max(0, parseInt(insight.confidence, 10) || 0));
    const confColor    = confidenceColor(confScore);

    const card = document.createElement('div');
    card.className = 'insight-card';
    card.style.borderLeftColor = borderColor;

    // Header
    const header = document.createElement('div');
    header.className = 'insight-card-header';

    const titleBlock = document.createElement('div');
    titleBlock.innerHTML = `
      <div class="insight-card-id">${esc(insight.id || '')}</div>
      <div class="insight-card-title">${esc(insight.title || '')}</div>
    `;

    const lensesBlock = document.createElement('div');
    lensesBlock.className = 'insight-card-lenses';
    (insight.lenses || []).forEach(l => lensesBlock.appendChild(createLensBadge(l)));

    header.appendChild(titleBlock);
    header.appendChild(lensesBlock);
    card.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'insight-card-body';

    const fields = [
      { label: 'Observation', value: insight.observation },
      { label: 'Mechanism',   value: insight.mechanism   },
      { label: 'Implication', value: insight.implication },
    ];

    fields.forEach(f => {
      const field = document.createElement('div');
      field.className = 'insight-field';
      field.innerHTML = `
        <div class="insight-field-label">${esc(f.label)}</div>
        <div class="insight-field-value">${esc(f.value || '—')}</div>
      `;
      body.appendChild(field);
    });

    // Confidence
    const confField = document.createElement('div');
    confField.className = 'insight-field confidence-wrapper';
    confField.innerHTML = `
      <div class="insight-field-label">Confidence</div>
      <div class="confidence-row">
        <span>Low</span>
        <span class="confidence-score" style="color:${confColor}">${confScore}%</span>
        <span>High</span>
      </div>
      <div class="confidence-bar-track">
        <div class="confidence-bar-fill"
             style="width:${confScore}%;background:${confColor}"></div>
      </div>
    `;
    body.appendChild(confField);

    // Watchpoint
    if (insight.watchpoint) {
      const wpField = document.createElement('div');
      wpField.className = 'insight-field watchpoint-field';
      wpField.innerHTML = `
        <div class="insight-field-label">Watchpoint</div>
        <div class="insight-field-value">${esc(insight.watchpoint)}</div>
      `;
      body.appendChild(wpField);
    }

    card.appendChild(body);

    // Deep Dive footer
    const footer = document.createElement('div');
    footer.className = 'insight-card-footer';
    const ddBtn = document.createElement('button');
    ddBtn.className = 'deep-dive-btn';
    ddBtn.textContent = 'Deep Dive →';
    ddBtn.setAttribute('aria-label', `Open deep dive for ${insight.title}`);
    ddBtn.addEventListener('click', () => openDeepDive('insight', insight));
    footer.appendChild(ddBtn);
    card.appendChild(footer);

    cards.appendChild(card);
  });

  container.appendChild(cards);
}

// ─── Render Outlook Layer ────────────────────────────────────────────────────
function renderOutlookLayer(report) {
  const container = els.outlookLayerContent;
  container.innerHTML = '';
  const outlook = report.outlookLayer || {};

  // Scenario cards
  const scenarios = document.createElement('div');
  scenarios.className = 'outlook-scenarios';

  const scenarioData = [
    { key: 'bearCase', label: 'Bear Case', cls: 'scenario-card--bear' },
    { key: 'baseCase', label: 'Base Case', cls: 'scenario-card--base' },
    { key: 'bullCase', label: 'Bull Case', cls: 'scenario-card--bull' },
  ];

  scenarioData.forEach(({ key, label, cls }) => {
    const card = document.createElement('div');
    card.className = `scenario-card ${cls}`;
    card.innerHTML = `
      <div class="scenario-label">${esc(label)}</div>
      <div class="scenario-text">${esc(outlook[key] || '—')}</div>
    `;
    scenarios.appendChild(card);
  });

  container.appendChild(scenarios);

  // Risk + Recommendation
  const bottom = document.createElement('div');
  bottom.className = 'outlook-bottom';

  const riskCard = document.createElement('div');
  riskCard.className = 'outlook-card outlook-card--risk';
  riskCard.innerHTML = `
    <div class="outlook-card-label">Primary Risk</div>
    <div class="outlook-card-text">${esc(outlook.primaryRisk || '—')}</div>
  `;

  const recCard = document.createElement('div');
  recCard.className = 'outlook-card outlook-card--rec';
  recCard.innerHTML = `
    <div class="outlook-card-label">Strategic Recommendation</div>
    <div class="outlook-card-text">${esc(outlook.strategicRecommendation || '—')}</div>
  `;

  bottom.appendChild(riskCard);
  bottom.appendChild(recCard);
  container.appendChild(bottom);

  // Deep Dive button for outlook
  const outlookDdRow = document.createElement('div');
  outlookDdRow.className = 'outlook-deep-dive-row';
  const outlookDdBtn = document.createElement('button');
  outlookDdBtn.className = 'deep-dive-btn';
  outlookDdBtn.textContent = 'Deep Dive →';
  outlookDdBtn.setAttribute('aria-label', 'Open deep dive for outlook scenarios');
  outlookDdBtn.addEventListener('click', () => openDeepDive('outlook', outlook));
  outlookDdRow.appendChild(outlookDdBtn);
  container.appendChild(outlookDdRow);

  // Parse error warning
  if (report._parseError) {
    const warn = document.createElement('div');
    warn.style.cssText = 'margin-top:16px;padding:12px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:6px;font-size:0.8125rem;color:#fbbf24;';
    warn.textContent = 'Note: Claude returned unexpected output. The report above may be incomplete. Raw output has been logged to the browser console.';
    container.appendChild(warn);
    console.warn('[SIE] Raw Claude output:', report._rawText);
  }
}

// ─── Deep Dive Panel ─────────────────────────────────────────────────────────

/**
 * Sets the visible state inside the deep dive panel body.
 * @param {'loading'|'error'|'report'} panelState
 */
function setPanelState(panelState) {
  els.ddpLoading.classList.add('hidden');
  els.ddpError.classList.add('hidden');
  els.ddpReport.classList.add('hidden');

  if (panelState === 'loading') els.ddpLoading.classList.remove('hidden');
  if (panelState === 'error')   els.ddpError.classList.remove('hidden');
  if (panelState === 'report')  els.ddpReport.classList.remove('hidden');
}

/**
 * Opens the deep dive panel, triggers fetch, renders the McKinsey-style report.
 * @param {'insight'|'outlook'} type
 * @param {object} data  — insight card object OR outlookLayer object
 */
async function openDeepDive(type, data) {
  if (!state.lastFormValues) return;
  if (state.deepDiveOpen) return;

  const { claudeKey, company, lenses, location } = state.lastFormValues;
  const signalMap = state.lastSignalMap || {};

  // Set panel header
  const panelTitle = type === 'insight'
    ? `${data.id} — ${data.title}`
    : 'Strategic Outlook Deep Dive';
  els.ddpTitle.textContent = panelTitle;

  els.ddpBadges.innerHTML = '';
  const badgeLenses = type === 'insight' ? (data.lenses || []) : lenses;
  badgeLenses.forEach(l => els.ddpBadges.appendChild(createLensBadge(l)));

  // Show location badge if not global
  if (location && location !== 'Global') {
    const locBadge = document.createElement('span');
    locBadge.className = 'lens-badge';
    locBadge.textContent = location;
    locBadge.style.color = 'var(--text-muted)';
    locBadge.style.borderColor = 'var(--border-strong)';
    els.ddpBadges.appendChild(locBadge);
  }

  // Open panel
  state.deepDiveOpen = true;
  els.deepDiveOverlay.classList.remove('hidden');
  els.deepDivePanel.classList.add('is-open');
  els.deepDivePanel.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  setPanelState('loading');
  els.ddpBody.scrollTop = 0;

  try {
    const report = await fetchDeepDive({ claudeKey, type, data, company, lenses, signalMap, location });
    renderDeepDiveReport(report, lenses);
    setPanelState('report');
  } catch (err) {
    const msg = err.message || '';
    if (msg === 'CLAUDE_401') {
      els.ddpErrorMessage.textContent = 'Invalid OpenAI API key. Please check your settings.';
    } else if (msg === 'CLAUDE_429') {
      els.ddpErrorMessage.textContent = 'Rate limit reached. Please wait 60 seconds and try again.';
    } else {
      els.ddpErrorMessage.textContent = `Deep dive failed: ${msg}`;
    }
    setPanelState('error');
    console.error('[SIE] Deep dive error:', err);
  }
}

/**
 * Closes the deep dive panel with slide-out animation.
 */
function closeDeepDive() {
  els.deepDivePanel.classList.remove('is-open');
  els.deepDivePanel.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  state.deepDiveOpen = false;

  // Hide overlay after CSS transition (320ms)
  setTimeout(() => {
    if (!state.deepDiveOpen) {
      els.deepDiveOverlay.classList.add('hidden');
    }
  }, 320);
}

/**
 * Renders the McKinsey-style deep dive report into the panel.
 * @param {object} report   — structured deep dive JSON from GPT-4o
 * @param {string[]} lenses — active lenses (for situationAnalysis iteration)
 */
function renderDeepDiveReport(report, lenses) {
  // Executive Summary
  els.ddpExecSummary.textContent = report.executiveSummary || '—';

  // Situation Analysis — one block per lens
  els.ddpSituation.innerHTML = '';
  const situationData = report.situationAnalysis || {};
  lenses.forEach(lens => {
    const text = situationData[lens];
    if (!text) return;

    const item = document.createElement('div');
    item.className = 'ddp-situation-item';
    item.style.borderLeftColor = LENS_COLORS[lens] || 'var(--border-default)';

    const lensLabel = document.createElement('div');
    lensLabel.className = 'ddp-situation-lens';
    lensLabel.textContent = lens;
    lensLabel.style.color = LENS_COLORS[lens] || 'var(--text-muted)';

    const lensText = document.createElement('div');
    lensText.className = 'ddp-situation-text';
    lensText.textContent = text;

    item.appendChild(lensLabel);
    item.appendChild(lensText);
    els.ddpSituation.appendChild(item);
  });

  // Key Findings
  els.ddpFindings.innerHTML = '';
  (report.keyFindings || []).forEach(finding => {
    const li = document.createElement('li');
    li.textContent = finding;
    els.ddpFindings.appendChild(li);
  });

  // Market Implications
  els.ddpImplications.innerHTML = '';
  (report.marketImplications || []).forEach(item => {
    const block = document.createElement('div');
    block.className = 'ddp-implication-item';

    const theme = document.createElement('div');
    theme.className = 'ddp-implication-theme';
    theme.textContent = item.theme || '';

    const analysis = document.createElement('div');
    analysis.className = 'ddp-implication-text';
    analysis.textContent = item.analysis || '';

    block.appendChild(theme);
    block.appendChild(analysis);
    els.ddpImplications.appendChild(block);
  });

  // Signal Strength
  const ssAssessment = (report.signalStrength?.assessment || 'Emerging').trim();
  els.ddpSignalStrengthBadge.textContent = ssAssessment;
  els.ddpSignalStrengthBadge.className = `ddp-ss-badge ddp-ss-${ssAssessment.toLowerCase()}`;
  els.ddpSignalStrengthRationale.textContent = report.signalStrength?.rationale || '—';

  // Watchlist
  els.ddpWatchlist.innerHTML = '';
  (report.watchlist || []).forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    els.ddpWatchlist.appendChild(li);
  });
}

// Deep dive event listeners
els.deepDiveClose.addEventListener('click', closeDeepDive);
els.deepDiveOverlay.addEventListener('click', closeDeepDive);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && state.deepDiveOpen) closeDeepDive();
});

// ─── Main renderReport ───────────────────────────────────────────────────────
function renderReport(report, rawSignalMap) {
  renderReportHeader(report);
  renderSignalLayer(report, rawSignalMap);
  renderInsightLayer(report);
  renderOutlookLayer(report);
}

// ─── Offline Detection ───────────────────────────────────────────────────────
function updateOnlineStatus() {
  if (!navigator.onLine) {
    els.offlineBanner.classList.remove('hidden');
  } else {
    els.offlineBanner.classList.add('hidden');
  }
}

window.addEventListener('online',  updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// ─── Init ────────────────────────────────────────────────────────────────────
function init() {
  loadSettings();
  setReportState('idle');

  // Auto-open settings if keys are missing
  const { claudeKey, newsKey } = getSettings();
  if (!claudeKey || !newsKey) {
    openSettings();
  }

  // Enter key on company input triggers generate
  els.companyInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') generateReport();
  });

  console.log('[SIE] Strategic Insight Engine initialized');
}

init();
