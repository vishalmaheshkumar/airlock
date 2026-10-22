const { test } = require('node:test');
const assert = require('node:assert/strict');
const { looksLikeUrl, normalizeUrl, displayHost, searchUrl, SEARCH_ENGINES, getEngine } = require('../src/url');

const NEW_TAB = 'file:///newtab';

test('looksLikeUrl detects explicit schemes', () => {
  assert.equal(looksLikeUrl('https://example.com'), true);
  assert.equal(looksLikeUrl('http://example.com'), true);
  assert.equal(looksLikeUrl('file:///tmp/foo.html'), true);
  assert.equal(looksLikeUrl('about:blank'), true);
});

test('looksLikeUrl detects localhost with and without port', () => {
  assert.equal(looksLikeUrl('localhost'), true);
  assert.equal(looksLikeUrl('localhost:3000'), true);
  assert.equal(looksLikeUrl('localhost:8080/path'), true);
});

test('looksLikeUrl detects bare hostnames with TLDs', () => {
  assert.equal(looksLikeUrl('example.com'), true);
  assert.equal(looksLikeUrl('sub.example.co.uk'), true);
  assert.equal(looksLikeUrl('github.com/user/repo'), true);
});

test('looksLikeUrl rejects plain search queries', () => {
  assert.equal(looksLikeUrl('how to tie a knot'), false);
  assert.equal(looksLikeUrl('duck typing'), false);
  assert.equal(looksLikeUrl('123'), false);
  assert.equal(looksLikeUrl(''), false);
});

test('normalizeUrl preserves explicit schemes', () => {
  assert.equal(normalizeUrl('https://example.com', NEW_TAB), 'https://example.com');
  assert.equal(normalizeUrl('http://example.com', NEW_TAB), 'http://example.com');
  assert.equal(normalizeUrl('about:blank', NEW_TAB), 'about:blank');
  assert.equal(normalizeUrl('mailto:a@b.com', NEW_TAB), 'mailto:a@b.com');
});

test('normalizeUrl adds https to bare hostnames', () => {
  assert.equal(normalizeUrl('example.com', NEW_TAB), 'https://example.com');
  assert.equal(normalizeUrl('  example.com  ', NEW_TAB), 'https://example.com');
});

test('normalizeUrl uses http for localhost', () => {
  assert.equal(normalizeUrl('localhost', NEW_TAB), 'http://localhost');
  assert.equal(normalizeUrl('localhost:3000', NEW_TAB), 'http://localhost:3000');
});

test('normalizeUrl routes queries to DuckDuckGo by default', () => {
  assert.equal(
    normalizeUrl('how to tie a knot', NEW_TAB),
    'https://duckduckgo.com/?q=how%20to%20tie%20a%20knot',
  );
});

test('normalizeUrl routes to the selected engine', () => {
  assert.equal(
    normalizeUrl('cats', NEW_TAB, 'google'),
    'https://www.google.com/search?q=cats',
  );
  assert.equal(
    normalizeUrl('cats', NEW_TAB, 'brave'),
    'https://search.brave.com/search?q=cats',
  );
  assert.equal(
    normalizeUrl('cats', NEW_TAB, 'mojeek'),
    'https://www.mojeek.com/search?q=cats',
  );
});

test('normalizeUrl falls back to default on unknown engine id', () => {
  assert.equal(
    normalizeUrl('cats', NEW_TAB, 'notarealengine'),
    'https://duckduckgo.com/?q=cats',
  );
});

test('SEARCH_ENGINES exposes the full catalog', () => {
  assert.ok(SEARCH_ENGINES.length >= 8);
  for (const e of SEARCH_ENGINES) {
    assert.ok(e.id && e.name && e.short && e.url.includes('%s'));
  }
});

test('getEngine returns the match or falls back to default', () => {
  assert.equal(getEngine('google').id, 'google');
  assert.equal(getEngine('nope').id, 'duckduckgo');
});

test('normalizeUrl falls back for empty input', () => {
  assert.equal(normalizeUrl('', NEW_TAB), NEW_TAB);
  assert.equal(normalizeUrl('   ', NEW_TAB), NEW_TAB);
  assert.equal(normalizeUrl(null, NEW_TAB), NEW_TAB);
  assert.equal(normalizeUrl(undefined, NEW_TAB), NEW_TAB);
});

test('normalizeUrl escapes special chars in search queries', () => {
  assert.equal(
    normalizeUrl('C# vs Go', NEW_TAB),
    'https://duckduckgo.com/?q=C%23%20vs%20Go',
  );
});

test('displayHost returns hostname for http(s) urls', () => {
  assert.equal(displayHost('https://example.com/path'), 'example.com');
  assert.equal(displayHost('http://sub.example.co.uk/'), 'sub.example.co.uk');
});

test('displayHost returns empty for internal and invalid urls', () => {
  assert.equal(displayHost('file:///tmp/foo.html'), '');
  assert.equal(displayHost(''), '');
  assert.equal(displayHost(null), '');
  assert.equal(displayHost('not a url'), '');
});
