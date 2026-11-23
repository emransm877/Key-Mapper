const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

function pageFixture(labels, changesSelection = true, settings = {}) {
  let now = Date.now(), opened = false, selected = settings.initialSelected || 'demo__previous_agent_tp01';
  let runtimeListener, openCount = 0, canceled = false, inputClicks = 0;
  const messages = [], clicked = [];
  class E { constructor(type, options) { this.type = type; Object.assign(this, options); } }
  const element = (text = '', role = '') => ({
    tagName: 'DIV', textContent: text, parentElement: null, className: '', id: '',
    classList: { contains: () => false, [Symbol.iterator]: function* () {} },
    getAttribute: name => name === 'role' ? role : '', setAttribute() {},
    getBoundingClientRect: () => ({ width: 100, height: 30, left: 0, top: 0 }),
    contains(other) { return this === other; }, querySelector: () => ({}),
    scrollIntoView() {}, focus() {}, remove() {},
    dispatchEvent(event) { if (event.type === 'click') this.onclick?.(); }
  });
  const trigger = element(settings.realSnSelect ? '' : selected, settings.searchInputOnly ? 'button' : 'combobox');
  const selectedName = element(selected);
  selectedName.className = 'project-item-name';
  const projectSelect = element();
  const dropdownPanel = element('', 'listbox');
  projectSelect.tagName = 'SN-SELECT';
  projectSelect.getAttribute = name => name === 'data-qa-id' ? 'project-items-select' : '';
  Object.defineProperty(projectSelect, 'textContent', { get: () => 'Select an item' + selectedName.textContent + 'demo__...' });
  projectSelect.querySelectorAll = selector => {
    if (selector === '.sn-value .project-item-name') return [selectedName];
    if (selector === 'input, textarea' || selector === '.sn-select-input input, .sn-select-input textarea') {
      return opened || settings.legacyTaughtInput ? [...(settings.hiddenProjectInput ? [hiddenInput] : []), input] : [];
    }
    if (selector === 'select-dropdown-panel[role="listbox"] [role="option"]') {
      return opened && !settings.delayedOptions ? options.filter(option => option.textContent.includes(input.value)) : [];
    }
    return [];
  };
  projectSelect.contains = other => other === projectSelect || other === trigger || other === input || other === selectedName;
  projectSelect.querySelector = selector => selector === 'select-dropdown-panel[role="listbox"]' ? (opened ? dropdownPanel : null) : trigger;
  trigger.parentElement = settings.realSnSelect ? projectSelect : null;
  trigger.onclick = () => { opened = !opened; openCount++; };
  class Input {
    constructor() { Object.assign(this, element()); this.tagName = 'INPUT'; this.type = 'text'; this.placeholder = 'Search item'; this._value = ''; }
    get value() { return this._value; } set value(value) { if (this.tagName !== 'INPUT') throw new TypeError('Native input setter used on another element'); this._value = value; }
  }
  class TextArea extends Input {
    constructor() { super(); this.tagName = 'TEXTAREA'; this.type = 'textarea'; this.rows = 1; }
    get value() { return this._value; } set value(value) { if (this.tagName !== 'TEXTAREA') throw new TypeError('Native textarea setter used on another element'); this._value = value; }
  }
  const input = settings.textareaSearch ? new TextArea() : new Input();
  if (settings.zeroWidthSearch) input.getBoundingClientRect = () => ({ width: 0, height: 20, left: 0, top: 0 });
  const hiddenInput = new Input();
  hiddenInput.type = 'hidden'; hiddenInput.hidden = true; hiddenInput.placeholder = 'Search hidden controls';
  input.id = 'fixture-legacy-input';
  input.onclick = () => { inputClicks++; if (settings.genericTaughtOpener) trigger.onclick(); };
  const unrelatedInput = new Input();
  unrelatedInput.placeholder = 'Search unrelated records';
  if (settings.searchInputOnly) input.getAttribute = name => name === 'role' ? 'combobox' : '';
  const options = labels.map(label => {
    const option = element(label, 'option');
    option.closest = () => option;
    if (settings.realSnSelect) {
      const name = element(label);
      name.className = 'project-item-name';
      const container = element('Status' + label + 'Information');
      container.getAttribute = key => key === 'data-qa-id' ? 'project-item-option-' + (settings.optionQaMismatch ? 'demo__different_agent_pc99' : label) : '';
      container.querySelectorAll = selector => selector === '.project-item-name' && !settings.missingOptionLeaf ? [name] : [];
      option.querySelectorAll = selector => selector === '.project-item-container' ? [container] : [];
      option.textContent = 'Status' + label + 'Informationdemo__...';
    }
    option.onclick = () => { clicked.push(label); if (changesSelection) { selected = label; selectedName.textContent = label; if (!settings.realSnSelect) trigger.textContent = label; } opened = false; };
    return option;
  });
  const all = () => [...(settings.realSnSelect ? [projectSelect, selectedName] : []), ...(settings.unrelatedSearch ? [unrelatedInput] : []), trigger, ...(opened || settings.legacyTaughtInput ? [input] : []), ...(opened && !settings.delayedOptions ? options.filter(option => option.textContent.includes(input.value)) : [])];
  const doc = {
    documentElement: { appendChild() {} }, body: { get innerText() { return selected; } },
    querySelectorAll: selector => selector === 'sn-select[data-qa-id="project-items-select"]' ? (settings.realSnSelect ? [projectSelect] : []) : selector === 'input, textarea' ? [...(settings.unrelatedSearch ? [unrelatedInput] : []), ...(opened || settings.legacyTaughtInput ? [input] : [])] : all(),
    addEventListener() {}, createElement: () => element(), activeElement: null
  };
  const window = { frames: [], addEventListener() {} }; window.top = window;
  const ctx = vm.createContext({
    window, document: doc, location: { href: 'https://app.superannotate.com/editor', ancestorOrigins: [] }, URL,
    getComputedStyle: () => ({ visibility: 'visible', display: 'block', cursor: 'pointer' }),
    localStorage: { getItem: () => null }, console: { log() {} },
    chrome: { runtime: { sendMessage: message => { messages.push(message); return Promise.resolve(); }, onMessage: { addListener: fn => runtimeListener = fn } }, storage: { local: { get: async () => ({ taught: settings.legacyTaughtInput ? { item: { tag: 'input', id: 'fixture-legacy-input', cls: [], path: 'legacy-search' } } : {} }) } } },
    MutationObserver: class { observe() {} }, HTMLInputElement: Input, HTMLTextAreaElement: TextArea, PointerEvent: E, MouseEvent: E, Event: E, KeyboardEvent: E,
    Date: class extends Date { static now() { return now; } },
    setTimeout: (fn, milliseconds) => {
      now += milliseconds;
      if (milliseconds === 200) settings.onPoll?.(ctx);
      if (milliseconds === 200 && settings.cancelOnPoll && !canceled) { canceled = true; runtimeListener({ type: 'km-cancel-switch' }); }
      queueMicrotask(fn); return 1;
    }, setInterval() {}
  });
  vm.runInContext(source('item-identity.js'), ctx);
  vm.runInContext(source('content.js').replace('  tick();', '  globalThis.followFixture = { switchItem, tick };\n  tick();'), ctx);
  return { ctx, messages, clicked, selected: () => selected, opens: () => openCount, inputClicks: () => inputClicks, searchValues: () => ({ actual: input.value, unrelated: unrelatedInput.value, ...(settings.hiddenProjectInput ? { hidden: hiddenInput.value } : {}) }), switchTo: (item, mode) => ctx.followFixture.switchItem(item, mode) };
}

