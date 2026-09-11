const BRIDGE = "ws://127.0.0.1:17381";
const HEALTH = "http://127.0.0.1:17381/health";
const MEME_URLS = [
  "https://youtu.be/XqZsoesa55w?si=6oJfXHm_esOwN4fl",
  "https://youtu.be/dxo23k5voiE?si=afoFkCiKQBzd2rUp",
];
const PROTECTED_HOSTS = new Set(["accounts.google.com", "passwords.google.com"]);
let socket;
let reconnectTimer;
let lastClosedUrl = null;
let lastSleepPrankAt = 0;
let config = {
  petEnabled: true,
  chaosEnabled: false,
  sleepPranksEnabled: false,
};

function randomMemeUrl() {
  return MEME_URLS[Math.floor(Math.random() * MEME_URLS.length)];
}

async function connect() {
  clearTimeout(reconnectTimer);
  try {
    const response = await fetch(HEALTH, { cache: "no-store" });
    if (!response.ok) throw new Error("desktop unavailable");
  } catch {
    chrome.storage.local.set({ bridgeState: "waiting" });
    reconnectTimer = setTimeout(connect, 3000);
    return;
  }
  socket = new WebSocket(BRIDGE);
  socket.onopen = () => {
    chrome.storage.local.set({ bridgeState: "connected" });
    reportActivity();
  };
  socket.onmessage = (event) => {
    try { handle(JSON.parse(event.data)); } catch { /* Ignore malformed local messages. */ }
  };
  socket.onclose = () => {
    chrome.storage.local.set({ bridgeState: "waiting" });
    reconnectTimer = setTimeout(connect, 3000);
  };
  socket.onerror = () => socket.close();
}

function send(type, payload) {
  if (type === "result" && payload?.message) chrome.storage.local.set({ lastResult: payload.message });
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type, payload }));
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}

async function reportActivity() {
  const tab = await activeTab();
  if (!tab) return;
  let host = "";
  try { host = new URL(tab.url).hostname; } catch { /* Internal page. */ }
  send("activity", { id: tab.id, title: tab.title || "Untitled", host });
}

function protectedUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return !["http:", "https:"].includes(url.protocol) ||
      url.hostname === "localhost" || url.hostname === "127.0.0.1" ||
      PROTECTED_HOSTS.has(url.hostname);
  } catch {
    return true;
  }
}

async function closeActive() {
  const tab = await activeTab();
  if (!tab || tab.pinned || protectedUrl(tab.url)) {
    return send("result", { success: false, message: "I was prevented from closing a protected tab." });
  }

  let pageState = { editedForm: true };
  try {
    pageState = await chrome.tabs.sendMessage(tab.id, { type: "page_state" });
  } catch {
    try {
      const [injected] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => ({
          editedForm: [...document.querySelectorAll("input, textarea, select")].some((field) => {
            if (field.type === "password") return true;
            if (["checkbox", "radio"].includes(field.type)) return field.checked !== field.defaultChecked;
            return field.value !== field.defaultValue;
          }),
        }),
      });
      pageState = injected?.result || { editedForm: true };
    } catch {
      return send("result", { success: false, message: "I could not prove that this tab was safe to close." });
    }
  }
  if (pageState.editedForm) {
    return send("result", { success: false, message: "That tab has edited form fields, so I spared it." });
  }

  lastClosedUrl = tab.url;
  await chrome.tabs.remove(tab.id);
  send("result", { success: true, message: `Closed “${tab.title || "a boring tab"}”. Undo is available.` });
}

async function handle(message) {
  if (message.type === "heartbeat") {
    return send("heartbeat_ack", { at: Date.now() });
  }
  if (message.type === "config") {
    config = { ...config, ...message.payload };
    return;
  }
  if (message.type === "stop_chaos") {
    config.chaosEnabled = false;
    config.sleepPranksEnabled = false;
    return send("result", { success: true, message: "Lui has been temporarily contained." });
  }
  if (message.type === "close_active") await closeActive();
  if (message.type === "undo_close") {
    if (!lastClosedUrl) return send("result", { success: false, message: "There is no prank to undo." });
    await chrome.tabs.create({ url: lastClosedUrl });
    lastClosedUrl = null;
    send("result", { success: true, message: "Restored the tab. I regret nothing." });
  }
  if (message.type === "open_meme") {
    await chrome.tabs.create({ url: randomMemeUrl() });
    send("result", { success: true, message: "Opened emergency Malayalam entertainment." });
  }
  if (message.type === "pet_visit") {
    const tab = await activeTab();
    if (!tab || protectedUrl(tab.url)) {
      return send("result", { success: false, message: "Lui cannot enter this protected page." });
    }
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: "pet_visit",
        imageUrl: chrome.runtime.getURL("icon.png"),
        line: message.payload?.line,
      });
    } catch {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      await chrome.tabs.sendMessage(tab.id, {
        type: "pet_visit",
        imageUrl: chrome.runtime.getURL("icon.png"),
        line: message.payload?.line,
      });
    }
    send("result", { success: true, message: "Lui walked into the current webpage." });
  }
}

async function handleIdleState(newState) {
  send("idle_state", { state: newState });
  if (newState === "active" || !config.petEnabled || !config.chaosEnabled || !config.sleepPranksEnabled) return;
  const now = Date.now();
  if (now - lastSleepPrankAt < 10 * 60 * 1000) return;
  lastSleepPrankAt = now;
  await chrome.tabs.create({ url: randomMemeUrl(), active: true });
  send("result", { success: true, message: "Lui detected sleep and prescribed a Malayalam meme." });
}

chrome.tabs.onActivated.addListener(reportActivity);
chrome.tabs.onUpdated.addListener((_id, info) => { if (info.status === "complete") reportActivity(); });
chrome.idle.setDetectionInterval(60);
chrome.idle.onStateChanged.addListener(handleIdleState);
chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message.type !== "popup_action") return;
  const allowed = new Set(["pet_visit", "close_active", "undo_close", "open_meme"]);
  if (!allowed.has(message.action)) {
    respond({ ok: false });
    return;
  }
  handle({ type: message.action, payload: { line: "I found your browser unsupervised." } })
    .then(() => respond({ ok: true }))
    .catch((error) => {
      chrome.storage.local.set({ lastResult: `Lui failed: ${error.message}` });
      respond({ ok: false });
    });
  return true;
});
connect();
