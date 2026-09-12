const { app, BrowserWindow, ipcMain, Menu, Notification, screen, powerMonitor, globalShortcut, safeStorage } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { WebSocketServer } = require("ws");
const { decide: decideAsLui, getStatus: getAiStatus } = require("./ai/lui-engine");
const { randomAudioUrl } = require("./audio");
const { saveKey, readKey } = require("./secrets");
const { reminderState, idleMemeDue } = require("./timing");

const PORT = 17381;
const PET_GROUND_MARGIN = 10;
const PET_WIDTH = 170;
const PET_HEIGHT = 170;
const PET_WINDOW_HEIGHT = 300;
const hasSingleInstanceLock = app.requestSingleInstanceLock();
let appIsQuitting = false;
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
let mainWindow;
let petWindow;
let extensionSocket;
let stateFile;
let tickTimer;
let reminderTimer;
let aiStatusTimer;
let petMovementTimer;
let bridgeHeartbeatTimer;
let petX = 0;
let petDirection = -1;
let luiDecisionInFlight = false;
let lastLuiDecisionAt = 0;
let petRestUntil = 0;
let lastIdleMemeAt = 0;
let previousMoveAt = Date.now();
let lastPetLift = -1;
let tabCloseUntil = 0;
let petJumpStartedAt = 0;
let petJumpUntil = 0;
let activeEmotion = null;
let emotionUntil = 0;
let nextRestAt = Date.now() + 12000;
let nextChaosAt = Date.now() + 45000;
let chaosTimer;
let sarvamApiKey = process.env.SARVAM_API_KEY || "";
const chatHistory = [];
const pendingActions = new Set();
function later(callback, delay) {
  const timer = setTimeout(() => { pendingActions.delete(timer); if (!appIsQuitting) callback(); }, delay);
  pendingActions.add(timer);
}
const panelWindows = new Map();
const assetRoot = path.join(__dirname, "..", "assets");

let state = {
  mood: "neutral",
  petLine: "I am observing your questionable decisions.",
  boredom: 0,
  connection: "waiting",
  currentTab: null,
  todos: [],
  notes: [],
  events: [],
  settings: {
    petEnabled: true,
    chaosEnabled: true,
    sleepPranksEnabled: true,
    localAiEnabled: true,
    petWalkingEnabled: true,
    idleMemeSeconds: 30,
  },
  ai: { available: false, running: false, model: "gemma3:270m" },
  eventLog: ["The creature has awakened."],
};

function loadState() {
  stateFile = path.join(app.getPath("userData"), "wth-state.json");
  sarvamApiKey = readKey(app.getPath("userData")) || sarvamApiKey;
  try { sarvamApiKey = safeStorage.decryptString(fs.readFileSync(path.join(app.getPath("userData"), "sarvam-key.bin"))); } catch { /* Environment key or settings UI. */ }
  try {
    const saved = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    state.todos = Array.isArray(saved.todos) ? saved.todos : [];
    state.notes = Array.isArray(saved.notes) ? saved.notes : [];
    state.events = Array.isArray(saved.events) ? saved.events : [];
    state.settings = { ...state.settings, ...(saved.settings || {}) };
    // Migrate the original one-minute default to the requested 30-second cue
    // without overriding a deliberate custom delay.
    if (state.settings.idleMemeSeconds === 60) state.settings.idleMemeSeconds = 30;
    // Existing installs had this feature opt-in. Enable the new 30-second
    // behaviour once, while preserving any choice made after this migration.
    if (state.settings.idleMemePolicyVersion !== 1) {
      state.settings.sleepPranksEnabled = true;
      state.settings.idleMemePolicyVersion = 1;
    }
    if (state.settings.browserChaosPolicyVersion !== 1) {
      state.settings.chaosEnabled = true;
      state.settings.browserChaosPolicyVersion = 1;
    }
  } catch {
    // First run or invalid state: start clean.
  }
}

function saveState() {
  fs.writeFileSync(`${stateFile}.tmp`, JSON.stringify({
    todos: state.todos,
    notes: state.notes,
    events: state.events,
    settings: state.settings,
  }, null, 2));
  fs.renameSync(`${stateFile}.tmp`, stateFile);
}

