const SEARCH_URL = (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`;

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

function normalizeUrl(rawInput, fallback) {
  const input = (rawInput || '').trim();
  if (!input) return fallback;
  if (looksLikeUrl(input)) {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(input)) return input;
    if (SCHEMELESS_URI.test(input)) return input;
    if (/^localhost(:\d+)?(\/.*)?$/.test(input)) return `http://${input}`;
    return `https://${input}`;
  }
  return SEARCH_URL(input);
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

module.exports = { looksLikeUrl, normalizeUrl, displayHost, SEARCH_URL };