test('real project selector reads its dedicated value despite placeholder and duplicated truncated text', async () => {
  const f = pageFixture(['demo__scenario_agent_pc05'], true, { realSnSelect: true });
  const heartbeat = f.messages.filter(message => message.type === 'km-tick').at(-1);
  assert.equal(heartbeat.item, 'demo__previous_agent_tp01');
  assert.equal(heartbeat.itemAuthority, 'editor');
  await f.switchTo('demo__scenario_customer_pc03', 'company');
  assert.deepEqual(f.clicked, ['demo__scenario_agent_pc05']);
  assert.equal(f.messages.at(-1).stage, 'item-done');
  assert.equal(f.messages.at(-1).item, 'demo__scenario_agent_pc05');
});

test('real project selector keeps its selected display when search input contains the target company', async () => {
  const f = pageFixture(['demo__scenario_agent_pc05'], true, {
    realSnSelect: true, searchInputOnly: true, delayedOptions: true, cancelOnPoll: true,
    onPoll: ctx => ctx.followFixture.tick()
  });
  await f.switchTo('demo__scenario_customer_pc03', 'company');
  const heartbeat = f.messages.filter(message => message.type === 'km-tick').at(-1);
  assert.equal(heartbeat.item, 'demo__previous_agent_tp01');
  assert.equal(heartbeat.itemAuthority, 'editor');
  assert.equal(f.messages.some(message => message.stage === 'item-done'), false);
});

