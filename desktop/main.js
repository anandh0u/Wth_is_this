const { app, BrowserWindow, ipcMain, Menu, Notification } = require("electron");
const path = require("path");
const fs = require("fs");
const { WebSocketServer } = require("ws");

const PORT = 17381;
let mainWindow;
let extensionSocket;
let stateFile;
let tickTimer;
let reminderTimer;
const panelWindows = new Map();

let state = {
  mood: "neutral",
  boredom: 0,
  connection: "waiting",
  currentTab: null,
  todos: [],
  notes: [],
  events: [],
  settings: {
    petEnabled: true,
    chaosEnabled: false,
    sleepPranksEnabled: false,
  },
  eventLog: ["The creature has awakened."],
};

function loadState() {
  stateFile = path.join(app.getPath("userData"), "wth-state.json");
  try {
    const saved = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    state.todos = Array.isArray(saved.todos) ? saved.todos : [];
    state.notes = Array.isArray(saved.notes) ? saved.notes : [];
    state.events = Array.isArray(saved.events) ? saved.events : [];
    state.settings = { ...state.settings, ...(saved.settings || {}) };
  } catch {
    // First run or invalid state: start clean.
  }
}

function saveState() {
  fs.writeFileSync(stateFile, JSON.stringify({
    todos: state.todos,
    notes: state.notes,
    events: state.events,
    settings: state.settings,
  }, null, 2));
}

function log(message) {
  state.eventLog.unshift(message);
  state.eventLog = state.eventLog.slice(0, 12);
}

function updateMood() {
  state.mood = state.boredom >= 75 ? "chaotic" : state.boredom >= 40 ? "annoyed" : "neutral";
}

function broadcastState() {
  updateMood();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("state", state);
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

function startBridge() {
  const server = new WebSocketServer({ host: "127.0.0.1", port: PORT });
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
      if (extensionSocket === socket) extensionSocket = null;
      state.connection = "waiting";
      log("Browser extension disconnected.");
      broadcastState();
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 430,
    height: 680,
    minWidth: 360,
    minHeight: 520,
    alwaysOnTop: true,
    icon: path.join(__dirname, "..", "assets", "lui-meme-icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, "index.html"));
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
        { label: "Pet enabled", type: "checkbox", checked: state.settings.petEnabled, click: (item) => updateSetting("petEnabled", item.checked) },
        { label: "Allow browser chaos", type: "checkbox", checked: state.settings.chaosEnabled, click: (item) => updateSetting("chaosEnabled", item.checked) },
        { label: "Allow sleep pranks", type: "checkbox", checked: state.settings.sleepPranksEnabled, click: (item) => updateSetting("sleepPranksEnabled", item.checked) },
        { type: "separator" },
        { label: "Stop being sentient", click: () => {
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
    if (event.status !== "scheduled" || event.notifiedAt) continue;
    const eventTime = new Date(event.startsAt).getTime();
    if (!Number.isFinite(eventTime) || eventTime > now) continue;
    event.notifiedAt = new Date().toISOString();
    changed = true;
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

app.whenReady().then(() => {
  loadState();
  startBridge();
  createWindow();
  buildMenu();
  tickTimer = setInterval(() => {
    state.boredom = Math.min(100, state.boredom + 2);
    broadcastState();
  }, 5000);
  reminderTimer = setInterval(checkReminders, 5000);
});

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  clearInterval(tickTimer);
  clearInterval(reminderTimer);
});

ipcMain.handle("get-state", () => state);
ipcMain.handle("add-todo", (_event, text) => {
  const clean = String(text || "").trim().slice(0, 160);
  if (!clean) return state;
  state.todos.push({ id: Date.now().toString(), text: clean, status: "alive" });
  log(`Accepted a suspicious task: ${clean}`);
  saveState();
  broadcastState();
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
  state.notes = state.notes.filter((item) => item.id !== id);
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
  const allowed = new Set(["close_active", "undo_close", "open_meme"]);
  if (allowed.has(action)) sendToExtension(action);
  return state;
});
