// Key Mapper - content script (runs in every frame of SuperAnnotate pages).
// 1) Auto-clicks Accept / Connect / Run <tool> buttons (or on Enter). Alt+Shift+A toggles.
// 2) Reports busy/idle + current item to background.js, and on its command switches
//    to the caller's item and sets the call status (e.g. AgentInCall).
(() => {
  const SA = /superannotate\.com/i;
  const anc = Array.from(location.ancestorOrigins || []);
  if (!SA.test(location.href) && !anc.some((o) => SA.test(o))) return;

  const TAG = "[Key Mapper]";
  const MSG = "key-mapper-enter-click";
  const TARGETS = [
    /^accept(\s+[\w .-]*)?$/i,   // "Accept", "Accept call", ...
    /^connect(\s+[\w .-]*)?$/i,  // "Connect", "Connect audio", ... (not "Disconnect")
    /^run\s+[\w.-]+$/i,          // "Run verify_customer", ...
  ];
  const rank = (t) => TARGETS.findIndex((re) => re.test(t));
  const HL_STYLE =
    "outline:4px solid #ffb400 !important;outline-offset:3px !important;box-shadow:0 0 0 8px rgba(255,180,0,.45) !important;";
  let current = null;
  let savedStyle = "";

  // ---- Auto-click (no Enter needed). Toggle with Alt+Shift+A. ----
  const AUTO_DELAY_MS = 700;
  const AUTO_KEY = "key-mapper-auto";
  let autoOn = true;
  try { autoOn = localStorage.getItem(AUTO_KEY) !== "off"; } catch (_) {}
  const autoClicked = new WeakMap();
  let autoTimer = null;
  let lastClickAt = 0; // counts as activity

  const send = (m) => { try { chrome.runtime.sendMessage(m).catch(() => {}); } catch (_) {} };

  function toast(text, color) {
    if (window !== window.top) { send({ type: "km-toast", text, color }); return; }
    const d = document.createElement("div");
    d.textContent = "Key Mapper: " + text;
    d.setAttribute("style",
      "position:fixed;z-index:2147483647;bottom:20px;right:20px;padding:8px 14px;border-radius:6px;max-width:420px;" +
      "background:" + (color || "#222") + ";color:#fff;font:13px sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.4);");
    document.documentElement.appendChild(d);
    setTimeout(() => d.remove(), 3500);
  }

  function maybeAutoClick() {
    if (!autoOn || !current || autoTimer || switching) return;
    const b = current, t = label(b);
    if (autoClicked.get(b) === t) return;
    autoTimer = setTimeout(() => {
      autoTimer = null;
      if (!autoOn) return;
      refresh();
      if (current !== b || label(b) !== t) return;
      if (b.disabled || b.getAttribute("aria-disabled") === "true") return;
      autoClicked.set(b, t);
      console.log(TAG, "auto-clicking:", t);
      clickRun();
    }, AUTO_DELAY_MS);
  }

  console.log(TAG, "loaded in frame:", location.href);

  function* walk(root) {
    const stack = [root];
    while (stack.length) {
      const node = stack.pop();
      const els = node.querySelectorAll ? node.querySelectorAll("*") : [];
      for (const el of els) {
        yield el;
        if (el.shadowRoot) stack.push(el.shadowRoot);
      }
    }
  }

  function isVisible(el) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const s = getComputedStyle(el);
    return s.visibility !== "hidden" && s.display !== "none";
  }

  function isClickable(el) {
    const tag = el.tagName;
    if (tag === "BUTTON" || tag === "A" || tag === "SN-CHIP") return true;
    if (tag === "INPUT" && /^(button|submit)$/i.test(el.type)) return true;
    if (/^(button|option|menuitem|combobox)$/.test(el.getAttribute("role") || "")) return true;
    return getComputedStyle(el).cursor === "pointer";
  }

  function label(el) {
    return (el.tagName === "INPUT" ? el.value : el.textContent || "").replace(/\s+/g, " ").trim();
  }

  function findRunButton() {
    let best = null, bestRank = Infinity;
    for (const el of walk(document)) {
      const t = label(el);
      if (t.length > 60) continue;
      const r = rank(t);
      if (r < 0) continue;
      if (el.disabled || el.getAttribute("aria-disabled") === "true") continue;
      if (!isVisible(el) || !isClickable(el)) continue;
      if (r < bestRank || (r === bestRank && el.contains(best))) { best = el; bestRank = r; }
    }
    return best;
  }

  function unhighlight() {
    if (current) current.setAttribute("style", savedStyle);
  }

  function refresh() {
    const b = findRunButton();
    if (b === current) { maybeAutoClick(); return; }
    unhighlight();
    current = b;
    if (b) {
      savedStyle = b.getAttribute("style") || "";
      b.setAttribute("style", savedStyle + ";" + HL_STYLE);
      console.log(TAG, "highlighted:", label(b));
      maybeAutoClick();
    }
  }

  function clickRun() {
    refresh();
    if (!current) return false;
    const b = current;
    b.scrollIntoView({ block: "center", behavior: "smooth" });
    b.click();
    lastClickAt = Date.now();
    console.log(TAG, "clicked:", label(b));
    setTimeout(() => { current = null; refresh(); }, 400);
    return true;
  }

  function relayToChildren(data) {
    for (let i = 0; i < window.frames.length; i++) {
      try { window.frames[i].postMessage(data || { type: MSG }, "*"); } catch (_) {}
    }
  }

  function isTypingField(el) {
    while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
    if (!el) return false;
    return el.isContentEditable || el.tagName === "TEXTAREA";
  }

  window.addEventListener(
    "keydown",
    (e) => {
      if (e.altKey && e.shiftKey && (e.key === "A" || e.key === "a")) {
        autoOn = !autoOn;
        try { localStorage.setItem(AUTO_KEY, autoOn ? "on" : "off"); } catch (_) {}
        relayToChildren({ type: MSG + "-auto", on: autoOn });
        toast("auto-click " + (autoOn ? "ON" : "OFF"));
        e.preventDefault();
        if (autoOn) refresh();
        return;
      }
      if (e.key !== "Enter" || e.shiftKey || e.altKey || e.isComposing) return;
      if (!e.ctrlKey && !e.metaKey && isTypingField(document.activeElement)) return;
      if (clickRun()) {
        e.preventDefault();
        e.stopPropagation();
      } else {
        relayToChildren();
      }
    },
    true
  );

  window.addEventListener("message", (e) => {
    if (e.data && e.data.type === MSG && !clickRun()) relayToChildren();
    if (e.data && e.data.type === MSG + "-auto") {
      autoOn = !!e.data.on;
      try { localStorage.setItem(AUTO_KEY, autoOn ? "on" : "off"); } catch (_) {}
      relayToChildren(e.data);
      if (autoOn) refresh();
    }
  });

  let pending = false;
  const schedule = () => {
    if (pending) return;
    pending = true;
    setTimeout(() => { pending = false; refresh(); }, 150);
  };
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(refresh, 1000);
  refresh();

  // =====================================================================
  // Follow the caller: busy/idle reporting + item switch + status change
  // =====================================================================
  const ITEM_RE = /\b[a-z0-9]+(?:_[a-z0-9]+)*__[a-z0-9]+(?:_[a-z0-9]+)*\b/gi;
  const IS_ITEM = /^[a-z0-9]+(?:_[a-z0-9]+)*__[a-z0-9_]+$/i;
  const BUSY_TEXT = /Sending the agent recording|Collecting the agent|Conversation in progress|Uploading/i;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let switching = false;

  // Current item name in this frame, e.g. "travel_hospitality__tideglass_passage".
  function detectItem() {
    const text = (document.body && document.body.innerText) || "";
    // Header line "travel_hospitality · travel_hospitality__tideglass_passage" wins.
    const h = text.match(/([a-z0-9_]+)\s*·\s*(\1__[a-z0-9_]+)/i);
    if (h) return h[2];
    const counts = {};
    for (const m of text.match(ITEM_RE) || []) counts[m] = (counts[m] || 0) + 1;
    let best = null;
    for (const k in counts) if (!best || counts[k] > counts[best]) best = k;
    return best;
  }

  function isBusy() {
    if (Date.now() - lastClickAt < 10000) return true;
    if (current) return true; // an Accept / Connect / Run button is up
    for (const el of walk(document)) {
      if (el.tagName !== "BUTTON") continue;
      const a = (el.getAttribute("aria-label") || "") + " " + (el.className || "");
      if (/end current call|hangup-button/i.test(a) && isVisible(el)) return true;
    }
    return BUSY_TEXT.test((document.body && document.body.innerText) || "");
  }

  // ---- learned elements (teach mode) ----
  function describe(el) {
    const path = [];
    for (let n = el; n && n.nodeType === 1 && path.length < 6; n = n.parentElement) {
      let i = 1;
      for (let s = n.previousElementSibling; s; s = s.previousElementSibling) if (s.tagName === n.tagName) i++;
      path.unshift(n.tagName.toLowerCase() + ":" + i);
    }
    return {
      tag: el.tagName.toLowerCase(),
      cls: Array.from(el.classList).filter((c) => !/active|hover|focus|open|ng-|\d{3,}/i.test(c)),
      aria: el.getAttribute("aria-label") || "",
      role: el.getAttribute("role") || "",
      testid: el.getAttribute("data-testid") || "",
      id: /\d{3,}/.test(el.id) ? "" : el.id,
      path: path.join(">"),
    };
  }
  function score(el, d) {
    if (el.tagName.toLowerCase() !== d.tag) return 0;
    let s = 1;
    if (d.id && el.id === d.id) s += 5;
    if (d.testid && el.getAttribute("data-testid") === d.testid) s += 5;
    if (d.aria && el.getAttribute("aria-label") === d.aria) s += 3;
    if (d.role && el.getAttribute("role") === d.role) s += 1;
    for (const c of d.cls) if (el.classList.contains(c)) s += 1;
    if (describe(el).path === d.path) s += 3;
    return s;
  }
  function findTaught(d) {
    if (!d) return null;
    let best = null, bs = 2;
    for (const el of walk(document)) {
      if (!isVisible(el)) continue;
      const s = score(el, d);
      if (s > bs) { best = el; bs = s; }
    }
    return best;
  }
  const getTaught = async () => (await chrome.storage.local.get({ taught: {} })).taught;

  let teachSlot = null;
  document.addEventListener("click", async (e) => {
    if (!teachSlot) return;
    let el = e.target;
    while (el && el.parentElement && !isClickable(el)) el = el.parentElement;
    const slot = teachSlot;
    teachSlot = null;
    const taught = await getTaught();
    taught[slot] = describe(el);
    await chrome.storage.local.set({ taught });
    send({ type: "km-taught", slot });
    toast("learned the " + slot + " dropdown", "#1a7f37");
  }, true);

  // ---- synthetic click + typing ----
  function realClick(el) {
    el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, view: window, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0 };
    el.dispatchEvent(new PointerEvent("pointerdown", o));
    el.dispatchEvent(new MouseEvent("mousedown", o));
    el.dispatchEvent(new PointerEvent("pointerup", o));
    el.dispatchEvent(new MouseEvent("mouseup", o));
    el.dispatchEvent(new MouseEvent("click", o));
  }
  function typeInto(input, text) {
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: text.slice(-1) }));
  }
  async function waitFor(fn, ms) {
    for (const end = Date.now() + ms; Date.now() < end; await sleep(200)) {
      const v = fn();
      if (v) return v;
    }
    return null;
  }
  // Innermost visible clickable element whose text matches.
  function findByText(test, exclude) {
    let best = null;
    for (const el of walk(document)) {
      if (el === exclude || (exclude && exclude.contains(el))) continue;
      const t = label(el);
      if (!t || t.length > 120 || !test(t)) continue;
      if (!isVisible(el)) continue;
      if (!best || best.contains(el)) best = el;
    }
    if (!best) return null;
    let c = best;
    while (c && !isClickable(c) && c.parentElement) c = c.parentElement;
    return c || best;
  }

  const sameItem = (lbl, item) =>
    lbl === item || (/(\.\.\.|…)$/.test(lbl) && item.startsWith(lbl.replace(/(\.\.\.|…)$/, "")));

  function findItemTrigger(taught, myItem) {
    const t = findTaught(taught.item);
    if (t) return t;
    if (!myItem) return null;
    let best = null;
    for (const el of walk(document)) {
      if (!isClickable(el) || !isVisible(el)) continue;
      if (!sameItem(label(el), myItem)) continue;
      if (!el.querySelector("svg, img, i")) continue; // dropdowns have a chevron/icon
      if (!best || el.getBoundingClientRect().top < best.getBoundingClientRect().top) best = el;
    }
    return best;
  }

  function findStatusTrigger(taught) {
    const t = findTaught(taught.status);
    if (t) return t;
    for (const el of walk(document)) {
      if (el.tagName !== "BUTTON" || !el.classList.contains("dropdown-menu-trigger")) continue;
      if (isVisible(el) && /^[A-Z][A-Za-z]+$/.test(label(el)) && !IS_ITEM.test(label(el))) return el;
    }
    return null;
  }

  async function switchItem(target) {
    const taught = await getTaught();
    const myItem = detectItem();
    if (myItem === target) return send({ type: "km-progress", stage: "item-done", item: target });
    const trig = findItemTrigger(taught, myItem);
    if (!trig) return; // not in this frame
    switching = true;
    try {
      toast("caller is on " + target + " - switching item…", "#0b5cad");
      const before = new Set(Array.from(document.querySelectorAll("input")));
      realClick(trig);
      const search = await waitFor(() => {
        const inputs = Array.from(document.querySelectorAll("input")).filter((i) => isVisible(i) && !/^(checkbox|radio|hidden)$/i.test(i.type));
        return inputs.find((i) => /search|item/i.test(i.placeholder || "")) || inputs.find((i) => !before.has(i)) ||
               (document.activeElement && document.activeElement.tagName === "INPUT" ? document.activeElement : null);
      }, 4000);
      if (search) typeInto(search, target);
      const opt = await waitFor(() => findByText((t) => t === target, trig), 8000);
      if (!opt) {
        toast("could not find item " + target + " in the list. Teach the item dropdown in the popup.", "#b42318");
        return send({ type: "km-progress", stage: "item-fail", item: target });
      }
      realClick(opt);
      send({ type: "km-progress", stage: "item-clicked", item: target });
    } finally {
      switching = false;
    }
  }

  async function setStatus(want) {
    const taught = await getTaught();
    const trig = findStatusTrigger(taught);
    if (!trig) return;
    if (label(trig) === want) return send({ type: "km-progress", stage: "status-done" });
    switching = true;
    try {
      realClick(trig);
      const opt = await waitFor(() => findByText((t) => t === want || new RegExp("(→|->)\\s*" + want + "$").test(t), trig), 4000);
      if (!opt) {
        realClick(trig); // close it again
        toast('no "' + want + '" option in the status dropdown. Teach it in the popup.', "#b42318");
        return send({ type: "km-progress", stage: "status-fail" });
      }
      realClick(opt);
      toast("status set to " + want, "#1a7f37");
      send({ type: "km-progress", stage: "status-done" });
    } finally {
      switching = false;
    }
  }

  chrome.runtime.onMessage.addListener((m) => {
    if (m.type === "km-switch") switchItem(m.target);
    else if (m.type === "km-status") setStatus(m.want);
    else if (m.type === "km-teach-done") teachSlot = null;
    else if (m.type === "km-teach") { teachSlot = m.slot; setTimeout(() => { teachSlot = null; }, 30000); if (window === window.top) toast("click the " + m.slot + " dropdown now", "#0b5cad"); }
    else if (m.type === "km-toast" && window === window.top) toast(m.text, m.color);
  });

  // Heartbeat to background every 3 s.
  const tick = () => {
    const trig = findStatusTrigger({});
    send({ type: "km-tick", busy: isBusy(), item: detectItem(), status: trig ? label(trig) : null });
  };
  setInterval(tick, 3000);
  tick();
})();
