// Top supported search engines. Privacy-leaning first — ordering matches
// Hush's bias, since someone picking a browser called "Hush" probably prefers
// the engines on top of this list.
const SEARCH_ENGINES = [
  { id: 'duckduckgo', name: 'DuckDuckGo', short: 'DG', url: 'https://duckduckgo.com/?q=%s' },
  { id: 'startpage',  name: 'Startpage',  short: 'SP', url: 'https://www.startpage.com/do/search?query=%s' },
  { id: 'brave',      name: 'Brave',      short: 'BR', url: 'https://search.brave.com/search?q=%s' },
  { id: 'qwant',      name: 'Qwant',      short: 'QW', url: 'https://www.qwant.com/?q=%s' },
  { id: 'ecosia',     name: 'Ecosia',     short: 'EC', url: 'https://www.ecosia.org/search?q=%s' },
  { id: 'mojeek',     name: 'Mojeek',     short: 'MJ', url: 'https://www.mojeek.com/search?q=%s' },
  { id: 'google',     name: 'Google',     short: 'G',  url: 'https://www.google.com/search?q=%s' },
  { id: 'bing',       name: 'Bing',       short: 'B',  url: 'https://www.bing.com/search?q=%s' },
];

const DEFAULT_ENGINE_ID = 'duckduckgo';

function getEngine(engineId) {
  return SEARCH_ENGINES.find((e) => e.id === engineId) || SEARCH_ENGINES.find((e) => e.id === DEFAULT_ENGINE_ID);
}

function searchUrl(query, engineId) {
  const engine = getEngine(engineId);
  return engine.url.replace('%s', encodeURIComponent(query));
}

// Schemes that Chromium handles without a //authority (e.g. about:blank, data:...).
// mailto: and tel: are passed through so pages linking to them still open.
const SCHEMELESS_URI = /^(about|chrome|edge|view-source|data|blob|mailto|tel):/;

function looksLikeUrl(input) {
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(input)) return true;
  if (SCHEMELESS_URI.test(input)) return true;
  if (/^localhost(:\d+)?(\/.*)?$/.test(input)) return true;
  if (!/\s/.test(input) && /^[^/]+\.[a-zA-Z]{2,}(\/.*)?$/.test(input)) return true;
  return false;
}

function normalizeUrl(rawInput, fallback, engineId) {
  const input = (rawInput || '').trim();
  if (!input) return fallback;
  if (looksLikeUrl(input)) {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(input)) return input;
    if (SCHEMELESS_URI.test(input)) return input;
    if (/^localhost(:\d+)?(\/.*)?$/.test(input)) return `http://${input}`;
    return `https://${input}`;
  }
  return searchUrl(input, engineId);
}

// Extract a display host for the address bar / history. file:// urls return ''
// so the new tab page shows an empty bar.
function displayHost(url) {
  if (!url || url.startsWith('file://')) return '';
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

module.exports = {
  looksLikeUrl,
  normalizeUrl,
  displayHost,
  searchUrl,
  getEngine,
  SEARCH_ENGINES,
  DEFAULT_ENGINE_ID,
};