test('real project dropdown reads option display leaves and types only in its own search input', async () => {
  const f = pageFixture(['demo__scenario_agent_pc05'], true, { realSnSelect: true, unrelatedSearch: true });
  await f.switchTo('demo__scenario_customer_pc03', 'company');
  assert.deepEqual(f.clicked, ['demo__scenario_agent_pc05']);
  assert.deepEqual(f.searchValues(), { actual: 'demo__scenario', unrelated: '' });
  assert.equal(f.messages.at(-1).selected, true);
});

test('legacy taught search INPUT cannot override the known project selector opener', async () => {
  const f = pageFixture(['demo__scenario_agent_pc05'], true, { realSnSelect: true, legacyTaughtInput: true });
  await f.switchTo('demo__scenario_customer_pc03', 'company');
  assert.equal(f.inputClicks(), 0);
  assert.equal(f.opens(), 1);
  assert.deepEqual(f.clicked, ['demo__scenario_agent_pc05']);
  assert.equal(f.messages.at(-1).stage, 'item-done');
});

test('an open project dropdown types in its zero-width search field without using a hidden auxiliary input', async () => {
  const f = pageFixture(['demo__scenario_agent_pc05'], true, {
    realSnSelect: true, zeroWidthSearch: true, hiddenProjectInput: true, unrelatedSearch: true
  });
  await f.switchTo('demo__scenario_customer_pc03', 'company');
  assert.deepEqual(f.searchValues(), { actual: 'demo__scenario', unrelated: '', hidden: '' });
  assert.deepEqual(f.clicked, ['demo__scenario_agent_pc05']);
  assert.equal(f.messages.at(-1).stage, 'item-done');
});

test('actual SN-select textarea search uses its native setter even with a zero-width field', async () => {
  const f = pageFixture(['demo__scenario_agent_pc05'], true, {
    realSnSelect: true, textareaSearch: true, zeroWidthSearch: true, hiddenProjectInput: true, unrelatedSearch: true
  });
  await f.switchTo('demo__scenario_customer_pc03', 'company');
  assert.deepEqual(f.searchValues(), { actual: 'demo__scenario', unrelated: '', hidden: '' });
  assert.deepEqual(f.clicked, ['demo__scenario_agent_pc05']);
  assert.equal(f.messages.at(-1).stage, 'item-done');
});

test('a taught opener remains usable for a widget without the known project selector structure', async () => {
  const f = pageFixture(['demo__scenario_agent_pc05'], true, { legacyTaughtInput: true, genericTaughtOpener: true });
  await f.switchTo('demo__scenario_customer_pc03', 'company');
  assert.equal(f.inputClicks(), 1);
  assert.equal(f.opens(), 1);
  assert.deepEqual(f.clicked, ['demo__scenario_agent_pc05']);
});

test('real project option with conflicting item identity is never clicked', async () => {
  const f = pageFixture(['demo__scenario_agent_pc05'], true, { realSnSelect: true, optionQaMismatch: true });
  await f.switchTo('demo__scenario_customer_pc03', 'company');
  assert.deepEqual(f.clicked, []);
  assert.equal(f.messages.at(-1).stage, 'item-fail');
});

test('real project option without the dedicated item leaf does not fall back to aggregate text', async () => {
  const f = pageFixture(['demo__scenario_agent_pc05'], true, { realSnSelect: true, missingOptionLeaf: true });
  await f.switchTo('demo__scenario_customer_pc03', 'company');
  assert.deepEqual(f.clicked, []);
  assert.equal(f.messages.at(-1).stage, 'item-fail');
});

test('company mode accepts an available agent variant when the exact caller ID is missing', async () => {
  const f = pageFixture(['demo__scenario_customer_pc03', 'demo__scenario_agent_pc05', 'demo__scenario_agent_pc07'], true, { initialSelected: 'other__old_agent_ab01' });
  await f.switchTo('demo__scenario_customer_pc03', 'company');
  assert.deepEqual(f.clicked, ['demo__scenario_agent_pc05']);
  assert.equal(f.messages.at(-1).stage, 'item-done');
});

test('company mode rejects a different named company in the same category and never chooses a customer item', async () => {
  const f = pageFixture(['other__scenario_agent_pc03', 'demo__scenario_customer_pc03', 'demo__different_company_agent_ab05'], true, { initialSelected: 'other__old_agent_ab01' });
  await f.switchTo('demo__scenario_customer_pc03', 'company');
  assert.deepEqual(f.clicked, []);
  assert.equal(f.messages.at(-1).stage, 'item-fail');
});

