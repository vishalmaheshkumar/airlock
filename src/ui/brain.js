// Hush Brain — a local SLM chat panel running on WebGPU via @mlc-ai/web-llm.
// Everything stays on-device: model files cache in IndexedDB, inference runs
// in this view, no network traffic once a model is downloaded.
//
// Models are curated to a small, consumer-hardware-friendly set. If you need
// something else, the full catalog is at:
//   https://github.com/mlc-ai/web-llm/blob/main/src/config.ts

import * as webllm from 'https://esm.run/@mlc-ai/web-llm@0.2.79';

const SUPPORTED_MODELS = [
  { id: 'SmolLM2-135M-Instruct-q0f16-MLC',   label: 'SmolLM2 · 135M (tiny)',   size: '≈100 MB' },
  { id: 'SmolLM2-360M-Instruct-q4f16_1-MLC', label: 'SmolLM2 · 360M',          size: '≈270 MB' },
  { id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', label: 'Qwen 2.5 · 0.5B',         size: '≈380 MB' },
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 · 1B',          size: '≈800 MB' },
  { id: 'SmolLM2-1.7B-Instruct-q4f16_1-MLC', label: 'SmolLM2 · 1.7B',          size: '≈1.1 GB' },
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'Qwen 2.5 · 1.5B',         size: '≈1.0 GB' },
  { id: 'gemma-2-2b-it-q4f16_1-MLC',         label: 'Gemma 2 · 2B',            size: '≈1.6 GB' },
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 · 3B',          size: '≈2.0 GB' },
  { id: 'Qwen2.5-3B-Instruct-q4f16_1-MLC',   label: 'Qwen 2.5 · 3B',           size: '≈2.0 GB' },
  { id: 'Phi-3.5-mini-instruct-q4f16_1-MLC', label: 'Phi-3.5 Mini · 3.8B',     size: '≈2.4 GB' },
];

const DEFAULT_SYSTEM_PROMPT = 'You are a helpful, concise assistant running locally in a privacy-first browser. Keep answers short unless asked to go deeper.';

const el = {
  modelSelect: document.getElementById('model-select'),
  loadBtn: document.getElementById('load-btn'),
  statusText: document.getElementById('status-text'),
  progressBar: document.getElementById('progress-bar'),
  settingsBtn: document.getElementById('settings-btn'),
  settingsPanel: document.getElementById('settings-panel'),
  closeBtn: document.getElementById('close-btn'),
  systemPrompt: document.getElementById('system-prompt'),
  temperature: document.getElementById('temperature'),
  temperatureOut: document.getElementById('temperature-out'),
  maxTokens: document.getElementById('max-tokens'),
  resetChat: document.getElementById('reset-chat'),
  messages: document.getElementById('messages'),
  input: document.getElementById('input'),
  sendBtn: document.getElementById('send-btn'),
  stats: document.getElementById('stats'),
};

const state = {
  engine: null,
  loadedModelId: null,
  loading: false,
  generating: false,
  history: [], // {role, content}
};

const LS_KEY_LAST_MODEL = 'hush.brain.lastModel';
const LS_KEY_SYSTEM = 'hush.brain.systemPrompt';
const LS_KEY_TEMP = 'hush.brain.temperature';
const LS_KEY_MAX = 'hush.brain.maxTokens';

function lsGet(k, fallback) {
  try { return localStorage.getItem(k) ?? fallback; } catch { return fallback; }
}
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch {} }

function populateModels() {
  const last = lsGet(LS_KEY_LAST_MODEL, SUPPORTED_MODELS[2].id);
  el.modelSelect.innerHTML = '';
  for (const m of SUPPORTED_MODELS) {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `${m.label} — ${m.size}`;
    if (m.id === last) opt.selected = true;
    el.modelSelect.appendChild(opt);
  }
}

function setStatus(text, pct) {
  el.statusText.textContent = text;
  if (typeof pct === 'number') el.progressBar.style.width = `${Math.max(0, Math.min(100, pct * 100))}%`;
}

function addMessage(role, content, { streaming } = {}) {
  const placeholder = el.messages.querySelector('.placeholder');
  if (placeholder) placeholder.remove();
  const div = document.createElement('div');
  div.className = `msg ${role}` + (streaming ? ' streaming' : '');
  div.textContent = content;
  el.messages.appendChild(div);
  el.messages.scrollTop = el.messages.scrollHeight;
  return div;
}

function updateMessage(div, content) {
  div.textContent = content;
  el.messages.scrollTop = el.messages.scrollHeight;
}

function setGenerating(on) {
  state.generating = on;
  el.sendBtn.disabled = on || !state.engine;
  el.sendBtn.textContent = on ? 'Stop' : 'Send';
  el.input.disabled = on;
}