function log(message) {
  state.eventLog.unshift(message);
  state.eventLog = state.eventLog.slice(0, 12);
}

function updateMood() {
  state.mood = activeEmotion && Date.now() < emotionUntil
    ? activeEmotion
    : state.boredom >= 75 ? "chaotic" : state.boredom >= 40 ? "annoyed" : "neutral";
  if (activeEmotion && Date.now() >= emotionUntil) activeEmotion = null;
}

function setLuiEmotion(emotion, duration = 3500) {
  activeEmotion = emotion;
  emotionUntil = Date.now() + duration;
}

function broadcastState() {
  updateMood();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("state", state);
  }
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send("state", state);
  }
  for (const panel of panelWindows.values()) {
    if (!panel.isDestroyed()) panel.webContents.send("state", state);
  }
}

function sendToExtension(type, payload = {}) {
  if (!extensionSocket || extensionSocket.readyState !== extensionSocket.OPEN) {
    log("Browser ignored me because the extension is disconnected.");
    broadcastState();
    return false;
  }
  extensionSocket.send(JSON.stringify({ type, payload }));
  return true;
}

function syncExtensionConfig() {
  sendToExtension("config", state.settings);
}

function playRandomMemeAudio() {
  const url = randomAudioUrl(assetRoot);
  if (!url) {
    log("Lui searched for meme audio but the folder was empty.");
    broadcastState();
    return false;
  }
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("meme-audio", url);
  log("Lui played a medically unnecessary sound.");
  broadcastState();
  return true;
}

function playPetAnimation(name) {
  petRestUntil = Date.now() + ({ sleep: 8000, sit: 4000, yawn: 1800, peek: 2500 }[name] || 900);
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send("pet-animation", name);
  }
}

function makeLuiJump(duration = 900) {
  petJumpStartedAt = Date.now();
  petJumpUntil = petJumpStartedAt + duration;
}

function notifyLuiRemoval(kind, title) {
  const label = kind === "schedule" ? "schedule" : "todo";
  state.petLine = `I removed your ${label}: ${title}. You're welcome.`.slice(0, 90);
  log(`Lui removed ${label} “${title}”.`);
  try {
    if (Notification.isSupported()) {
      new Notification({
        title: `Lui removed a ${label}`,
        body: `“${title}” was sent to the Void by Lui.`,
        silent: false,
      }).show();
    }
  } catch { /* Windows notification support is optional. */ }
}

function runRandomChaos() {
  if (appIsQuitting || !state.settings.petEnabled || !state.settings.chaosEnabled) return;
  const idleSeconds = powerMonitor.getSystemIdleTime();
  const ownerAway = idleSeconds >= 30;
  // Away mode always pairs the local meme with the browser meme tab.
  if (ownerAway || Math.random() < 0.58) {
    setLuiEmotion("happy");
    state.petLine = ownerAway ? "You left me alone. I found entertainment." : "A random tab has entered the chat.";
    makeLuiJump(1100);
    playPetAnimation("happy");
    playRandomMemeAudio();
    sendToExtensionAfterAnimation("open_meme", {}, "happy", 500);
  } else {
    state.petLine = "This tab has overstayed its welcome.";
    closeBrowserTabWithLui();
  }
  state.boredom = Math.min(100, state.boredom + 15);
  broadcastState();
  nextChaosAt = Date.now() + 20000 + Math.random() * 25000;
}

function closeBrowserTabWithLui() {
  // Travel only between valid work-area positions: climb to the tab strip,
  // swipe, close an eligible active tab, then return to the desktop.
  tabCloseUntil = Date.now() + 1450;
  setLuiEmotion("annoyed");
  makeLuiJump(1450);
  state.petLine = "I am climbing to that tab's little ×.";
  playPetAnimation("swipe");
  broadcastState();
  later(() => sendToExtension("close_active"), 980);
}

function sendToExtensionAfterAnimation(type, payload = {}, animation = "", delay = 0) {
  if (animation) playPetAnimation(animation);
  if (delay > 0) {
    later(() => sendToExtension(type, payload), delay);
    return true;
  }
  return sendToExtension(type, payload);
}

