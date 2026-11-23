const DEFAULTS = { topic: '', idleMinutes: '3', autoSwitch: true, matchBy: 'item', wantStatus: 'AgentInCall' };
const $ = (id) => document.getElementById(id);
const out = (t) => { $('out').textContent = t; };
const activeTab = async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0];

$('ver').textContent = 'v' + chrome.runtime.getManifest().version;

chrome.storage.sync.get(DEFAULTS).then((cfg) => {
  for (const k in DEFAULTS) {
    const el = $(k);
    if (el.type === 'checkbox') el.checked = !!cfg[k]; else el.value = cfg[k];
    el.addEventListener('change', () => chrome.storage.sync.set({ [k]: el.type === 'checkbox' ? el.checked : el.value.trim() }));
  }
});

chrome.storage.local.get({ latest: null }).then(({ latest }) => {
  if (latest) { $('upd').style.display = 'block'; $('latest').textContent = 'v' + latest; }
});
$('update').onclick = () => {
  out('Updating…');
  chrome.runtime.sendMessage({ type: 'km-update' }, (r) => {
    if (r && r.ok) out('Updated to v' + r.version + '. Reloading…');
    else out('Update failed: ' + ((r && r.error) || 'unknown') + '\nRun setup.ps1 once (see README) to turn on one-click updates.');
  });
};

$('gen').onclick = () => {
  const t = 'km-' + Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => (b % 36).toString(36)).join('');
  $('topic').value = t;
  chrome.storage.sync.set({ topic: t });
  navigator.clipboard.writeText(t).catch(() => {});
  out('New topic copied: ' + t + '\nPut the same topic in your caller\'s Call Test Agent popup.');
};

async function teach(slot) {
  const tab = await activeTab();
  await chrome.tabs.sendMessage(tab.id, { type: 'km-teach', slot }).catch(() => {});
  out('Now click the ' + slot + ' dropdown on the page.');
  window.close();
}
$('teachItem').onclick = () => teach('item');
$('teachStatus').onclick = () => teach('status');

$('now').onclick = async () => {
  const tab = await activeTab();
  chrome.runtime.sendMessage({ type: 'km-switch-now', tabId: tab.id }, (r) => {
    out(r && r.target ? 'Switching to ' + r.target + '…' : 'Error: ' + ((r && r.error) || 'unknown'));
  });
};

(async () => {
  const tab = await activeTab();
  if (!tab) return;
  chrome.runtime.sendMessage({ type: 'km-state', tabId: tab.id }, (s) => {
    if (!s || !s.item) return out('Waiting for the work page. Refresh your SuperAnnotate work page after updating, then reopen this popup.');
    const idle = Math.round((Date.now() - s.lastBusy) / 1000);
    out(`This tab: ${s.item}\nStatus: ${s.status || '?'}\nIdle: ${idle}s${s.pending ? '\nSwitching to ' + s.pending.target + ' (' + s.pending.stage + ')' : ''}`);
  });
})();
