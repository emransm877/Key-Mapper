// Key Mapper - background service worker.
// Tracks busy/idle per tab from content.js heartbeats. After `idleMinutes` with no call
// activity it reads the caller's current item from ntfy.sh (published by the caller's
// Call Test Agent extension). If it differs, it switches this tab to that item and then
// sets the status dropdown to `wantStatus` (default AgentInCall).

const DEFAULTS = {
  topic: '',            // shared secret ntfy topic, same on both extensions
  idleMinutes: '3',
  autoSwitch: true,
  matchBy: 'item',      // 'item' = switch when item differs, 'company' = only when company differs
  wantStatus: 'AgentInCall'
};
const REPO = 'emransm877/Key-Mapper';
const REPO_MANIFEST = `https://raw.githubusercontent.com/${REPO}/main/manifest.json`;
const HOST = 'com.keymapper.updater';
const STEP_TIMEOUT_MS = 90000;
const COOLDOWN_MS = 5 * 60000;

const getCfg = () => chrome.storage.sync.get(DEFAULTS);
const company = (item) => (item || '').split('__')[0];

async function getState(tabId) {
  const k = 'tab' + tabId;
  const s = (await chrome.storage.session.get(k))[k];
  return s || { lastBusy: Date.now(), item: null, status: null, pending: null, cooldownUntil: 0 };
}
const setState = (tabId, s) => chrome.storage.session.set({ ['tab' + tabId]: s });

async function callerItem(topic) {
  const r = await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}/json?poll=1&since=6h`, { cache: 'no-store' });
  if (!r.ok) throw new Error('ntfy ' + r.status);
  const lines = (await r.text()).trim().split('\n').filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const ev = JSON.parse(lines[i]);
      if (ev.event !== 'message') continue;
      const msg = JSON.parse(ev.message);
      if (msg.item) return msg.item;
    } catch (_) { /* not ours */ }
  }
  return null;
}

const toTab = (tabId, m) => chrome.tabs.sendMessage(tabId, m).catch(() => {});
const toast = (tabId, text, color) => toTab(tabId, { type: 'km-toast', text, color });

async function onTick(tabId, m) {
  const cfg = await getCfg();
  const s = await getState(tabId);
  const now = Date.now();
  if (m.busy) s.lastBusy = now;
  if (m.item) s.item = m.item;
  if (m.status) s.status = m.status;

  const p = s.pending;
  if (p) {
    if (now - p.at > STEP_TIMEOUT_MS) {
      toast(tabId, `gave up switching to ${p.target} (stage: ${p.stage}). Will retry in 5 min.`, '#b42318');
      s.pending = null; s.cooldownUntil = now + COOLDOWN_MS;
    } else if (p.stage === 'item' && s.item === p.target) {
      p.stage = 'status'; p.at = now;
    }
    if (s.pending && s.pending.stage === 'item' && now - p.sentAt > 15000) { p.sentAt = now; toTab(tabId, { type: 'km-switch', target: p.target }); }
    if (s.pending && s.pending.stage === 'status' && now - (p.sentAt || 0) > 4000) { p.sentAt = now; toTab(tabId, { type: 'km-status', want: cfg.wantStatus }); }
    return setState(tabId, s);
  }

  const idleMs = Math.max(0.5, Number(cfg.idleMinutes) || 3) * 60000;
  if (cfg.autoSwitch && cfg.topic && !m.busy && now - s.lastBusy > idleMs && now > s.cooldownUntil) {
    s.cooldownUntil = now + 60000; // check ntfy at most once a minute while idle
    await setState(tabId, s);
    let target = null;
    try { target = await callerItem(cfg.topic); } catch (e) { console.warn('[Key Mapper]', e); }
    const s2 = await getState(tabId);
    if (target && target !== s2.item && (cfg.matchBy !== 'company' || company(target) !== company(s2.item))) {
      s2.pending = { target, stage: 'item', at: Date.now(), sentAt: Date.now() };
      await setState(tabId, s2);
      toTab(tabId, { type: 'km-switch', target });
    }
    return;
  }
  return setState(tabId, s);
}

async function onProgress(tabId, m) {
  const s = await getState(tabId);
  if (!s.pending) return;
  if (m.stage === 'item-done') { s.item = m.item; s.pending.stage = 'status'; s.pending.at = Date.now(); s.pending.sentAt = 0; }
  if (m.stage === 'item-fail' || m.stage === 'status-fail') { s.pending = null; s.cooldownUntil = Date.now() + COOLDOWN_MS; }
  if (m.stage === 'status-done') { s.pending = null; s.lastBusy = Date.now(); }
  await setState(tabId, s);
}

// Frames tick in parallel: run state updates one at a time so none overwrites another.
let queue = Promise.resolve();
const serial = (fn) => { queue = queue.then(fn, fn).catch((e) => console.warn('[Key Mapper]', e)); };

chrome.runtime.onMessage.addListener((m, sender, sendResponse) => {
  const tabId = sender.tab && sender.tab.id;
  if (m.type === 'km-tick' && tabId != null) serial(() => onTick(tabId, m));
  else if (m.type === 'km-progress' && tabId != null) serial(() => onProgress(tabId, m));
  else if (m.type === 'km-toast' && tabId != null) toast(tabId, m.text, m.color);
  else if (m.type === 'km-taught' && tabId != null) toTab(tabId, { type: 'km-teach-done' });
  else if (m.type === 'km-state') { getState(m.tabId).then(sendResponse); return true; }
  else if (m.type === 'km-switch-now') {
    (async () => {
      const cfg = await getCfg();
      if (!cfg.topic) return sendResponse({ error: 'Set the ntfy topic first.' });
      let target;
      try { target = await callerItem(cfg.topic); } catch (e) { return sendResponse({ error: e.message }); }
      if (!target) return sendResponse({ error: 'Caller has not published an item yet.' });
      const s = await getState(m.tabId);
      s.pending = { target, stage: 'item', at: Date.now(), sentAt: Date.now() };
      await setState(m.tabId, s);
      toTab(m.tabId, { type: 'km-switch', target });
      sendResponse({ target });
    })();
    return true;
  }
  else if (m.type === 'km-update') {
    chrome.runtime.sendNativeMessage(HOST, { cmd: 'update' }, (res) => {
      if (chrome.runtime.lastError) return sendResponse({ ok: false, error: chrome.runtime.lastError.message });
      sendResponse(res);
      if (res && res.ok) setTimeout(() => chrome.runtime.reload(), 300);
    });
    return true;
  }
});
chrome.tabs.onRemoved.addListener((tabId) => chrome.storage.session.remove('tab' + tabId));

// ---------------- update notice ----------------
const newer = (a, b) => {
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
};
async function checkForUpdate() {
  try {
    const latest = (await (await fetch(REPO_MANIFEST + '?t=' + Date.now(), { cache: 'no-store' })).json()).version;
    const has = newer(latest, chrome.runtime.getManifest().version);
    await chrome.storage.local.set({ latest: has ? latest : null });
    chrome.action.setBadgeText({ text: has ? 'NEW' : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#1a7f37' });
  } catch (_) { /* offline */ }
}
chrome.runtime.onInstalled.addListener(() => { chrome.alarms.create('update-check', { periodInMinutes: 180 }); checkForUpdate(); });
chrome.runtime.onStartup.addListener(checkForUpdate);
chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'update-check') checkForUpdate(); });