function performDecisionAction(decision, context) {
  if (!state.settings.petEnabled || !state.settings.chaosEnabled) return;
  if (decision.action === "open_meme") {
    setLuiEmotion("happy");
    makeLuiJump(900);
    sendToExtensionAfterAnimation("open_meme", {}, "happy", 300);
    playRandomMemeAudio();
  } else if (decision.action === "close_active") {
    closeBrowserTabWithLui();
  } else if (decision.action === "pet_visit") {
    sendToExtensionAfterAnimation("pet_visit", { line: decision.line }, "wave", 320);
  } else if (decision.action === "void_todo") {
    const todo = state.todos.find((item) => item.id === context.todoId && item.status === "alive") ||
      state.todos.find((item) => item.status === "alive");
    if (todo) {
      todo.status = "void";
      setLuiEmotion("annoyed");
      notifyLuiRemoval("todo", todo.text);
      saveState();
    }
  } else if (decision.action === "void_schedule") {
    const event = state.events.find((item) => item.id === context.eventId && item.status === "scheduled") ||
      state.events.find((item) => item.status === "scheduled");
    if (event) {
      event.status = "void";
      event.notifiedAt = null;
      setLuiEmotion("annoyed");
      notifyLuiRemoval("schedule", event.title);
      saveState();
    }
  }
}

async function runLuiDecision(context, allowAction = true) {
  if (luiDecisionInFlight || !state.settings.petEnabled) return null;
  luiDecisionInFlight = true;
  try {
    const decision = await decideAsLui({
      ...context,
      boredom: state.boredom,
      ...(context.kind === "chat" ? {} : {
        tab: state.currentTab,
        activeTodos: state.todos.filter((item) => item.status === "alive").slice(0, 5),
        upcomingEvents: state.events.filter((item) => item.status === "scheduled").slice(0, 5),
      }),
    }, { localAiEnabled: state.settings.localAiEnabled, sarvamApiKey });
    state.petLine = decision.line;
    log(`${decision.source}: ${decision.verdict} → ${decision.action}`);
    if (allowAction) performDecisionAction(decision, context);
    lastLuiDecisionAt = Date.now();
    broadcastState();
    return decision;
  } finally {
    luiDecisionInFlight = false;
  }
}

async function refreshAiStatus() {
  state.ai = await getAiStatus({ sarvamApiKey });
  broadcastState();
}

function maybeAutomaticDecision() {
  const cooldownPassed = Date.now() - lastLuiDecisionAt >= 2 * 60 * 1000;
  if (state.boredom >= 75 && cooldownPassed) {
    void runLuiDecision({ kind: "boredom", text: "The user has stayed boring for too long." });
  }
}

function startBridge() {
  const httpServer = http.createServer((request, response) => {
    const corsHeaders = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-allow-private-network": "true",
      "cache-control": "no-store",
    };
    if (request.method === "OPTIONS") {
      response.writeHead(204, corsHeaders);
      response.end();
      return;
    }
    if (request.url === "/health") {
      response.writeHead(204, corsHeaders);
      response.end();
      return;
    }
    response.writeHead(404);
    response.end();
  });
  const server = new WebSocketServer({ server: httpServer, maxPayload: 32768,
    verifyClient: ({ origin }) => typeof origin === "string" && origin.startsWith("chrome-extension://") });
  const listening = new Promise((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(PORT, "127.0.0.1", () => {
      httpServer.removeListener("error", reject);
      resolve();
    });
  });
  server.on("connection", (socket) => {
    extensionSocket = socket;
    state.connection = "connected";
    log("Browser extension connected.");
    broadcastState();
    syncExtensionConfig();

    socket.on("message", (raw) => {
      try {
        const message = JSON.parse(raw.toString());
        if (message.type === "activity") {
          state.currentTab = message.payload;
          state.boredom = Math.max(0, state.boredom - 4);
        } else if (message.type === "result") {
          log(message.payload.message);
          if (message.payload.success) state.boredom = 0;
        } else if (message.type === "idle_state") {
          log(message.payload.state === "active" ? "You have returned. Unfortunately." : "Lui thinks you fell asleep.");
        }
        broadcastState();
      } catch {
        log("The browser spoke nonsense.");
      }
    });

    socket.on("close", () => {
      if (extensionSocket !== socket) return;
      extensionSocket = null;
      state.connection = "waiting";
      log("Browser extension disconnected.");
      broadcastState();
    });
  });
  return listening;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 824,
    height: 464,
    minWidth: 660,
    minHeight: 420,
    useContentSize: true,
    alwaysOnTop: false,
    icon: path.join(__dirname, "..", "assets", "lui-meme-icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.on("closed", () => {
    mainWindow = null;
    if (!appIsQuitting) app.quit();
  });
}

