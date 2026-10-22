const q = document.getElementById('q');
const countEl = document.getElementById('count');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const closeBtn = document.getElementById('close');

q.addEventListener('input', () => {
  if (!q.value) {
    countEl.textContent = '0/0';
    window.browserAPI.find('', true);
    return;
  }
  window.browserAPI.find(q.value, true);
});

q.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (e.shiftKey) window.browserAPI.findPrev(q.value);
    else window.browserAPI.findNext(q.value);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    window.browserAPI.findClose();
  }
});

prevBtn.addEventListener('click', () => window.browserAPI.findPrev(q.value));
nextBtn.addEventListener('click', () => window.browserAPI.findNext(q.value));
closeBtn.addEventListener('click', () => window.browserAPI.findClose());

window.browserAPI.onFindResult(({ current, total }) => {
  countEl.textContent = `${current || 0}/${total || 0}`;
});
window.browserAPI.onFindFocus(() => {
  q.focus();
  q.select();
});
