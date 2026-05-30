const grid = document.getElementById('grid');
const loading = document.getElementById('loading');
const count = document.getElementById('count');
const fetchTime = document.getElementById('fetchTime');
const refreshBtn = document.getElementById('refreshBtn');
const countryBtns = document.querySelectorAll('.nav-btn');
const sectionFilter = document.getElementById('sectionFilter');
const sourceFilter = document.getElementById('sourceFilter');
const searchInput = document.getElementById('searchInput');
const quickLinks = document.getElementById('quickLinks');
const modal = document.getElementById('modal');
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const modalClose = document.getElementById('modalClose');
const commodityTicker = document.getElementById('commodityTicker');
const dieselGrid = document.getElementById('dieselGrid');
const commoditiesDetail = document.getElementById('commoditiesDetail');
const aiSection = document.getElementById('aiSection');
const aiGrid = document.getElementById('aiGrid');
const aiLoading = document.getElementById('aiLoading');
const aiSearch = document.getElementById('aiSearch');
const aiSourceFilter = document.getElementById('aiSourceFilter');
const usmSection = document.getElementById('usmSection');
const usmTimestamp = document.getElementById('usmTimestamp');

const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const settingsOverlay = document.getElementById('settingsOverlay');
const settingsClose = document.getElementById('settingsClose');
const aiStatus = document.getElementById('aiStatus');
const skillFile = document.getElementById('skillFile');
const uploadArea = document.getElementById('uploadArea');
const skillFileName = document.getElementById('skillFileName');
const skillPreview = document.getElementById('skillPreview');

const aiApiKey = document.getElementById('aiApiKey');
const testBtn = document.getElementById('testBtn');
const saveBtn = document.getElementById('saveBtn');
const clearBtn = document.getElementById('clearBtn');
const testResult = document.getElementById('testResult');
const providerCards = document.querySelectorAll('.provider-card');

const skillTextarea = document.getElementById('skillTextarea');
const skillSaveBtn = document.getElementById('skillSaveBtn');
const skillClearBtn = document.getElementById('skillClearBtn');
const skillSaved = document.getElementById('skillSaved');
const skillDownloadBtn = document.getElementById('skillDownloadBtn');

let articles = [];
let currentCountry = 'all';
let selectedProvider = 'deepseek';
let skillContent = '';

const PROVIDER_NAMES = {
  deepseek: 'DeepSeek',
  gemini: 'Gemini',
  qwen: 'Qwen',
  claude: 'Claude',
};

/* ── Time helpers ── */

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

/* ── Render ── */

