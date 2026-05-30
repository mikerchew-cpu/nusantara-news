import express from 'express';
import Parser from 'rss-parser';

const app = express();
const PORT = process.env.PORT || 3456;
const parser = new Parser();

app.use(express.json());

const FEEDS = {
  malaysia: [
    { url: 'https://www.bernama.com/feed/index.php', name: 'Bernama' },
    { url: 'https://www.malaymail.com/feed/rss', name: 'Malay Mail' },
    { url: 'https://www.thestar.com.my/rss/News/Nation', name: 'The Star' },
    { url: 'https://www.theedgemarkets.com/rss.xml', name: 'The Edge' },
    { url: 'https://www.nst.com.my/feed', name: 'NST' },
    { url: 'https://www.freemalaysiatoday.com/feed/', name: 'FMT' },
  ],
  indonesia: [
    { url: 'https://rss.kompas.com/', name: 'Kompas' },
    { url: 'https://rss.detik.com/', name: 'Detik' },
    { url: 'https://www.cnbcindonesia.com/rss', name: 'CNBC Indo' },
    { url: 'https://www.kontan.co.id/rss', name: 'Kontan' },
    { url: 'https://www.antaranews.com/rss', name: 'Antara' },
  ],
  singapore: [
    { url: 'https://www.channelnewsasia.com/api/latest/rss', name: 'CNA' },
    { url: 'https://www.straitstimes.com/news/singapore/rss.xml', name: 'Straits Times' },
    { url: 'https://www.businesstimes.com.sg/rss', name: 'BT SG' },
  ],
};

const CATEGORY_RULES = [
  { cat: 'Politics', test: /\b(politic|umno|pakatan|bn|pn|parliament|election|minister|mca|bersatu|dap|presiden|jokowi|prabowo|demokrasi|golkar|pdi|pilkada|legislative|senate|mpr|dpr|kabinet)\b/i },
  { cat: 'Economy', test: /\b(economy|gdp|inflation|ringgit|rupiah|bnm|bi|opr|suku bunga|trade|export|import|fdi|budget|anggaran|pajak|fiskal|moneter)\b/i },
  { cat: 'Finance', test: /\b(finance|market|stock|klse|idx|ihsg|ipo|corporate|bank|investasi|saham|obligasi|reksadana|finansial)\b/i },
  { cat: 'AI', test: /\b(ai|artificial intelligence|machine learning|deep learning|llm|gpt|neural network|chatbot|openai|claude|gemini|deepseek|qwen|anthropic|ai model|ai agent|ai safety|agi|transformer|diffusion)\b/i },
  { cat: 'Technology', test: /\b(tech|digital|semiconductor|data.?centre|5g|startup|cyber|innovation|teknologi|digital)\b/i },
  { cat: 'Mining', test: /\b(mining|tambang|coal|batu bara|nickel|nikel|tin|timah|bauxit|bauksit|smelter|smelting|mineral|ore)\b/i },
  { cat: 'Commodities', test: /\b(commodity|harga|price|cp0|crude|palm oil|sawit|karet|rubber|gas|energy|komoditas)\b/i },
  { cat: 'Energy', test: /\b(energy|diesel|solar|bbm|pertamina|petrol|fuel|subsidi|bensin|minyak|gas|listrik|pln)\b/i },
  { cat: 'East Malaysia', test: /\b(sabah|sarawak|east malaysia|kuching|kota kinabalu|swak)\b/i },
];

function categorize(title, cats) {
  const text = `${title || ''} ${(cats || []).join(' ')}`;
  for (const rule of CATEGORY_RULES) {
    if (rule.test.test(text)) return rule.cat;
  }
  return 'General';
}

function extractImage(item) {
  try {
    if (item['media:content']?.$.url) return item['media:content'].$.url;
    if (item['media:thumbnail']?.$.url) return item['media:thumbnail'].$.url;
    if (item.enclosure?.url) return item.enclosure.url;
  } catch {}
  return null;
}

let cache = { articles: [], lastFetch: null };
let fetchPromise = null;