function createPetWindow() {
  const workArea = screen.getPrimaryDisplay().workArea;
  petX = workArea.x + workArea.width - PET_WIDTH - 10;
  const y = workArea.y + workArea.height - PET_WINDOW_HEIGHT;
  petWindow = new BrowserWindow({
    title: "Lui Pet",
    width: PET_WIDTH,
    height: PET_WINDOW_HEIGHT,
    x: petX,
    y,
    transparent: true,
    frame: false,
    resizable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    icon: path.join(assetRoot, "lui-meme-icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  petWindow.setAlwaysOnTop(true, "screen-saver");
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  petWindow.loadFile(path.join(__dirname, "pet.html"));
  petWindow.webContents.on("did-finish-load", () => {
    petWindow.webContents.send("direction", petDirection);
    broadcastState();
  });
  if (!state.settings.petEnabled) petWindow.hide();
}

function movePet() {
  const now = Date.now();
  const elapsed = Math.min(0.2, (now - previousMoveAt) / 1000);
  previousMoveAt = now;
  if (!petWindow || petWindow.isDestroyed() || !state.settings.petEnabled || !state.settings.petWalkingEnabled) return;
  const closingTab = now < tabCloseUntil;
  if (now < petRestUntil && !closingTab) return;
  if (!closingTab && now >= nextRestAt) {
    const behaviors = ["sit", "yawn", "sleep", "peek"];
    playPetAnimation(behaviors[Math.floor(Math.random() * behaviors.length)]);
    nextRestAt = now + 18000 + Math.random() * 12000;
    return;
  }
  const workArea = screen.getPrimaryDisplay().workArea;
  const tabTargetX = workArea.x + workArea.width - PET_WIDTH - 36;
  if (closingTab) {
    petX += Math.sign(tabTargetX - petX) * Math.min(Math.abs(tabTargetX - petX), 720 * elapsed);
  } else {
    petX += petDirection * 48 * elapsed;
  }
  const minimumX = workArea.x;
  const maximumX = workArea.x + workArea.width - PET_WIDTH;
  if (petX <= minimumX || petX >= maximumX) {
    petDirection *= -1;
    petX = Math.max(minimumX, Math.min(maximumX, petX));
    petWindow.webContents.send("direction", petDirection);
  }
  // Keep the native transparent window fully inside the work area. The renderer
  // lifts the cat inside this taller window, so it can climb without disappearing.
  const bottomY = workArea.y + workArea.height - PET_WINDOW_HEIGHT;
  const current = petWindow.getBounds();
  // One bounded jump to the tab strip, then straight back to the desktop.
  // This avoids the frame-by-frame native movement that caused stutter.
  const y = closingTab ? workArea.y : bottomY;
  const jumpProgress = petJumpUntil > now
    ? Math.max(0, Math.min(1, (now - petJumpStartedAt) / (petJumpUntil - petJumpStartedAt)))
    : 0;
  const jumpLift = Math.round(Math.sin(jumpProgress * Math.PI) * 116);
  const lift = closingTab
    ? Math.max(84, jumpLift)
    : jumpLift || (state.settings.chaosEnabled
      ? Math.round(Math.max(0, Math.sin(now / 1100)) * 82)
      : 0);
  if (lift !== lastPetLift && (Math.abs(lift - lastPetLift) >= 6 || lift === 0)) {
    lastPetLift = lift;
    petWindow.webContents.send("pet-lift", lift);
  }
  const nextX = Math.round(petX);
  if (current.x !== nextX || current.y !== y) {
    try { petWindow.setPosition(nextX, y, false); } catch { /* Window may be closing; next tick recovers. */ }
  }
}

function runDemoSequence() {
  state.boredom = 82;
  state.petLine = "Demo mode: I am about to make a professional mistake.";
  log("Demo mode started.");
  broadcastState();
  later(() => {
    sendToExtensionAfterAnimation("pet_visit", { line: "I have entered your browser without knocking." }, "wave", 320);
    playRandomMemeAudio();
  }, 1800);
  later(() => sendToExtensionAfterAnimation("open_meme", {}, "happy", 300), 3800);
  later(() => {
    state.boredom = 10;
    state.petLine = "Excellent. Your productivity has been successfully interrupted.";
    broadcastState();
  }, 5000);
}

function openPanel(name) {
  if (!["todos", "notes", "calendar"].includes(name)) return;
  const existing = panelWindows.get(name);
  if (existing && !existing.isDestroyed()) {
    existing.focus();
    return;
  }
  const panel = new BrowserWindow({
    width: name === "calendar" ? 760 : 520,
    height: 620,
    title: `${name[0].toUpperCase()}${name.slice(1)} · WTH Is This`,
    icon: path.join(__dirname, "..", "assets", "lui-meme-icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  panel.loadFile(path.join(__dirname, "panels", `${name}.html`));
  panel.on("closed", () => panelWindows.delete(name));
  panelWindows.set(name, panel);
}

function updateSetting(key, value) {
  if (!(key in state.settings)) return;
  state.settings[key] = Boolean(value);
  if (key === "chaosEnabled" && state.settings[key]) nextChaosAt = Date.now() + 15000;
  if (key === "petEnabled" && petWindow && !petWindow.isDestroyed()) {
    state.settings[key] ? (petWindow.showInactive(), petWindow.setAlwaysOnTop(true, "screen-saver")) : petWindow.hide();
  }
  saveState();
  syncExtensionConfig();
  log(`${key} is now ${state.settings[key] ? "enabled" : "disabled"}.`);
  broadcastState();
}

function buildMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: "Lui",
      submenu: [
        { label: "AI and idle settings", click: () => {
          const settingsWindow = new BrowserWindow({ width: 560, height: 600, parent: mainWindow,
            webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false } });
          settingsWindow.loadFile(path.join(__dirname, "settings.html"));
        } },
        { label: "Pet enabled", type: "checkbox", checked: state.settings.petEnabled, click: (item) => updateSetting("petEnabled", item.checked) },
        { label: "Allow browser chaos", type: "checkbox", checked: state.settings.chaosEnabled, click: (item) => updateSetting("chaosEnabled", item.checked) },
        { label: "Allow sleep pranks", type: "checkbox", checked: state.settings.sleepPranksEnabled, click: (item) => updateSetting("sleepPranksEnabled", item.checked) },
        { label: "Use local AI when available", type: "checkbox", checked: state.settings.localAiEnabled, click: (item) => updateSetting("localAiEnabled", item.checked) },
        { label: "Let Lui walk", type: "checkbox", checked: state.settings.petWalkingEnabled, click: (item) => updateSetting("petWalkingEnabled", item.checked) },
        { type: "separator" },
        { label: "Judge me now", accelerator: "CmdOrCtrl+J", click: () => void runLuiDecision({ kind: "manual", text: "The user explicitly requested judgment." }) },
        { label: "Play local meme audio", click: playRandomMemeAudio },
        { label: "Visit current Chrome tab", click: () => sendToExtension("pet_visit", { line: state.petLine }) },
        { label: "Run 5-second demo", accelerator: "CmdOrCtrl+D", click: runDemoSequence },
        { type: "separator" },
        { label: "Stop being sentient", click: () => {
          for (const timer of pendingActions) clearTimeout(timer);
          pendingActions.clear();
          updateSetting("chaosEnabled", false);
          updateSetting("sleepPranksEnabled", false);
          sendToExtension("stop_chaos");
        } },
      ],
    },
    {
      label: "Open",
      submenu: [
        { label: "Todos", accelerator: "CmdOrCtrl+1", click: () => openPanel("todos") },
        { label: "Notes", accelerator: "CmdOrCtrl+2", click: () => openPanel("notes") },
        { label: "Calendar", accelerator: "CmdOrCtrl+3", click: () => openPanel("calendar") },
      ],
    },
    { role: "viewMenu" },
  ]);
  Menu.setApplicationMenu(menu);
}

function checkReminders() {
  const now = Date.now();
  let changed = false;
  for (const event of state.events) {
    const due = reminderState(event, now);
    if (due === "skip") continue;
    const eventTime = new Date(event.startsAt).getTime();
    if (!Number.isFinite(eventTime) || eventTime > now) continue;
    event.notifiedAt = new Date().toISOString();
    changed = true;
    if (due === "missed") continue;
    state.petLine = `It is time for ${event.title}. Even I remembered.`;
    playPetAnimation("wave");
    const verdict = event.luiVerdict === "dislike" ? "Lui disapproves, but your event has arrived." : "Lui permits this event.";
    if (Notification.isSupported()) {
      new Notification({ title: event.title, body: verdict, silent: false }).show();
    }
    log(`${verdict} ${event.title}`);
  }
  if (changed) {
    saveState();
    broadcastState();
  }
}

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

app.whenReady().then(async () => {
  if (!hasSingleInstanceLock) return;
  loadState();
  try {
    await startBridge();
  } catch (error) {
    console.error(`Lui could not start the desktop bridge: ${error.message}`);
    app.quit();
    return;
  }
  createWindow();
  createPetWindow();
  buildMenu();
  for (const [index, name] of ["todos", "notes", "calendar"].entries()) {
    globalShortcut.register(`Control+${index + 1}`, () => openPanel(name));
  }
  tickTimer = setInterval(() => {
    state.boredom = Math.min(100, state.boredom + 2);
    broadcastState();
    maybeAutomaticDecision();
    if (state.settings.chaosEnabled && Date.now() >= nextChaosAt &&
        powerMonitor.getSystemIdleState(1) !== "locked") runRandomChaos();
    const idle = powerMonitor.getSystemIdleTime();
    if (idleMemeDue({ enabled: state.settings.petEnabled && state.settings.sleepPranksEnabled,
        idleSeconds: idle, threshold: state.settings.idleMemeSeconds, lastPlayed: lastIdleMemeAt,
        now: Date.now(), locked: powerMonitor.getSystemIdleState(1) === "locked" })) {
      lastIdleMemeAt = Date.now();
      state.petLine = "You stopped working. I brought the soundtrack.";
      playPetAnimation("happy");
      playRandomMemeAudio();
    }
  }, 5000);
  reminderTimer = setInterval(checkReminders, 5000);
  void refreshAiStatus();
  aiStatusTimer = setInterval(refreshAiStatus, 30000);
  petMovementTimer = setInterval(movePet, 150);
  bridgeHeartbeatTimer = setInterval(() => {
    if (extensionSocket && extensionSocket.readyState === extensionSocket.OPEN) {
      extensionSocket.send(JSON.stringify({ type: "heartbeat", payload: { at: Date.now() } }));
    }
  }, 20000);
  powerMonitor.on("suspend", () => {
    if (!state.settings.petEnabled || !state.settings.sleepPranksEnabled) return;
    state.petLine = "Laptop bedtime? One last meme.";
    playPetAnimation("yawn");
    playRandomMemeAudio();
  });
});

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  appIsQuitting = true;
  globalShortcut.unregisterAll();
  for (const timer of pendingActions) clearTimeout(timer);
  clearInterval(tickTimer);
  clearInterval(reminderTimer);
  clearInterval(aiStatusTimer);
  clearInterval(petMovementTimer);
  clearInterval(bridgeHeartbeatTimer);
});

