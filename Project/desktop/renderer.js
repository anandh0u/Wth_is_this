const views = [...document.querySelectorAll(".view")];
const taskList = document.querySelector("#task-list");
const dateInput = document.querySelector('input[name="date"]');
const timeInput = document.querySelector('input[name="time"]');
const moodStatus = document.querySelector("#mood-status");
let activeList = "scheduled";
let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

function todayValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function showView(id) {
  views.forEach((view) => view.classList.toggle("active", view.id === id));
  if (id === "tasks") void renderTasks();
  if (id === "schedule") renderCalendar();
  const calendar = document.querySelector('.calendar-panel');
  document.querySelector('.lui-app').append(calendar);
  calendar.hidden = !['schedule','tasks'].includes(id);
  if (!calendar.hidden) renderCalendar();
  window.scrollTo({ top: 0, behavior: "instant" });
}

function makeTaskRow(task) {
  const button = document.createElement("button");
  button.className = "task-row";
  button.type = "button";
  button.title = task.status === "void" ? "Restore this task" : "Send this task to void";
  button.textContent = task.title;
  button.addEventListener("click", async () => {
    const dialog = document.createElement('dialog');
    dialog.className = 'task-detail';
    const title = document.createElement('h2'); title.textContent = task.title;
    const date = document.createElement('p'); date.textContent = new Date(task.startsAt).toLocaleString();
    const action = document.createElement('button'); action.textContent = task.status === 'void' ? 'Restore' : 'Send to void';
    action.onclick = async () => { await window.wth.voidEvent(task.id); dialog.close(); await renderTasks(); };
    const close = document.createElement('button'); close.textContent = 'Back'; close.onclick = () => dialog.close();
    dialog.append(title,date,action,close); document.body.append(dialog);
    dialog.addEventListener('close',()=>dialog.remove()); dialog.showModal();
  });
  return button;
}

async function renderTasks() {
  const tasks = await window.wth.listData("events");
  const visible = tasks.filter((task) => task.status === activeList);
  taskList.replaceChildren(...(visible.length
    ? visible.map(makeTaskRow)
    : [Object.assign(document.createElement("p"), { className: "empty", textContent: activeList === "void" ? "The void is quiet." : "No plans yet." })]));
}

function selectMood(button) {
  document.querySelectorAll(".mood-target").forEach((target) => target.classList.toggle("is-selected", target === button));
  moodStatus.textContent = `${button.dataset.mood}: ${button.getAttribute("aria-label")}`;
}

function renderCalendar() {
  const grid = document.querySelector("#calendar-grid");
  const heading = document.querySelector("#calendar-title");
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  heading.textContent = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(calendarMonth);
  const startDay = new Date(year, month, 1).getDay();
  const numberOfDays = new Date(year, month + 1, 0).getDate();
  const selected = dateInput.value;
  const today = todayValue();
  const cells = [];
  for (let index = 0; index < startDay; index += 1) cells.push(Object.assign(document.createElement("span"), { className: "calendar-blank" }));
  for (let day = 1; day <= numberOfDays; day += 1) {
    const value = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = day;
    button.classList.toggle("is-selected", value === selected);
    button.classList.toggle("is-today", value === today);
    button.addEventListener("click", () => { dateInput.value = value; renderCalendar(); });
    cells.push(button);
  }
  grid.replaceChildren(...cells);
  void window.wth.listData('events').then((events) => {
    for (const button of grid.querySelectorAll('button')) {
      const day = Number(button.textContent);
      const matches = events.filter(item => { const d = new Date(item.startsAt); return item.status === 'scheduled' && d.getFullYear() === year && d.getMonth() === month && d.getDate() === day; });
      if (matches.length) { button.title = matches.map(item=>item.title).join('\n'); button.style.boxShadow = 'inset 0 -5px #70414a'; }
    }
  });
}

function appendMessage(text, kind) {
  const message = document.createElement("article");
  message.className = `message ${kind}-message`;
  const copy = document.createElement("p");
  copy.textContent = text;
  message.append(copy);
  document.querySelector("#messages").append(message);
}

document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => {
  if (button.dataset.list) activeList = button.dataset.list;
  showView(button.dataset.view);
}));

document.querySelectorAll("[data-list-tab]").forEach((button) => button.addEventListener("click", () => {
  activeList = button.dataset.listTab;
  void renderTasks();
}));

document.querySelectorAll(".mood-target").forEach((button) => button.addEventListener("click", () => selectMood(button)));

document.querySelector("#calendar-previous").addEventListener("click", () => {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
  renderCalendar();
});

document.querySelector("#calendar-next").addEventListener("click", () => {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
  renderCalendar();
});

document.querySelector("#task-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const taskForm = event.currentTarget;
  await window.wth.addEvent({ title: form.get("name"), startsAt: `${form.get("date")}T${form.get("time")}`, luiVerdict: "like" });
  taskForm.reset();
  dateInput.value = todayValue();
  activeList = "scheduled";
  showView("tasks");
});

document.querySelector("#chat-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.querySelector("#chat-input");
  const text = input.value.trim();
  if (!text) return;
  const submit = document.querySelector('#chat-form button');
  if (submit.disabled) return;
  submit.disabled = true;
  appendMessage(text, "user");
  input.value = "";
  try {
    const verdict = await window.wth.askLui({ kind: "chat", text });
    appendMessage(verdict?.line || "Lui is busy. Please try again.", "lui");
  } catch { appendMessage('Chat failed. Please try again.', 'lui'); }
  finally { submit.disabled = false; }
  const messages = document.querySelector("#messages");
  messages.scrollTop = messages.scrollHeight;
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !document.querySelector("#home").classList.contains("active")) showView("home");
});

dateInput.value = todayValue();
timeInput.value = "09:00";
renderCalendar();

// Keep playback alive independently of the currently visible page.
const memeAudio = new Audio();
window.wth.onMemeAudio(async (url) => {
  memeAudio.pause();
  memeAudio.src = url;
  memeAudio.volume = 0.65;
  try { await memeAudio.play(); }
  catch { appendMessage("Meme playback failed. Check the local audio files.", "lui"); }
});
function syncLiveState(state) {
  if (document.querySelector("#tasks").classList.contains("active")) void renderTasks();
  const intensity = Math.min(1, Math.max(0, state.boredom / 100));
  const positions = {
    annoyed: [42 - intensity * 15, 42 - intensity * 16],
    happy: [58 + (1 - intensity) * 18, 42 - (1 - intensity) * 16],
    sad: [42 - intensity * 12, 58 + intensity * 18],
    scared: [58 + intensity * 13, 58 + intensity * 19],
  };
  document.querySelectorAll(".mood-target").forEach((target) => {
    const p = positions[target.dataset.mood?.toLowerCase()];
    if (!p) return;
    target.style.left = `${p[0]}%`;
    target.style.top = `${p[1]}%`;
    target.style.opacity = "1";
    target.textContent = "";
    target.style.background = `url('../public/mood-${target.dataset.mood}.svg') center / contain no-repeat`;
    target.style.color = "#feeea3";
    target.style.fontSize = "32px";
    target.title = `${target.dataset.mood}: ${Math.round(intensity * 100)}% boredom`;
  });
  moodStatus.textContent = `Lui is ${state.mood}. Boredom ${state.boredom}%.`;
}
window.wth.onState(syncLiveState);
window.wth.getState().then(syncLiveState);