async function fetchAll() {
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    const all = [];

    for (const [country, feeds] of Object.entries(FEEDS)) {
      for (const feedDef of feeds) {
        try {
          const feed = await parser.parseURL(feedDef.url);
          const items = (feed.items || []).slice(0, 20).map(item => ({
            id: item.guid || item.link || `${feedDef.name}-${Math.random().toString(36).slice(2, 8)}`,
            title: item.title || 'Untitled',
            link: item.link || '#',
            description: (item.contentSnippet || item.content || '').slice(0, 300),
            pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
            source: feedDef.name,
            country,
            category: categorize(item.title, item.categories),
            image: extractImage(item),
          }));
          all.push(...items);
        } catch {
          // skip unreachable feeds
        }
      }
    }

    const seen = new Set();
    const deduped = [];
    for (const item of all) {
      const key = `${item.country}:${item.title.toLowerCase().slice(0, 80)}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(item);
      }
    }

    deduped.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    cache = { articles: deduped.slice(0, 200), lastFetch: new Date().toISOString() };
    console.log(`Fetched ${cache.articles.length} articles`);
  })();

  try {
    await fetchPromise;
  } finally {
    fetchPromise = null;
  }
}

async function ensureCache() {
  if (cache.articles.length === 0) await fetchAll();
}

app.get('/api/news', async (req, res) => {
  await ensureCache();
  let result = cache.articles;
  const { country, category, source, q } = req.query;

  if (country && country !== 'all') result = result.filter(a => a.country === country);
  if (category && category !== 'all') result = result.filter(a => a.category === category);
  if (source && source !== 'all') result = result.filter(a => a.source === source);
  if (q) {
    const query = q.toLowerCase();
    result = result.filter(a =>
      a.title.toLowerCase().includes(query) ||
      a.description.toLowerCase().includes(query)
    );
  }

  res.json({
    articles: result,
    total: cache.articles.length,
    filtered: result.length,
    lastFetch: cache.lastFetch,
  });
});

app.get('/api/sources', async (_, res) => {
  await ensureCache();
  const out = {};
  for (const [country, feeds] of Object.entries(FEEDS)) {
    out[country] = feeds.map(f => f.name);
  }
  res.json(out);
});

app.get('/api/categories', async (_, res) => {
  await ensureCache();
  const cats = [...new Set(cache.articles.map(a => a.category))].sort();
  res.json(cats);
});

app.get('/api/commodities', (_, res) => {
  res.json([
    { name: 'Coal ICI 3 (Argus/Coalindo)', symbol: 'ICI 3', price: '79.07', unit: 'USD/ton', change: '+1.34', changePct: '+1.72%', ref: 'Argus/Coalindo Indonesian Coal Index · 30 Apr 2026' },
    { name: 'Coal ICI 4 (Argus/Coalindo)', symbol: 'ICI 4', price: '61.82', unit: 'USD/ton', change: '+0.97', changePct: '+1.59%', ref: 'Argus/Coalindo Indonesian Coal Index · 30 Apr 2026' },
    { name: 'Nickel (LME)', symbol: 'NI', price: '18,955', unit: 'USD/ton', change: '-136', changePct: '-0.71%', ref: 'LME 3-month · 29 May 2026' },
    { name: 'Tin (LME)', symbol: 'SN', price: '55,079', unit: 'USD/ton', change: '+685', changePct: '+1.26%', ref: 'LME 3-month · 28 May 2026' },
    { name: 'Brent Crude', symbol: 'BZ', price: '95.47', unit: 'USD/bbl', change: '-1.64', changePct: '-1.69%', ref: 'ICE · 28 May 2026' },
    { name: 'CPO (FCPO)', symbol: 'FCPO', price: '4,473', unit: 'MYR/ton', change: '+15', changePct: '+0.34%', ref: 'Bursa Malaysia · 26 May 2026' },
  ]);
});

app.get('/api/commodities-detail', (_, res) => {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur' });
  res.json({
    lastUpdated: `${dateStr} · ${timeStr} MYT`,
    coal: {
      title: 'Indonesian Coal Index (ICI)',
      subtitle: 'Argus/Coalindo — FOB Kalimantan',
      ref: 'argusmedia.com · coalindoenergy.com',
      items: [
        { grade: 'ICI 1', spec: 'GAR 6,500 kcal/kg', price: '120.99', unit: 'USD/ton', change: '+1.55', changePct: '+1.30%' },
        { grade: 'ICI 2', spec: 'GAR 5,800 kcal/kg', price: '92.88', unit: 'USD/ton', change: '+1.21', changePct: '+1.32%' },
        { grade: 'ICI 3', spec: 'GAR 5,000 kcal/kg', price: '79.07', unit: 'USD/ton', change: '+1.34', changePct: '+1.72%' },
        { grade: 'ICI 4', spec: 'GAR 4,200 kcal/kg', price: '61.82', unit: 'USD/ton', change: '+0.97', changePct: '+1.59%' },
        { grade: 'ICI 5', spec: 'GAR 3,400 kcal/kg', price: '37.46', unit: 'USD/ton', change: '+0.57', changePct: '+1.55%' },
      ],
    },
    nickel: {
      title: 'LME Nickel',
      subtitle: 'London Metal Exchange — 3-month',
      ref: 'lme.com',
      items: [
        { grade: 'Cash', spec: '99.8% Ni', price: '18,920', unit: 'USD/ton', change: '-145', changePct: '-0.76%' },
        { grade: '3-Month', spec: '99.8% Ni', price: '18,955', unit: 'USD/ton', change: '-136', changePct: '-0.71%' },
        { grade: '15-Month', spec: '99.8% Ni', price: '18,850', unit: 'USD/ton', change: '-130', changePct: '-0.68%' },
      ],
    },
    tin: {
      title: 'LME Tin',
      subtitle: 'London Metal Exchange',
      ref: 'lme.com',
      items: [
        { grade: 'Cash', spec: '99.85% Sn', price: '55,020', unit: 'USD/ton', change: '+670', changePct: '+1.23%' },
        { grade: '3-Month', spec: '99.85% Sn', price: '55,079', unit: 'USD/ton', change: '+685', changePct: '+1.26%' },
        { grade: '15-Month', spec: '99.85% Sn', price: '54,600', unit: 'USD/ton', change: '+640', changePct: '+1.19%' },
      ],
    },
    gold: {
      title: 'Gold',
      subtitle: 'LBMA / COMEX',
      ref: 'lbma.org.uk · kitco.com',
      items: [
        { grade: 'Spot Gold', spec: 'XAU/USD', price: '4,539', unit: 'USD/oz', change: '+43', changePct: '+0.96%' },
        { grade: 'LBMA PM Fix', spec: 'USD/oz', price: '4,526', unit: 'USD/oz', change: '+25', changePct: '+0.56%' },
        { grade: 'Gold (MYR)', spec: 'XAU/MYR', price: '19,135', unit: 'MYR/oz', change: '+181', changePct: '+0.96%' },
      ],
    },
    silver: {
      title: 'Silver',
      subtitle: 'LBMA / COMEX',
      ref: 'lbma.org.uk · kitco.com',
      items: [
        { grade: 'Spot Silver', spec: 'XAG/USD', price: '75.29', unit: 'USD/oz', change: '-0.48', changePct: '-0.63%' },
        { grade: 'LBMA Fix', spec: 'USD/oz', price: '75.05', unit: 'USD/oz', change: '-0.30', changePct: '-0.40%' },
        { grade: 'Silver (MYR)', spec: 'XAG/MYR', price: '317', unit: 'MYR/oz', change: '-2', changePct: '-0.63%' },
      ],
    },
    energy: {
      title: 'Energy',
      subtitle: 'Global benchmarks',
      items: [
        { grade: 'Brent Crude', spec: 'ICE', price: '95.47', unit: 'USD/bbl', change: '-1.64', changePct: '-1.69%' },
        { grade: 'WTI Crude', spec: 'NYMEX', price: '92.21', unit: 'USD/bbl', change: '-1.58', changePct: '-1.68%' },
        { grade: 'CPO (FCPO)', spec: 'Bursa Malaysia', price: '4,473', unit: 'MYR/ton', change: '+15', changePct: '+0.34%' },
      ],
    },
    dieselMY: {
      title: 'Diesel — Malaysia',
      subtitle: 'DOM (Diesel Outlet Market) prices',
      ref: 'petrol.my · kpdn.gov.my',
      items: [
        { grade: 'Diesel (Euro 5 B10)', spec: 'RON 95 equivalent', price: 'RM 2.15', unit: '/litre', change: '—', changePct: 'Fixed' },
        { grade: 'Diesel (Subsidi B7)', spec: 'Targeted subsidy', price: 'RM 1.88', unit: '/litre', change: '—', changePct: 'Fixed' },
        { grade: 'Diesel (Non-Subsidy)', spec: 'Market rate', price: 'RM 3.35', unit: '/litre', change: '+0.02', changePct: '+0.60%' },
      ],
    },
    dieselID: {
      title: 'Diesel — Indonesia',
      subtitle: 'Pertamina pricing — effective May 2026',
      ref: 'pertamina.com · esdm.go.id',
      items: [
        { grade: 'Solar (Subsidi)', spec: 'PSO regulated', price: 'Rp 6,800', unit: '/litre', change: '—', changePct: 'Fixed' },
        { grade: 'Solar (Non-Subsidi/CN)', spec: 'Non-PSO market', price: 'Rp 13,400', unit: '/litre', change: '+200', changePct: '+1.52%' },
        { grade: 'Dexlite', spec: 'Low sulfur diesel', price: 'Rp 14,200', unit: '/litre', change: '+150', changePct: '+1.07%' },
        { grade: 'Pertamina Dex', spec: 'Premium biodiesel', price: 'Rp 15,100', unit: '/litre', change: '+150', changePct: '+1.00%' },
      ],
    },
  });
});

app.get('/api/diesel', (req, res) => {
  const country = req.query.country || 'all';
  const data = {
    malaysia: [
      { fuel: 'Diesel (Euro 5)', price: 'RM 2.15', unit: 'per litre', updated: '30 May 2026' },
      { fuel: 'Diesel (Subsidi)', price: 'RM 1.88', unit: 'per litre', updated: '30 May 2026' },
    ],
    indonesia: [
      { fuel: 'Solar (Subsidi)', price: 'Rp 6,800', unit: 'per litre', updated: '30 May 2026' },
      { fuel: 'Solar (Non-Subsidi/CN)', price: 'Rp 13,400', unit: 'per litre', updated: '30 May 2026' },
      { fuel: 'Dexlite', price: 'Rp 14,200', unit: 'per litre', updated: '30 May 2026' },
      { fuel: 'Pertamina Dex', price: 'Rp 15,100', unit: 'per litre', updated: '30 May 2026' },
    ],
  };

  if (country === 'all') return res.json(data);
  if (data[country]) return res.json(data[country]);
  res.json([]);
});

const PROVIDERS = {
  deepseek: {
    url: (model) => 'https://api.deepseek.com/v1/chat/completions',
    headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
    body: (model, messages) => ({
      model: model || 'deepseek-chat',
      messages,
      temperature: 0.1,
      max_tokens: 600,
    }),
    extract: (data) => data.choices?.[0]?.message?.content || '',
  },
  openai: {
    url: () => 'https://api.openai.com/v1/chat/completions',
    headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
    body: (model, messages) => ({
      model: model || 'gpt-4o-mini',
      messages,
      temperature: 0.1,
      max_tokens: 600,
    }),
    extract: (data) => data.choices?.[0]?.message?.content || '',
  },
  gemini: {
    url: (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.0-flash'}:generateContent?key=`,
    headers: () => ({}),
    body: (model, messages) => ({
      contents: messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      systemInstruction: { parts: [{ text: messages.find(m => m.role === 'system')?.content || '' }] },
      generationConfig: { temperature: 0.1, maxOutputTokens: 600 },
    }),
    extract: (data) => data.candidates?.[0]?.content?.parts?.[0]?.text || '',
  },
  qwen: {
    url: () => 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
    body: (model, messages) => ({
      model: model || 'qwen-plus',
      messages,
      temperature: 0.1,
      max_tokens: 600,
    }),
    extract: (data) => data.choices?.[0]?.message?.content || '',
  },
  claude: {
    url: () => 'https://api.anthropic.com/v1/messages',
    headers: (key) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01' }),
    body: (model, messages) => {
      const sys = messages.find(m => m.role === 'system')?.content || '';
      const msgs = messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role,
        content: m.content,
      }));
      return {
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: 600,
        system: sys,
        messages: msgs.length ? msgs : [{ role: 'user', content: 'test' }],
        temperature: 0.1,
      };
    },
    extract: (data) => data.content?.[0]?.text || '',
  },
};