function render() {
  const section = sectionFilter.value;
  const src = sourceFilter.value;
  const q = searchInput.value.toLowerCase();

  let filtered = articles.filter(a => {
    if (currentCountry !== 'all' && a.country !== currentCountry) return false;
    if (section !== 'all' && a.category !== section) return false;
    if (src !== 'all' && a.source !== src) return false;
    if (q && !a.title.toLowerCase().includes(q) && !a.description.toLowerCase().includes(q)) return false;
    return true;
  });

  count.textContent = `${filtered.length} article${filtered.length === 1 ? '' : 's'}`;

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="loading" style="display:flex;grid-column:1/-1">No articles match your filters.</div>';
    return;
  }

  grid.innerHTML = filtered.map(item => {
    const cc = item.country;
    return `
      <div class="card">
        <div class="card-top">
          <span class="card-country ${cc}">${cc}</span>
          <span class="card-source">${item.source}</span>
        </div>
        <span class="card-category">${item.category}</span>
        <h2 class="card-title">
          <a href="${item.link}" target="_blank" rel="noopener">${item.title}</a>
        </h2>
        <p class="card-desc">${item.description || ''}</p>
        <div class="card-bottom">
          <span class="card-time">${timeAgo(item.pubDate)}</span>
          <button class="btn-analyze" data-id="${item.id}">Analyse</button>
        </div>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.btn-analyze').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const item = articles.find(a => a.id === btn.dataset.id);
      if (item) openAnalyse(item);
    });
  });
}

/* ── Load news ── */

async function load() {
  loading.style.display = 'flex';
  try {
    const params = new URLSearchParams({ country: currentCountry });
    if (sectionFilter.value !== 'all') params.set('category', sectionFilter.value);
    if (sourceFilter.value !== 'all') params.set('source', sourceFilter.value);
    if (searchInput.value) params.set('q', searchInput.value);
    const res = await fetch(`/api/news?${params}`);
    const data = await res.json();
    articles = data.articles;
    fetchTime.textContent = `Updated ${timeAgo(data.lastFetch)}`;
    render();
  } catch {
    grid.innerHTML = '<div class="loading" style="display:flex;grid-column:1/-1">Failed to load news.</div>';
  } finally {
    loading.style.display = 'none';
  }
}

/* ── Load filters ── */

async function loadFilters() {
  try {
    const srcs = await (await fetch('/api/sources')).json();
    const all = [...new Set(Object.values(srcs).flat())].sort();
    sourceFilter.innerHTML = '<option value="all">All Sources</option>' + all.map(s => `<option value="${s}">${s}</option>`).join('');
  } catch {}
}

/* ── Commodities ── */

async function loadCommodities() {
  try {
    const data = await (await fetch('/api/commodities')).json();
    commodityTicker.innerHTML = data.map(i => `
      <div class="commodity-item" ${i.ref ? `title="${i.ref}"` : ''}>
        <span class="sym">${i.symbol}</span>
        <span class="pr">${i.price}</span>
        <span class="ch ${i.change.startsWith('+') ? 'up' : 'dn'}">${i.changePct}</span>
        ${i.ref ? '<span class="ref">ⓘ</span>' : ''}
      </div>
    `).join('');
  } catch {}
}

async function loadDiesel() {
  try {
    const data = await (await fetch('/api/diesel?country=all')).json();
    const all = [...(data.malaysia || []), ...(data.indonesia || [])];
    dieselGrid.innerHTML = all.map(i => `
      <div class="diesel-item"><span class="fuel">${i.fuel}</span><span class="price">${i.price}</span></div>
    `).join('');
  } catch {}
}

/* ── AI Config (per-provider keys) ── */

function getProviderKey(provider) {
  return localStorage.getItem(`nusantara_key_${provider}`) || '';
}

function setProviderKey(provider, key) {
  localStorage.setItem(`nusantara_key_${provider}`, key);
}

function getSelectedProvider() {
  return localStorage.getItem('nusantara_ai_provider') || 'deepseek';
}

function setSelectedProvider(provider) {
  localStorage.setItem('nusantara_ai_provider', provider);
}

function getProviderStatus(provider) {
  return localStorage.getItem(`nusantara_status_${provider}`) || '';
}

function setProviderStatus(provider, status) {
  localStorage.setItem(`nusantara_status_${provider}`, status);
}

function loadSkill() {
  return localStorage.getItem('nusantara_ai_skill') || '';
}

function saveSkill(content) {
  localStorage.setItem('nusantara_ai_skill', content);
}

function updateAiStatus() {
  const p = getSelectedProvider();
  const key = getProviderKey(p);
  const on = key.length > 0;
  aiStatus.textContent = on ? `AI ● ${PROVIDER_NAMES[p] || p}` : 'AI ○';
  aiStatus.className = `ai-status ${on ? 'on' : 'off'}`;
}

function setActiveProvider(p) {
  selectedProvider = p;
  providerCards.forEach(c => {
    c.classList.toggle('active', c.dataset.provider === p);
    const dot = c.querySelector('.provider-dot');
    if (dot) {
      const status = getProviderStatus(c.dataset.provider);
      dot.style.background = status === 'connected' ? '#22c55e' : '';
    }
  });
}

function loadProviderKey() {
  const key = getProviderKey(selectedProvider);
  aiApiKey.value = key;
  testResult.textContent = '';
  testResult.className = 'test-result';
}

/* ── Settings modal ── */

function openSettings() {
  selectedProvider = getSelectedProvider();
  setActiveProvider(selectedProvider);
  loadProviderKey();

  skillContent = loadSkill();
  skillTextarea.value = skillContent;
  skillSaved.textContent = '';
  skillSaved.className = 'test-result';
  if (skillContent) {
    skillFileName.textContent = 'skill.md (loaded from storage)';
    skillFileName.classList.add('show');
    skillPreview.textContent = skillContent.slice(0, 500) + (skillContent.length > 500 ? '…' : '');
    skillPreview.classList.add('show');
    skillDownloadBtn.style.display = '';
  } else {
    skillFileName.classList.remove('show');
    skillPreview.classList.remove('show');
    skillDownloadBtn.style.display = 'none';
  }
  settingsModal.classList.add('show');
  settingsOverlay.classList.add('show');
}

function closeSettings() {
  settingsModal.classList.remove('show');
  settingsOverlay.classList.remove('show');
}

settingsBtn.addEventListener('click', openSettings);
settingsClose.addEventListener('click', closeSettings);
settingsOverlay.addEventListener('click', closeSettings);

providerCards.forEach(card => {
  card.addEventListener('click', () => {
    const prov = card.dataset.provider;
    setActiveProvider(prov);
    loadProviderKey();
  });
});

aiApiKey.addEventListener('input', () => {
  testResult.textContent = '';
  testResult.className = 'test-result';
});

saveBtn.addEventListener('click', () => {
  const key = aiApiKey.value.trim();
  if (!key) {
    testResult.textContent = 'Enter an API key first.';
    testResult.className = 'test-result error';
    return;
  }
  setProviderKey(selectedProvider, key);
  const status = getProviderStatus(selectedProvider);
  if (status === 'connected') {
    testResult.textContent = '✓ Key saved';
    testResult.className = 'test-result success';
  } else {
    testResult.textContent = 'Key saved. Test connection to verify.';
    testResult.className = 'test-result';
  }
  updateAiStatus();
  refreshProviderDots();
});

clearBtn.addEventListener('click', () => {
  setProviderKey(selectedProvider, '');
  setProviderStatus(selectedProvider, '');
  aiApiKey.value = '';
  testResult.textContent = 'Key cleared';
  testResult.className = 'test-result';
  updateAiStatus();
  refreshProviderDots();
});

testBtn.addEventListener('click', async () => {
  const key = aiApiKey.value.trim();
  if (!key) {
    testResult.textContent = 'Enter an API key first.';
    testResult.className = 'test-result error';
    return;
  }
  testResult.textContent = 'Testing…';
  testResult.className = 'test-result';
  testBtn.disabled = true;
  testBtn.textContent = 'Testing…';
  try {
    const r = await fetch('/api/ai-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: selectedProvider, apiKey: key }),
    });
    const data = await r.json();
    if (data.connected) {
      setProviderKey(selectedProvider, key);
      setProviderStatus(selectedProvider, 'connected');
      testResult.textContent = '✓ Connected successfully';
      testResult.className = 'test-result success';
      updateAiStatus();
      refreshProviderDots();
    } else {
      setProviderStatus(selectedProvider, 'error');
      testResult.textContent = `✗ ${data.error || 'Connection failed'}`;
      testResult.className = 'test-result error';
      refreshProviderDots();
    }
  } catch {
    setProviderStatus(selectedProvider, 'error');
    testResult.textContent = '✗ Network error';
    testResult.className = 'test-result error';
    refreshProviderDots();
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = 'Test Connection';
  }
});

function refreshProviderDots() {
  providerCards.forEach(c => {
    const dot = c.querySelector('.provider-dot');
    if (!dot) return;
    const status = getProviderStatus(c.dataset.provider);
    if (status === 'connected') dot.style.background = '#22c55e';
    else if (status === 'error') dot.style.background = '#ef4444';
    else dot.style.background = '';
  });
}

/* ── Analyst Instructions ── */

skillSaveBtn.addEventListener('click', () => {
  const text = skillTextarea.value.trim();
  if (!text) {
    skillSaved.textContent = 'Enter instructions first.';
    skillSaved.className = 'test-result error';
    return;
  }
  skillContent = text;
  saveSkill(text);
  skillSaved.textContent = '✓ Instructions saved';
  skillSaved.className = 'test-result success';
  skillFileName.textContent = 'skill.md';
  skillFileName.classList.add('show');
  skillPreview.textContent = text.slice(0, 500) + (text.length > 500 ? '…' : '');
  skillPreview.classList.add('show');
  skillDownloadBtn.style.display = '';
});

skillClearBtn.addEventListener('click', () => {
  skillContent = '';
  saveSkill('');
  skillTextarea.value = '';
  skillSaved.textContent = 'Instructions cleared';
  skillSaved.className = 'test-result';
  skillFileName.classList.remove('show');
  skillPreview.classList.remove('show');
  skillDownloadBtn.style.display = 'none';
});

skillDownloadBtn.addEventListener('click', () => {
  const content = loadSkill();
  if (!content) return;
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'skill.md';
  a.click();
  URL.revokeObjectURL(url);
});

uploadArea.addEventListener('dragover', e => {
  e.preventDefault();
  uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));

uploadArea.addEventListener('drop', e => {
  e.preventDefault();
  uploadArea.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) readSkillFile(file);
});

skillFile.addEventListener('change', () => {
  if (skillFile.files[0]) readSkillFile(skillFile.files[0]);
});

function readSkillFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    skillContent = reader.result;
    skillTextarea.value = skillContent;
    skillSaved.textContent = '';
    skillSaved.className = 'test-result';
    skillFileName.textContent = file.name;
    skillFileName.classList.add('show');
    skillPreview.textContent = skillContent.slice(0, 500) + (skillContent.length > 500 ? '…' : '');
    skillPreview.classList.add('show');
    saveSkill(skillContent);
    skillDownloadBtn.style.display = '';
  };
  reader.readAsText(file);
}

/* ── Analysis modal ── */

function openAnalyse(item) {
  const provider = getSelectedProvider();
  const apiKey = getProviderKey(provider);
  const skill = loadSkill();
  const label = PROVIDER_NAMES[provider] || provider;

  if (!apiKey) {
    modalTitle.textContent = 'AI Analysis';
    modalBody.innerHTML = `
      <div style="text-align:center;padding:20px 0">
        <p style="color:var(--muted);margin-bottom:12px">No AI provider configured.</p>
        <p style="font-size:13px;color:var(--muted)">Add your API key in the <strong>AI Providers</strong> sidebar.</p>
      </div>
    `;
    modal.classList.add('show');
    modalOverlay.classList.add('show');
    return;
  }

  modalTitle.textContent = `Analysis by ${label}`;
  modalBody.innerHTML = `<div class="analysis-loading"><div class="spinner"></div> Analysing with ${label}…</div>`;
  modal.classList.add('show');
  modalOverlay.classList.add('show');

  fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: item.title,
      description: item.description,
      provider,
      apiKey,
      skill,
    }),
  })
    .then(r => r.json())
    .then(data => {
      if (data.error) {
        modalBody.innerHTML = `<p style="color:var(--red)">${data.error}</p>`;
        return;
      }
      modalBody.innerHTML = `
        <div class="analysis-result">
          <h3>Summary</h3>
          <p>${data.summary || data.raw || '—'}</p>
          <h3>Sentiment
            <span class="sentiment-badge ${data.sentiment || 'neutral'}">${data.sentiment || 'neutral'}</span>
          </h3>
          ${data.impact ? `<p style="margin-top:8px">Impact: <span class="impact-badge">${data.impact}</span></p>` : ''}
          ${data.key_points?.length ? `
            <h3>Key Points</h3>
            <ul>${data.key_points.map(p => `<li>${p}</li>`).join('')}</ul>
          ` : ''}
          <h3>Original</h3>
          <p style="color:var(--muted);font-size:13px"><strong>${item.title}</strong><br>${item.description || ''}</p>
        </div>
      `;
    })
    .catch(() => {
      modalBody.innerHTML = '<p style="color:var(--red)">Analysis failed. Check your API key.</p>';
    });
}

function closeModal() {
  modal.classList.remove('show');
  modalOverlay.classList.remove('show');
}

modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', closeModal);

/* ── Country tabs + Commodities view ── */

let currentView = 'news';

countryBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.view === 'commodities') {
      currentView = 'commodities';
      countryBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      grid.style.display = 'none';
      loading.style.display = 'none';
      commoditiesDetail.style.display = 'grid';
      aiSection.style.display = 'none';
      document.querySelector('.toolbar').style.display = 'none';
      document.querySelector('.ticker-bars').style.display = 'none';
      loadCommoditiesDetail();
      return;
    }

    if (btn.dataset.view === 'ai') {
      currentView = 'ai';
      countryBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      grid.style.display = 'none';
      loading.style.display = 'none';
      commoditiesDetail.style.display = 'none';
      usmSection.style.display = 'none';
      aiSection.style.display = '';
      document.querySelector('.toolbar').style.display = 'none';
      document.querySelector('.ticker-bars').style.display = 'none';
      loadAiNews();
      return;
    }

    if (btn.dataset.view === 'us-markets') {
      currentView = 'us-markets';
      countryBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      grid.style.display = 'none';
      loading.style.display = 'none';
      commoditiesDetail.style.display = 'none';
      aiSection.style.display = 'none';
      usmSection.style.display = 'grid';
      document.querySelector('.toolbar').style.display = 'none';
      document.querySelector('.ticker-bars').style.display = 'none';
      loadUsMarkets();
      return;
    }

    if (currentView === 'commodities' || currentView === 'ai' || currentView === 'us-markets') {
      currentView = 'news';
      grid.style.display = '';
      commoditiesDetail.style.display = 'none';
      aiSection.style.display = 'none';
      document.querySelector('.toolbar').style.display = '';
      document.querySelector('.ticker-bars').style.display = '';
    }

    countryBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentCountry = btn.dataset.country;
    sectionFilter.value = 'all';
    sourceFilter.value = 'all';
    searchInput.value = '';
    load();
  });
});

/* ── Load commodities detail ── */

async function loadCommoditiesDetail() {
  commoditiesDetail.innerHTML = '<div class="loading" style="display:flex;grid-column:1/-1"><div class="spinner"></div> Loading commodities…</div>';
  try {
    const data = await (await fetch('/api/commodities-detail')).json();
    const sections = [
      { key: 'coal', icon: '⛏' },
      { key: 'nickel', icon: '🔩' },
      { key: 'tin', icon: '🔩' },
      { key: 'gold', icon: '🥇' },
      { key: 'silver', icon: '🥈' },
      { key: 'energy', icon: '⚡' },
      { key: 'dieselMY', icon: '⛽' },
      { key: 'dieselID', icon: '⛽' },
    ];

    commoditiesDetail.innerHTML = `
      <div class="cd-timestamp" style="grid-column:1/-1">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Data fetched: ${data.lastUpdated}
      </div>
      ${sections.map(s => {
      const sec = data[s.key];
      if (!sec) return '';
      return `
        <div class="cd-card">
          <div class="cd-header">
            <div class="cd-header-text">
              <h3>${sec.title}</h3>
              <p>${sec.subtitle}</p>
            </div>
            ${sec.ref ? `<span class="cd-ref">${sec.ref}</span>` : ''}
          </div>
          <table class="cd-table">
            <thead>
              <tr>
                <th>Grade</th>
                <th style="text-align:right">Price</th>
                <th style="text-align:right">Change</th>
              </tr>
            </thead>
            <tbody>
              ${sec.items.map(i => {
                const isUp = i.change.startsWith('+');
                return `
                  <tr>
                    <td>
                      <span class="cd-grade">${i.grade}</span><br>
                      <span class="cd-spec">${i.spec}</span>
                    </td>
                    <td style="text-align:right">
                      <span class="cd-price">${i.price}</span>
                      <span class="cd-unit">${i.unit}</span>
                    </td>
                    <td style="text-align:right">
                      <span class="cd-change ${isUp ? 'up' : 'dn'}">${i.change}</span>
                      <span class="cd-change-pct">${i.changePct}</span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }).join('')}
    `;
  } catch {
    commoditiesDetail.innerHTML = '<div class="loading" style="display:flex;grid-column:1/-1">Failed to load commodities data.</div>';
  }
}

/* ── AI News ── */

async function loadAiSources() {
  try {
    const srcs = await (await fetch('/api/ai-sources')).json();
    aiSourceFilter.innerHTML = '<option value="all">All Sources</option>' + srcs.map(s => `<option value="${s}">${s}</option>`).join('');
  } catch {}
}

async function loadAiNews() {
  aiLoading.style.display = 'flex';
  aiGrid.innerHTML = '';
  try {
    const params = new URLSearchParams();
    if (aiSourceFilter.value !== 'all') params.set('source', aiSourceFilter.value);
    if (aiSearch.value) params.set('q', aiSearch.value);
    const res = await fetch(`/api/ai-news?${params}`);
    const data = await res.json();
    const articles = data.articles;
    aiLoading.style.display = 'none';

    if (articles.length === 0) {
      aiGrid.innerHTML = '<div class="loading" style="display:flex;grid-column:1/-1">No AI articles match your filters.</div>';
      return;
    }

    aiGrid.innerHTML = articles.map(item => `
      <div class="card">
        <div class="card-top">
          <span class="card-source">${item.source}</span>
        </div>
        <span class="card-category">AI</span>
        <h2 class="card-title">
          <a href="${item.link}" target="_blank" rel="noopener">${item.title}</a>
        </h2>
        <p class="card-desc">${item.description || ''}</p>
        <div class="card-bottom">
          <span class="card-time">${timeAgo(item.pubDate)}</span>
          <span style="color:var(--muted-light);font-size:11px">${item.source}</span>
        </div>
      </div>
    `).join('');
  } catch {
    aiLoading.style.display = 'none';
    aiGrid.innerHTML = '<div class="loading" style="display:flex;grid-column:1/-1">Failed to load AI news.</div>';
  }
}

aiSourceFilter.addEventListener('change', loadAiNews);
aiSearch.addEventListener('input', debounce(loadAiNews, 300));

/* ── US Markets ── */

async function loadUsMarkets() {
  usmSection.innerHTML = '<div class="loading" style="display:flex;grid-column:1/-1"><div class="spinner"></div> Loading US markets data…</div>';
  try {
    const data = await (await fetch('/api/us-markets')).json();
    const sections = [
      { key: 'equities', icon: '📈' },
      { key: 'rates', icon: '💰' },
      { key: 'inflation', icon: '📊' },
      { key: 'labor', icon: '👷' },
      { key: 'gdp', icon: '🏭' },
    ];

    usmSection.innerHTML = `
      <div class="cd-timestamp" style="grid-column:1/-1">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Data as of: ${data.lastUpdated}
      </div>
      ${sections.map(s => {
      const sec = data[s.key];
      if (!sec) return '';
      return `
        <div class="cd-card">
          <div class="cd-header">
            <div class="cd-header-text">
              <h3>${sec.title}</h3>
              <p>${sec.subtitle}</p>
            </div>
            ${sec.ref ? `<span class="cd-ref">${sec.ref}</span>` : ''}
          </div>
          <table class="cd-table">
            <thead>
              <tr>
                <th>Indicator</th>
                <th style="text-align:right">Value</th>
                <th style="text-align:right">Change</th>
              </tr>
            </thead>
            <tbody>
              ${sec.items.map(i => {
                const isUp = !i.change.startsWith('—') && !i.change.startsWith('-0.') && i.change.startsWith('+');
                return `
                  <tr${i.ref ? ` title="${i.ref}"` : ''}>
                    <td>
                      <span class="cd-grade">${i.grade}</span><br>
                      <span class="cd-spec">${i.spec}</span>
                    </td>
                    <td style="text-align:right">
                      <span class="cd-price">${i.price}</span>
                      ${i.unit ? `<span class="cd-unit">${i.unit}</span>` : ''}
                    </td>
                    <td style="text-align:right">
                      <span class="cd-change ${isUp ? 'up' : 'dn'}">${i.change}</span>
                      <span class="cd-change-pct">${i.changePct}</span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }).join('')}
    `;
  } catch {
    usmSection.innerHTML = '<div class="loading" style="display:flex;grid-column:1/-1">Failed to load US markets data.</div>';
  }
}

/* ── Filter events ── */

sectionFilter.addEventListener('change', () => {
  quickLinks.querySelectorAll('.ql-btn').forEach(b => b.classList.toggle('active', b.dataset.section === sectionFilter.value));
  load();
});

sourceFilter.addEventListener('change', load);
searchInput.addEventListener('input', debounce(load, 300));

refreshBtn.addEventListener('click', () => {
  loadCommodities();
  loadDiesel();
  if (currentView === 'commodities') loadCommoditiesDetail();
  else if (currentView === 'ai') loadAiNews();
  else if (currentView === 'us-markets') loadUsMarkets();
  else load();
});

quickLinks.addEventListener('click', e => {
  const btn = e.target.closest('.ql-btn');
  if (!btn) return;
  quickLinks.querySelectorAll('.ql-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  sectionFilter.value = btn.dataset.section;
  load();
});

/* ── Debounce ── */

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/* ── Init ── */

updateAiStatus();
refreshProviderDots();
loadFilters();
loadAiSources();
loadCommodities();
loadDiesel();
load();
setInterval(() => {
  if (currentView === 'commodities') loadCommoditiesDetail();
  else if (currentView === 'ai') loadAiNews();
  else if (currentView === 'us-markets') loadUsMarkets();
  else load();
}, 5 * 60 * 1000);
