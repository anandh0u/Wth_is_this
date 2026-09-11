const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("wth", {
  getState: () => ipcRenderer.invoke("get-state"),
  addTodo: (text) => ipcRenderer.invoke("add-todo", text),
  voidTodo: (id) => ipcRenderer.invoke("void-todo", id),
  listData: (type) => ipcRenderer.invoke("list-data", type),
  addNote: (text) => ipcRenderer.invoke("add-note", text),
  deleteNote: (id) => ipcRenderer.invoke("delete-note", id),
  addEvent: (event) => ipcRenderer.invoke("add-event", event),
  voidEvent: (id) => ipcRenderer.invoke("void-event", id),
  openPanel: (name) => ipcRenderer.invoke("open-panel", name),
  updateSetting: (key, value) => ipcRenderer.invoke("update-setting", key, value),
  browserAction: (action) => ipcRenderer.invoke("browser-action", action),
  askLui: (context) => ipcRenderer.invoke("ask-lui", context),
  getAiStatus: () => ipcRenderer.invoke("ai-status"),
  playMemeAudio: () => ipcRenderer.invoke("play-meme-audio"),
  petClick: () => ipcRenderer.invoke("pet-click"),
  onState: (callback) => ipcRenderer.on("state", (_event, state) => callback(state)),
  onMemeAudio: (callback) => ipcRenderer.on("meme-audio", (_event, url) => callback(url)),
  onDirection: (callback) => ipcRenderer.on("direction", (_event, direction) => callback(direction)),
  onPetAnimation: (callback) => ipcRenderer.on("pet-animation", (_event, name) => callback(name)),
});
