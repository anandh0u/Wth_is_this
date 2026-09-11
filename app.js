const views = [...document.querySelectorAll('.view')];
const tasks = [
  { id: 1, name: 'Pick up some flowers', date: '2026-09-14', time: '17:30', void: false },
  { id: 2, name: 'Read by the window', date: '2026-09-16', time: '19:00', void: false },
  { id: 3, name: 'Learn a new language', date: '2026-09-10', time: '09:00', void: true },
];
let activeList = 'schedule';
let selectedTask = null;

function showView(id) {
  views.forEach((view) => view.classList.toggle('active', view.id === id));
  if (id === 'tasks') renderTasks();
  if (id === 'detail') renderDetail();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function formatDate(date) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`));
}

function renderTasks() {
  const isVoid = activeList === 'void';
  document.querySelector('#list-kicker').textContent = isVoid ? 'THINGS YOU CAN RETURN TO' : 'YOUR UPCOMING DAYS';
  document.querySelector('#list-title').innerHTML = isVoid ? 'the <i>void.</i>' : 'little <i>plans.</i>';
  document.querySelectorAll('[data-list-tab]').forEach((tab) => tab.classList.toggle('active', tab.dataset.listTab === activeList));
  const visible = tasks.filter((task) => task.void === isVoid);
  document.querySelector('#task-list').replaceChildren(...(visible.length ? visible.map((task) => {
    const [month, day] = formatDate(task.date).split(' ');
    const row = document.createElement('article');
    row.className = 'task-row';
    row.innerHTML = `<div class="task-date">${month}<b>${day}</b></div><div><h3>${task.name}</h3><p>${task.time} · ${task.void ? 'waiting gently' : 'saved for you'}</p></div><span class="task-arrow">→</span>`;
    row.addEventListener('click', () => { selectedTask = task; showView('detail'); });
    return row;
  }) : [Object.assign(document.createElement('p'), { className: 'empty', textContent: isVoid ? 'Nothing is waiting in the void.' : 'A wide-open day. Add a little plan.' })]));
}

function renderDetail() {
  if (!selectedTask) return;
  const card = document.querySelector('#detail-card');
  card.innerHTML = `<span class="detail-symbol">${selectedTask.void ? '⌁' : '✦'}</span><h3>${selectedTask.name}</h3><div class="detail-meta"><span>date</span><b>${formatDate(selectedTask.date)}</b></div><div class="detail-meta"><span>time</span><b>${selectedTask.time}</b></div><div class="detail-meta"><span>status</span><b>${selectedTask.void ? 'in the void' : 'scheduled'}</b></div>`;
  const toggle = document.createElement('button');
  toggle.textContent = selectedTask.void ? 'restore from the void' : 'send to void';
  toggle.addEventListener('click', () => { selectedTask.void = !selectedTask.void; activeList = selectedTask.void ? 'void' : 'schedule'; showView('tasks'); });
  card.append(toggle);
}

document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => {
  if (button.dataset.list) activeList = button.dataset.list;
  showView(button.dataset.view);
}));
document.querySelectorAll('[data-list-tab]').forEach((button) => button.addEventListener('click', () => { activeList = button.dataset.listTab; renderTasks(); }));

const moods = {
  happy: ['☺', 'feeling bright', 'There is a little extra sparkle in the room today.'],
  annoyed: ['ಠ_ಠ', 'a bit bothered', 'Lui needs a breath, a snack, and perhaps fewer notifications.'],
  sad: ['☹', 'feeling tender', 'A quiet day can hold a lot. Let’s take it slowly.'],
  scared: ['◉_◉', 'feeling unsure', 'The unknown is loud right now. We can make the next step very small.'],
};
function setMood(mood) { const [emoji, title, copy] = moods[mood]; document.querySelector('#mood-emoji').textContent = emoji; document.querySelector('#mood-title').textContent = title; document.querySelector('#mood-copy').textContent = copy; }
document.querySelectorAll('[data-mood]').forEach((dot) => dot.addEventListener('click', () => setMood(dot.dataset.mood)));
document.querySelector('#random-mood').addEventListener('click', () => setMood(Object.keys(moods)[Math.floor(Math.random() * 4)]));

document.querySelector('#task-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  tasks.unshift({ id: Date.now(), name: form.get('name'), date: form.get('date'), time: form.get('time'), void: form.get('void') === 'on' });
  activeList = form.get('void') === 'on' ? 'void' : 'schedule'; event.currentTarget.reset(); showView('tasks');
});

document.querySelector('#chat-form').addEventListener('submit', (event) => {
  event.preventDefault(); const input = document.querySelector('#chat-input'); const text = input.value.trim(); if (!text) return;
  const messages = document.querySelector('#messages'); const user = document.createElement('article'); user.className = 'message user-message'; user.innerHTML = `<p>${text.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char])}</p>`; messages.append(user); input.value = ''; messages.scrollTop = messages.scrollHeight;
  setTimeout(() => { const reply = document.createElement('article'); reply.className = 'message lui-message'; reply.innerHTML = `<span class="avatar">l</span><p>${text.includes('?') ? 'I think the kindest answer is the one that gives you a little room to breathe.' : 'I hear you. You don’t have to solve it all at once — what is the smallest next thing?'}</p>`; messages.append(reply); messages.scrollTop = messages.scrollHeight; }, 380);
});