test('company mode stays on the current agent item when that company already matches', async () => {
  const f = pageFixture(['demo__scenario_agent_pc05'], true, { initialSelected: 'demo__scenario_agent_pc07' });
  await f.switchTo('demo__scenario_customer_pc03', 'company');
  assert.equal(f.opens(), 0);
  assert.deepEqual(f.clicked, []);
  assert.equal(f.messages.at(-1).selected, true);
});

test('company mode refuses an available item from a different company', async () => {
  const f = pageFixture(['other__scenario_agent_pc03'], true, { initialSelected: 'other__old_agent_ab01' });
  await f.switchTo('demo__scenario_customer_pc03', 'company');
  assert.deepEqual(f.clicked, []);
  assert.equal(f.messages.at(-1).stage, 'item-fail');
});

test('customer task selects its unique agent counterpart and verifies actual editor selection', async () => {
  const f = pageFixture(['demo__scenario_customer_pc01', 'demo__scenario_agent_pc01']);
  await f.switchTo('demo__scenario_customer_pc01');
  assert.deepEqual(f.clicked, ['demo__scenario_agent_pc01']);
  assert.equal(f.selected(), 'demo__scenario_agent_pc01');
  assert.equal(f.messages.at(-1).stage, 'item-done');
  assert.equal(f.messages.at(-1).selected, true);
});

test('multiple agent variants do not cause an arbitrary item click', async () => {
  const f = pageFixture(['demo__scenario_agent_pc01', 'demo__scenario_agent_pc03']);
  await f.switchTo('demo__scenario');
  assert.deepEqual(f.clicked, []);
  assert.equal(f.messages.at(-1).stage, 'item-fail');
});

test('an explicit caller variant selects only the exact agent ID from multiple options', async () => {
  const f = pageFixture(['demo__scenario_agent_pc01', 'demo__scenario_agent_pc03', 'demo__scenario_agent_pc05']);
  await f.switchTo('demo__scenario_customer_pc05');
  assert.deepEqual(f.clicked, ['demo__scenario_agent_pc05']);
  assert.equal(f.messages.at(-1).stage, 'item-done');
});

test('a missing caller variant never falls back to another available agent ID', async () => {
  const f = pageFixture(['demo__scenario_agent_pc03']);
  await f.switchTo('demo__scenario_customer_pc01');
  assert.deepEqual(f.clicked, []);
  assert.equal(f.messages.at(-1).stage, 'item-fail');
});

test('legitimate no-role exact item is selectable', async () => {
  const f = pageFixture(['demo__scenario']);
  await f.switchTo('demo__scenario');
  assert.deepEqual(f.clicked, ['demo__scenario'], JSON.stringify(f.messages));
  assert.equal(f.messages.at(-1).stage, 'item-done');
});

test('clicking an option without a real selection change never acknowledges completion', async () => {
  const f = pageFixture(['demo__scenario_agent_pc01'], false);
  await f.switchTo('demo__scenario_customer_pc01');
  assert.equal(f.messages.some(message => message.stage === 'item-done'), false);
  assert.equal(f.messages.at(-1).stage, 'item-fail');
});

test('a retry during an outstanding switch does not open competing menus', async () => {
  const f = pageFixture(['demo__scenario_agent_pc01']);
  await Promise.all([f.switchTo('demo__scenario_customer_pc01'), f.switchTo('demo__scenario_customer_pc01')]);
  assert.equal(f.opens(), 1);
  assert.equal(f.clicked.length, 1);
});

test('call activity cancellation while options are pending prevents a later click', async () => {
  const f = pageFixture(['demo__scenario_agent_pc01'], true, { delayedOptions: true, cancelOnPoll: true });
  await f.switchTo('demo__scenario_customer_pc01');
  assert.equal(f.opens(), 1);
  assert.deepEqual(f.clicked, []);
  assert.equal(f.messages.some(message => message.stage === 'item-done'), false);
});

test('a combobox search query is never reported as the selected editor item', async () => {
  const f = pageFixture(['demo__scenario_agent_pc01'], true, {
    delayedOptions: true, cancelOnPoll: true, searchInputOnly: true,
    onPoll: ctx => ctx.followFixture.tick()
  });
  await f.switchTo('demo__scenario_customer_pc01');
  const heartbeat = f.messages.filter(message => message.type === 'km-tick').at(-1);
  assert.notEqual(heartbeat.item, 'demo__scenario');
  assert.notEqual(heartbeat.itemAuthority, 'editor');
  assert.equal(f.messages.some(message => message.stage === 'item-done'), false);
});

