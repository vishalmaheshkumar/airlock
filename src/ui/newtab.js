const bookmarksEl = document.getElementById('bookmarks');
const emptyEl = document.getElementById('empty');
const qEl = document.getElementById('q');

function initial(title) {
  const t = (title || '').trim();
  if (!t) return '•';
  const letter = t.replace(/^[^\p{L}\p{N}]+/u, '').charAt(0);
  return (letter || '•').toUpperCase();
}

function go(e) {
  e.preventDefault();
  const v = qEl.value.trim();
  if (!v) return false;
  if (window.hush) window.hush.navigate(v);
  return false;
}

async function renderBookmarks() {
  if (!window.hush) return;
  const bookmarks = await window.hush.listBookmarks();
  bookmarksEl.innerHTML = '';
  if (!bookmarks.length) {
    emptyEl.style.display = 'block';
    return;
  }
  emptyEl.style.display = 'none';
  for (const b of bookmarks.slice(0, 12)) {
    const a = document.createElement('a');
    a.className = 'bm';
    a.href = '#';
    a.title = b.url;
    a.onclick = (ev) => { ev.preventDefault(); window.hush.navigate(b.url); };
    const letter = document.createElement('div');
    letter.className = 'bm-letter';
    letter.textContent = initial(b.title || b.url);
    const title = document.createElement('div');
    title.className = 'bm-title';
    title.textContent = b.title || b.url;
    a.appendChild(letter);
    a.appendChild(title);
    bookmarksEl.appendChild(a);
  }
}

window.go = go;
renderBookmarks();
