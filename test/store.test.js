const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStore } = require('../src/storage/store');

const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'hush-store-'));
after(() => { try { fs.rmSync(tmpBase, { recursive: true, force: true }); } catch {} });

function tmpFile(name) {
  return path.join(tmpBase, name);
}

test('createStore returns defaults when file is missing', () => {
  const store = createStore(tmpFile('a.json'), { bookmarks: [], history: [] });
  assert.deepEqual(store.get('bookmarks'), []);
  assert.deepEqual(store.get('history'), []);
});

test('store.set + flush persists to disk', () => {
  const file = tmpFile('b.json');
  const store = createStore(file, { bookmarks: [] });
  store.set('bookmarks', [{ url: 'https://example.com', title: 'Example' }]);
  store.flush();
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(parsed.bookmarks, [{ url: 'https://example.com', title: 'Example' }]);
});

test('store.update mutates via function', () => {
  const file = tmpFile('c.json');
  const store = createStore(file, { history: [] });
  store.update('history', (h) => [...h, { url: 'https://a.com' }]);
  store.update('history', (h) => [...h, { url: 'https://b.com' }]);
  store.flush();
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(parsed.history.length, 2);
  assert.equal(parsed.history[1].url, 'https://b.com');
});

test('store reloads from existing file', () => {
  const file = tmpFile('d.json');
  fs.writeFileSync(file, JSON.stringify({ bookmarks: [{ url: 'https://existing.com' }] }));
  const store = createStore(file, { bookmarks: [], history: [] });
  assert.equal(store.get('bookmarks')[0].url, 'https://existing.com');
  // Defaults still apply for missing keys.
  assert.deepEqual(store.get('history'), []);
});

test('store survives corrupt file by using defaults', () => {
  const file = tmpFile('e.json');
  fs.writeFileSync(file, '{ not valid json');
  const store = createStore(file, { bookmarks: [], history: [] });
  assert.deepEqual(store.get('bookmarks'), []);
  // Writing afterwards still works.
  store.set('bookmarks', [{ url: 'https://x.com' }]);
  store.flush();
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(parsed.bookmarks[0].url, 'https://x.com');
});