ipcMain.handle("get-state", () => state);
ipcMain.handle("add-todo", (_event, text) => {
  const clean = String(text || "").trim().slice(0, 160);
  if (!clean) return state;
  const todo = { id: Date.now().toString(), text: clean, status: "alive" };
  state.todos.push(todo);
  log(`Accepted a suspicious task: ${clean}`);
  saveState();
  broadcastState();
  void runLuiDecision({ kind: "todo", text: clean, todoId: todo.id });
  return state;
});
ipcMain.handle("list-data", (_event, type) => {
  if (type === "todos") return state.todos;
  if (type === "notes") return state.notes;
  if (type === "events") return state.events;
  return [];
});
ipcMain.handle("add-note", (_event, text) => {
  const clean = String(text || "").trim().slice(0, 4000);
  if (clean) {
    state.notes.unshift({ id: Date.now().toString(), text: clean, createdAt: new Date().toISOString() });
    log("Lui pretended not to read your new note.");
    saveState();
    broadcastState();
  }
  return state.notes;
});
ipcMain.handle("delete-note", (_event, id) => {
  const note = state.notes.find((item) => item.id === id);
  if (note) note.status = note.status === "void" ? "alive" : "void";
  saveState();
  broadcastState();
  return state.notes;
});
ipcMain.handle("add-event", (_event, input) => {
  const title = String(input?.title || "").trim().slice(0, 160);
  const startsAt = new Date(input?.startsAt || "");
  if (!title || Number.isNaN(startsAt.getTime())) return state.events;
  const event = {
    id: Date.now().toString(),
    title,
    startsAt: startsAt.toISOString(),
    status: "scheduled",
    luiVerdict: input?.luiVerdict === "dislike" ? "dislike" : "like",
    notifiedAt: null,
  };
  state.events.push(event);
  state.events.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  log(`Lui ${event.luiVerdict === "like" ? "approved" : "judged"} the event “${title}”.`);
  saveState();
  broadcastState();
  void runLuiDecision({ kind: "schedule", text: title, eventId: event.id });
  return state.events;
});
ipcMain.handle("void-event", (_event, id) => {
  const event = state.events.find((item) => item.id === id);
  if (event) {
    event.status = event.status === "void" ? "scheduled" : "void";
    event.notifiedAt = null;
    saveState();
    broadcastState();
  }
  return state.events;
});
ipcMain.handle("open-panel", (_event, name) => openPanel(name));
ipcMain.handle("update-setting", (_event, key, value) => {
  updateSetting(key, value);
  return state.settings;
});
ipcMain.handle("void-todo", (_event, id) => {
  const todo = state.todos.find((item) => item.id === id);
  if (todo) {
    todo.status = todo.status === "void" ? "alive" : "void";
    log(todo.status === "void" ? `Sent “${todo.text}” to the void.` : `Reluctantly restored “${todo.text}”.`);
    saveState();
    broadcastState();
  }
  return state;
});
ipcMain.handle("browser-action", (_event, action) => {
  const allowed = new Set(["close_active", "undo_close", "open_meme", "pet_visit"]);
  if (action === "close_active") closeBrowserTabWithLui();
  else if (action === "open_meme") {
    makeLuiJump(900);
    sendToExtensionAfterAnimation(action, {}, "happy", 300);
  }
  else if (action === "pet_visit") sendToExtensionAfterAnimation(action, {}, "wave", 320);
  else if (allowed.has(action)) sendToExtension(action);
  return state;
});
ipcMain.handle("ask-lui", async (_event, input) => {
  const context = {
    kind: String(input?.kind || "manual").slice(0, 30),
    text: String(input?.text || "Judge the current activity.").slice(0, 500),
    todoId: input?.todoId ? String(input.todoId).slice(0, 40) : undefined,
  };
  if (context.kind === "chat") {
    const result = await decideAsLui({ ...context, history: chatHistory.slice(-8) }, { sarvamApiKey });
    if (result.source !== "unavailable") {
      chatHistory.push({ role: "user", content: context.text }, { role: "assistant", content: result.line });
      if (chatHistory.length > 16) chatHistory.splice(0, chatHistory.length - 16);
    }
    state.petLine = result.line.slice(0, 90);
    broadcastState();
    return result;
  }
  return runLuiDecision(context);
});
ipcMain.handle("configure", (_event, input) => {
  const key = String(input?.apiKey || "").trim();
  if (key) {
    if (safeStorage.isEncryptionAvailable()) fs.writeFileSync(path.join(app.getPath("userData"), "sarvam-key.bin"), safeStorage.encryptString(key));
    else saveKey(app.getPath("userData"), key);
    sarvamApiKey = key;
  }
  state.settings.idleMemeSeconds = Math.max(30, Math.min(3600, Number(input?.idleSeconds) || 30));
  state.settings.sleepPranksEnabled = Boolean(input?.pranks);
  saveState(); broadcastState(); syncExtensionConfig();
  return true;
});
ipcMain.handle("ai-status", async () => {
  await refreshAiStatus();
  return state.ai;
});
ipcMain.handle("play-meme-audio", () => playRandomMemeAudio());
ipcMain.handle("pet-click", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
  return true;
});
