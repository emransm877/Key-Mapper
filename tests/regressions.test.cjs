const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

function contentHarness(url = 'https://app.superannotate.com/editor') {
  const listeners = {}, messages = [], timers = [];
  const button = {
    tagName: 'BUTTON', textContent: 'Accept call', disabled: false,
    getAttribute: () => '', setAttribute() {}, contains: () => false,
    getBoundingClientRect: () => ({ width: 100, height: 40 }),
    classList: { contains: () => false }, scrollIntoView() {}, click() {}
  };
  const document = {
    documentElement: {}, body: { innerText: '' }, activeElement: null,
    querySelectorAll: () => [button], addEventListener() {}
  };
  const window = { frames: [], addEventListener: (name, fn) => listeners[name] = fn };
  window.top = window;
  const context = {
    window, document, location: { href: url, ancestorOrigins: [] }, URL,
    getComputedStyle: () => ({ visibility: 'visible', display: 'block', cursor: 'pointer' }),
    localStorage: { getItem: () => null, setItem() {} }, console: { log() {} },
    chrome: { runtime: { sendMessage: m => { messages.push(m); return Promise.resolve(); }, onMessage: { addListener: fn => listeners.runtime = fn } } },
    MutationObserver: class { observe() {} },
    setTimeout: fn => { timers.push(fn); return timers.length; },
    setInterval: fn => { timers.push(fn); return timers.length; }, Date
  };
  vm.createContext(context);
  vm.runInContext(source('item-identity.js'), context);
  vm.runInContext(source('content.js'), context);
  return { listeners, messages, document, button };
}

test('initial Accept button does not abort follow-caller initialization', () => {
  const h = contentHarness();
  assert.equal(typeof h.listeners.runtime, 'function');
  assert.equal(h.messages.at(-1).type, 'km-tick');
  assert.equal(h.messages.at(-1).busy, true);
});

test('a lookalike URL does not activate automation', () => {
  const h = contentHarness('https://superannotate.com.attacker.example/');
  assert.equal(h.messages.length, 0);
});

test('plain Enter in a text input does not click Accept', () => {
  const h = contentHarness();
  let clicks = 0;
  h.button.click = () => clicks++;
  h.document.activeElement = { tagName: 'INPUT', type: 'text' };
  h.listeners.keydown({ key: 'Enter', preventDefault() {}, stopPropagation() {} });
  assert.equal(clicks, 0);
});

test('caller lookup rejects stale, malformed and future item broadcasts', async () => {
  const text = source('background.js');
  const lookup = text.slice(text.indexOf('async function callerItem'), text.indexOf('\nconst toTab'));
  const now = Date.now();
  let response = [];
  const ctx = vm.createContext({
    CALLER_MAX_AGE_MS: 120000, Date, AbortSignal,
    fetch: async () => ({ ok: true, text: async () => response.map(({ message, time }) => JSON.stringify({ event: 'message', time, message: JSON.stringify(message) })).join('\n') })
  });
  vm.runInContext(lookup, ctx);
  for (const event of [
    { time: (now - 121000) / 1000, message: { v: 1, item: 'travel__one' } },
    { time: (now + 60000) / 1000, message: { v: 1, item: 'travel__one' } },
    { time: now / 1000, message: { v: 1, item: 'not an item' } },
    { message: { v: 1, item: 'travel__one' } }
  ]) {
    response = [event];
    assert.equal(await vm.runInContext("callerItem('unused-test-topic')", ctx), null);
  }
  response = [{ time: now / 1000, message: { v: 1, item: 'travel__one', t: now - 86400000 } }];
  assert.equal(await vm.runInContext("callerItem('unused-test-topic')", ctx), 'travel__one');
});

test('call activity arriving during a relay request prevents an automatic item switch', async () => {
  let listener, finishFetch;
  const state = { tab9: { lastBusy: Date.now() - 600000, item: 'travel__old', status: null, pending: null, cooldownUntil: 0 } };
  const sent = [];
  const event = { addListener() {} };
  const context = vm.createContext({
    Date, AbortSignal, console,
    chrome: {
      storage: {
        sync: { get: async defaults => ({ ...defaults, topic: 'fixture-topic' }) },
        session: { get: async key => ({ [key]: structuredClone(state[key]) }), set: async values => Object.assign(state, structuredClone(values)), remove() {} }
      },
      runtime: { onMessage: { addListener: fn => listener = fn }, onInstalled: event, onStartup: event },
      tabs: { sendMessage: async (id, message) => sent.push(message), onRemoved: event },
      alarms: { onAlarm: event }, action: {}
    },
    fetch: () => new Promise(resolve => finishFetch = resolve)
  });
  vm.runInContext(source('item-identity.js'), context);
  vm.runInContext(source('background.js'), context);
  listener({ type: 'km-tick', busy: false, item: 'travel__old' }, { tab: { id: 9 } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(typeof finishFetch, 'function');
  listener({ type: 'km-tick', busy: true, item: 'travel__old' }, { tab: { id: 9 } });
  finishFetch({ ok: true, text: async () => JSON.stringify({ event: 'message', time: Date.now() / 1000, message: JSON.stringify({ v: 1, item: 'travel__new', t: Date.now() }) }) });
  await vm.runInContext('queue', context);
  assert.equal(sent.some(message => message.type === 'km-switch'), false);
  assert.equal(state.tab9.pending, null);
});