const BASE_PROMPT = 'You analyse news articles about Malaysia, Indonesia and Singapore. Return JSON only with: summary (1 sentence), sentiment (positive/negative/neutral), key_points (array of 2-4 short bullet points), impact (financial/political/social/economic/none). Do not include markdown or extra text.';

app.post('/api/analyze', async (req, res) => {
  const { title, description, provider, apiKey, skill } = req.body || {};
  const text = [title, description].filter(Boolean).join(' — ').slice(0, 1500);
  if (!text) return res.status(400).json({ error: 'No text provided' });
  if (!provider) return res.status(400).json({ error: 'No AI provider specified' });
  if (!apiKey) return res.status(400).json({ error: 'No API key provided' });

  const p = PROVIDERS[provider];
  if (!p) return res.status(400).json({ error: `Unknown provider: ${provider}` });

  try {
    const systemPrompt = skill
      ? `${BASE_PROMPT}\n\nAdditional analyst instructions:\n${skill.slice(0, 2000)}`
      : BASE_PROMPT;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text },
    ];

    const url = p.url();
    const body = p.body(null, messages);
    const headers = { 'Content-Type': 'application/json', ...p.headers(apiKey) };

    const fetchUrl = provider === 'gemini' ? `${url}${apiKey}` : url;

    const r = await fetch(fetchUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const err = await r.text();
      return res.status(502).json({ error: `${provider} API error (${r.status}): ${err.slice(0, 300)}` });
    }

    const data = await r.json();
    const content = p.extract(data);
    if (!content) return res.status(502).json({ error: 'Empty response from AI provider' });

    let parsed;
    try {
      const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { summary: content.slice(0, 250), sentiment: 'neutral', key_points: [] };
    }

    res.json({ raw: content, ...parsed });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/ai-test', async (req, res) => {
  const { provider, apiKey } = req.body || {};
  if (!provider) return res.status(400).json({ error: 'No provider specified' });
  if (!apiKey) return res.status(400).json({ error: 'No API key provided' });

  const p = PROVIDERS[provider];
  if (!p) return res.status(400).json({ error: `Unknown provider: ${provider}` });

  try {
    const url = p.url();
    const body = p.body(null, [
      { role: 'system', content: 'Reply with exactly one word: ok' },
      { role: 'user', content: 'test' },
    ]);
    const headers = { 'Content-Type': 'application/json', ...p.headers(apiKey) };
    const fetchUrl = provider === 'gemini' ? `${url}${apiKey}` : url;

    const r = await fetch(fetchUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const err = await r.text();
      return res.json({ connected: false, error: `${provider} API error (${r.status}): ${err.slice(0, 200)}` });
    }

    const data = await r.json();
    const content = p.extract(data);
    res.json({ connected: true, response: content });
  } catch (err) {
    res.json({ connected: false, error: err.message });
  }
});

app.use(express.static('public'));

app.get('*', async (_, res) => {
  ensureCache();
  res.sendFile(new URL('./public/index.html', import.meta.url).pathname);
});

async function start() {
  await fetchAll();
  setInterval(fetchAll, 15 * 60 * 1000);
  app.listen(PORT, () => console.log(`Nusantara → http://localhost:${PORT}`));
}

if (!process.env.VERCEL) {
  start();
}

export default app;
