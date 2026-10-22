const page = document.currentScript.dataset.page;
const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty');
const filterEl = document.getElementById('filter');
const clearBtn = document.getElementById('clear');

let items = [];

function initial(title) {
  const t = (title || '').trim();
  if (!t) return '•';
  const letter = t.replace(/^[^\p{L}\p{N}]+/u, '').charAt(0);
  return (letter || '•').toUpperCase();
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function render() {
  const q = (filterEl.value || '').toLowerCase().trim();
  const filtered = q
    ? items.filter((it) => (it.title || '').toLowerCase().includes(q) || (it.url || '').toLowerCase().includes(q))
    : items;
  listEl.innerHTML = '';
  if (!filtered.length) {
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;
  for (const it of filtered) {
    const li = document.createElement('li');
    li.className = 'row';
    li.onclick = () => window.hush.navigate(it.url);

    const letter = document.createElement('div');
    letter.className = 'row-letter';
    letter.textContent = initial(it.title || it.url);

    const main = document.createElement('div');
    main.className = 'row-main';
    const title = document.createElement('div');
    title.className = 'row-title';
    title.textContent = it.title || it.url;
    const url = document.createElement('div');
    url.className = 'row-url';
    url.textContent = it.url;
    main.appendChild(title);
    main.appendChild(url);

    const time = document.createElement('div');
    time.className = 'row-time';
    time.textContent = formatTime(it.ts);

    const remove = document.createElement('button');
    remove.className = 'row-remove';
    remove.title = 'Remove';
    remove.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';
    remove.onclick = (e) => {
      e.stopPropagation();
      if (page === 'bookmarks') {
        window.hush.removeBookmark(it.url);
        items = items.filter((x) => x.url !== it.url);
        render();
      }
    };

    li.appendChild(letter);
    li.appendChild(main);
    li.appendChild(time);
    if (page === 'bookmarks') li.appendChild(remove);
    listEl.appendChild(li);
  }
}

async function load() {
  items = page === 'bookmarks' ? await window.hush.listBookmarks() : await window.hush.listHistory();
  render();
}

filterEl.addEventListener('input', render);
if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    if (!confirm('Clear all history?')) return;
    window.hush.clearHistory();
    items = [];
    render();
  });
}

load();
