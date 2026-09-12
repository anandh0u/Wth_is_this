const views = [...document.querySelectorAll(".view")];
const taskList = document.querySelector("#task-list");
const dateInput = document.querySelector('input[name="date"]');
const timeInput = document.querySelector('input[name="time"]');
const moodStatus = document.querySelector("#mood-status");
let activeList = "scheduled";
let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let tasks = [
  { id: "demo-1", title: "Task1", startsAt: "2026-09-13T10:00", status: "scheduled" },
  { id: "demo-2", title: "Task2", startsAt: "2026-09-14T13:00", status: "scheduled" },
  { id: "demo-3", title: "Task3", startsAt: "2026-09-15T17:00", status: "scheduled" },
];

function todayValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function showView(id) {
  views.forEach((view) => view.classList.toggle("active", view.id === id));
  if (id === "tasks") renderTasks();
  if (id === "schedule") renderCalendar();
  window.scrollTo({ top: 0, behavior: "instant" });
}

function makeTaskRow(task) {
  const button = document.createElement("button");
  button.className = "task-row";
  button.type = "button";
  button.title = task.status === "void" ? "Restore this task" : "Send this task to void";
  button.textContent = task.title;
  button.addEventListener("click", () => {
    task.status = task.status === "void" ? "scheduled" : "void";
    renderTasks();
  });
  return button;
}

function renderTasks() {
  const visible = tasks.filter((task) => task.status === activeList);
  taskList.replaceChildren(...(visible.length
    ? visible.slice(0, 3).map(makeTaskRow)
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
  renderTasks();
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

document.querySelector("#task-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  tasks.unshift({ id: String(Date.now()), title: form.get("name").trim(), startsAt: `${form.get("date")}T${form.get("time")}`, status: "scheduled" });
  event.currentTarget.reset();
  dateInput.value = todayValue();
  activeList = "scheduled";
  showView("tasks");
});

document.querySelector("#chat-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.querySelector("#chat-input");
  const text = input.value.trim();
  if (!text) return;
  appendMessage(text, "user");
  input.value = "";
  const reply = text.includes("?")
    ? "Lui says the answer is probably a snack and a worse decision."
    : "Noted. Lui will remember this at the least helpful moment.";
  appendMessage(reply, "lui");
  const messages = document.querySelector("#messages");
  messages.scrollTop = messages.scrollHeight;
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !document.querySelector("#home").classList.contains("active")) showView("home");
});

dateInput.value = todayValue();
timeInput.value = "09:00";
renderCalendar();
