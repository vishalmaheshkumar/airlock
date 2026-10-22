const fs = require('fs');
const path = require('path');

// Tiny JSON-backed key/value store. Writes are debounced to avoid thrashing disk
// on every history event; a final flush() is wired to app quit.
function createStore(filePath, defaults) {
  let data = { ...defaults };
  let writeTimer = null;
  let pendingFlush = null;

  try {
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      data = { ...defaults, ...parsed };
    }
  } catch (err) {
    console.error(`[store] failed to read ${filePath}, starting fresh:`, err);
  }

  function scheduleWrite() {
    if (writeTimer) return;
    writeTimer = setTimeout(() => {
      writeTimer = null;
      flushNow();
    }, 400);
  }

  function flushNow() {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(data));
    } catch (err) {
      console.error(`[store] write failed for ${filePath}:`, err);
    }
    if (pendingFlush) {
      pendingFlush();
      pendingFlush = null;
    }
  }

  return {
    get: (key) => data[key],
    set: (key, value) => {
      data[key] = value;
      scheduleWrite();
    },
    update: (key, fn) => {
      data[key] = fn(data[key]);
      scheduleWrite();
    },
    flush: () => {
      if (writeTimer) {
        clearTimeout(writeTimer);
        writeTimer = null;
      }
      flushNow();
    },
  };
}

module.exports = { createStore };