function backgroundFixture(item) {
  const state = { tab9: { lastBusy: Date.now() - 600000, item, itemAuthority: 'editor', itemSeenAt: Date.now(), pending: null, cooldownUntil: 0 } };
  const sent = [], event = { addListener() {} };
  const context = vm.createContext({
    Date, AbortSignal, console,
    chrome: {
      storage: {
        sync: { get: async defaults => ({ ...defaults, topic: 'fixture-topic', idleMinutes: '1', matchBy: 'item' }) },
        session: { get: async key => ({ [key]: structuredClone(state[key]) }), set: async values => Object.assign(state, structuredClone(values)), remove() {} }
      },
      runtime: { onMessage: event, onInstalled: event, onStartup: event },
      tabs: { sendMessage: async (id, message) => sent.push(message), onRemoved: event }, alarms: { onAlarm: event }, action: {}
    },
    fetch: async () => ({ ok: true, text: async () => JSON.stringify({ event: 'message', time: Date.now() / 1000, message: JSON.stringify({ v: 1, item: 'demo__scenario_customer_pc01' }) }) })
  });
  vm.runInContext(source('item-identity.js'), context); vm.runInContext(source('background.js'), context);
  return { state, sent, context };
}

test('already selected matching agent scenario does not loop back to the customer task', async () => {
  const f = backgroundFixture('demo__scenario_agent_pc01');
  await vm.runInContext("onTick(9, {busy:false,item:'demo__scenario_agent_pc01',itemAuthority:'editor'}, 4)", f.context);
  assert.equal(f.sent.some(message => message.type === 'km-switch'), false);
});

test('weaker embedded header cannot overwrite fresh editor selection or falsely finish switching', async () => {
  const f = backgroundFixture('demo__previous_agent_tp01');
  f.state.tab9.pending = { target: 'demo__scenario_customer_pc01', stage: 'item', at: Date.now(), sentAt: Date.now() };
  await vm.runInContext("onTick(9, {busy:false,item:'demo__scenario',itemAuthority:'scenario'}, 7)", f.context);
  assert.equal(f.state.tab9.item, 'demo__previous_agent_tp01');
  assert.equal(f.state.tab9.pending.stage, 'item');
  await vm.runInContext("onProgress(9, {stage:'item-done',item:'demo__scenario'})", f.context);
  assert.equal(f.state.tab9.pending.stage, 'item');
});

test('same scenario with the wrong task ID does not satisfy a pending switch or progress acknowledgment', async () => {
  const f = backgroundFixture('demo__scenario_agent_pc03');
  f.state.tab9.pending = { target: 'demo__scenario_customer_pc01', stage: 'item', at: Date.now(), sentAt: Date.now() };
  await vm.runInContext("onTick(9, {busy:false,item:'demo__scenario_agent_pc03',itemAuthority:'editor'}, 4)", f.context);
  assert.equal(f.state.tab9.pending.stage, 'item');
  await vm.runInContext("onProgress(9, {stage:'item-done',item:'demo__scenario_agent_pc03',selected:true})", f.context);
  assert.equal(f.state.tab9.pending.stage, 'item');
});

test('same scenario with the wrong task ID still requests the caller exact task', async () => {
  const f = backgroundFixture('demo__scenario_agent_pc03');
  await vm.runInContext("onTick(9, {busy:false,item:'demo__scenario_agent_pc03',itemAuthority:'editor'}, 4)", f.context);
  assert.equal(f.sent.find(message => message.type === 'km-switch').target, 'demo__scenario_customer_pc01');
});

test('identity parser retains unrelated suffixes and rejects invalid task names', () => {
  const f = pageFixture([]), identity = f.ctx.KeyMapperItems;
  assert.equal(identity.parse('banking__scenario_agent_notes_extra').key, 'banking__scenario_agent_notes_extra');
  assert.equal(identity.parse('demo__customer_service').key, 'demo__customer_service');
  assert.equal(identity.parse('demo__scenario_customer_service').key, 'demo__scenario_customer_service');
  assert.equal(identity.parse('demo__customer_pc01').key, 'demo__customer_pc01');
  assert.equal(identity.parse('not an item'), null);
  assert.equal(identity.sameScenario('banking__one_customer_pc01', 'banking__two_agent_tp01'), false);
  assert.equal(identity.sameTask('demo__scenario_customer_PC05', 'demo__scenario_agent_pc05'), true);
  assert.equal(identity.sameTask('demo__scenario_customer_pc01', 'demo__scenario_agent_pc03'), false);
  assert.equal(identity.sameTask('demo__scenario_customer_pc01', 'demo__scenario'), false);
});