async function loadModel(modelId) {
  if (state.loading) return;
  if (state.loadedModelId === modelId && state.engine) {
    setStatus(`Ready — ${modelId}`, 1);
    return;
  }
  state.loading = true;
  el.loadBtn.disabled = true;
  el.sendBtn.disabled = true;
  setStatus(`Preparing ${modelId}…`, 0);
  try {
    if (state.engine && typeof state.engine.unload === 'function') {
      try { await state.engine.unload(); } catch {}
    }
    state.engine = new webllm.MLCEngine();
    state.engine.setInitProgressCallback((report) => {
      setStatus(report.text || `Loading ${modelId}…`, report.progress ?? 0);
    });
    await state.engine.reload(modelId, {
      temperature: Number(el.temperature.value),
    });
    state.loadedModelId = modelId;
    lsSet(LS_KEY_LAST_MODEL, modelId);
    setStatus(`Ready — ${modelId}`, 1);
    el.sendBtn.disabled = false;
    el.input.focus();
  } catch (err) {
    console.error(err);
    setStatus(`Load failed: ${err.message || err}`, 0);
    state.engine = null;
    state.loadedModelId = null;
  } finally {
    state.loading = false;
    el.loadBtn.disabled = false;
  }
}

async function send() {
  if (state.generating) {
    try { state.engine?.interruptGenerate(); } catch {}
    return;
  }
  const text = el.input.value.trim();
  if (!text || !state.engine) return;
  el.input.value = '';
  autoGrow();
  addMessage('user', text);
  state.history.push({ role: 'user', content: text });

  const assistantDiv = addMessage('assistant', '', { streaming: true });
  let full = '';
  setGenerating(true);
  el.stats.textContent = 'Thinking…';

  const sys = (el.systemPrompt.value || DEFAULT_SYSTEM_PROMPT).trim();
  const messages = [{ role: 'system', content: sys }, ...state.history];
  const started = performance.now();
  let tokens = 0;

  try {
    const stream = await state.engine.chat.completions.create({
      messages,
      stream: true,
      temperature: Number(el.temperature.value),
      max_tokens: Number(el.maxTokens.value),
      stream_options: { include_usage: true },
    });
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        full += delta;
        tokens += 1;
        updateMessage(assistantDiv, full);
        const dt = (performance.now() - started) / 1000;
        if (dt > 0.1) el.stats.textContent = `${tokens} tok · ${(tokens / dt).toFixed(1)} tok/s`;
      }
      if (chunk.usage) {
        const dt = (performance.now() - started) / 1000;
        const total = chunk.usage.completion_tokens ?? tokens;
        el.stats.textContent = `${total} tok · ${(total / dt).toFixed(1)} tok/s`;
      }
    }
    assistantDiv.classList.remove('streaming');
    state.history.push({ role: 'assistant', content: full });
  } catch (err) {
    assistantDiv.classList.remove('streaming');
    updateMessage(assistantDiv, (full ? full + '\n\n' : '') + `[error: ${err.message || err}]`);
    assistantDiv.classList.add('system');
  } finally {
    setGenerating(false);
    el.input.focus();
  }
}

function resetChat() {
  state.history = [];
  el.messages.innerHTML = '';
  const placeholder = document.createElement('div');
  placeholder.className = 'placeholder';
  placeholder.innerHTML = '<p class="placeholder-title">New conversation.</p><p class="placeholder-sub">The model has no memory of what came before.</p>';
  el.messages.appendChild(placeholder);
  el.stats.textContent = '';
}

function autoGrow() {
  el.input.style.height = 'auto';
  el.input.style.height = Math.min(160, el.input.scrollHeight) + 'px';
}

function wire() {
  el.loadBtn.addEventListener('click', () => loadModel(el.modelSelect.value));
  el.sendBtn.addEventListener('click', send);
  el.closeBtn.addEventListener('click', () => window.hushBrain?.close());
  el.resetChat.addEventListener('click', resetChat);
  el.settingsBtn.addEventListener('click', () => {
    el.settingsPanel.hidden = !el.settingsPanel.hidden;
  });

  el.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      send();
    } else if (e.key === 'Escape') {
      el.input.blur();
    }
  });
  el.input.addEventListener('input', autoGrow);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !state.generating && document.activeElement !== el.input) {
      window.hushBrain?.close();
    }
  });

  el.temperature.addEventListener('input', () => {
    el.temperatureOut.textContent = Number(el.temperature.value).toFixed(2);
    lsSet(LS_KEY_TEMP, el.temperature.value);
  });
  el.maxTokens.addEventListener('change', () => lsSet(LS_KEY_MAX, el.maxTokens.value));
  el.systemPrompt.addEventListener('change', () => lsSet(LS_KEY_SYSTEM, el.systemPrompt.value));
}

function hydrate() {
  populateModels();
  el.systemPrompt.value = lsGet(LS_KEY_SYSTEM, DEFAULT_SYSTEM_PROMPT) || DEFAULT_SYSTEM_PROMPT;
  const t = Number(lsGet(LS_KEY_TEMP, 0.6));
  el.temperature.value = String(Number.isFinite(t) ? t : 0.6);
  el.temperatureOut.textContent = Number(el.temperature.value).toFixed(2);
  el.maxTokens.value = String(Number(lsGet(LS_KEY_MAX, 512)) || 512);

  if (!('gpu' in navigator)) {
    setStatus('WebGPU is unavailable in this build. Try the latest Hush.', 0);
    el.loadBtn.disabled = true;
    el.sendBtn.disabled = true;
    return;
  }
}

wire();
hydrate();
