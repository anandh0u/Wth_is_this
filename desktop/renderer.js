const views = [...document.querySelectorAll('.view')];
let activeList = 'scheduled';
let selected = null;
const moods = { happy: ['☺', 'feeling bright', 'There is a little extra sparkle in the room today.'], annoyed: ['ಠ_ಠ', 'a bit bothered', 'Lui needs a breath and perhaps fewer notifications.'], sad: ['☹', 'feeling tender', 'A quiet day can hold a lot. Let’s take it slowly.'], scared: ['◉_◉', 'feeling unsure', 'We can make the next step very small.'] };

function showView(id) { views.forEach((view) => view.classList.toggle('active', view.id === id)); if (id === 'tasks') void renderTasks(); if (id === 'detail') renderDetail(); }
function dateLabel(iso) { return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(iso)); }
function setMood(name) { const [emoji, title, copy] = moods[name]; document.querySelector('#mood-emoji').textContent = emoji; document.querySelector('#mood-title').textContent = title; document.querySelector('#mood-copy').textContent = copy; }

async function renderTasks() {
  const events = await window.wth.listData('events');
  const matching = events.filter((event) => event.status === activeList);
  document.querySelector('#list-kicker').textContent = activeList === 'void' ? 'THINGS YOU CAN RETURN TO' : 'YOUR UPCOMING DAYS';
  document.querySelector('#list-title').innerHTML = activeList === 'void' ? 'the <i>void.</i>' : 'little <i>plans.</i>';
  document.querySelectorAll('[data-list-tab]').forEach((tab) => tab.classList.toggle('active', tab.dataset.listTab === activeList));
  const list = document.querySelector('#task-list');
  if (!matching.length) { list.innerHTML = `<p class="empty">${activeList === 'void' ? 'Nothing is waiting in the void.' : 'A wide-open day. Add a little plan.'}</p>`; return; }
  list.replaceChildren(...matching.map((event) => { const row = document.createElement('article'); row.className = 'task-row'; row.innerHTML = `<div class="task-date">${dateLabel(event.startsAt).replace(' ', '<b>')}</b></div><div><h3>${event.title}</h3><p>${new Date(event.startsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · saved for you</p></div><span class="task-arrow">→</span>`; row.addEventListener('click', () => { selected = event; showView('detail'); }); return row; }));
}
function renderDetail() { if (!selected) return; const card = document.querySelector('#detail-card'); card.innerHTML = `<span class="detail-symbol">${selected.status === 'void' ? '⌁' : '✦'}</span><h3>${selected.title}</h3><div class="detail-meta"><span>date</span><b>${dateLabel(selected.startsAt)}</b></div><div class="detail-meta"><span>time</span><b>${new Date(selected.startsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</b></div>`; const button = document.createElement('button'); button.textContent = selected.status === 'void' ? 'restore from the void' : 'send to void'; button.addEventListener('click', async () => { await window.wth.voidEvent(selected.id); activeList = selected.status === 'void' ? 'scheduled' : 'void'; showView('tasks'); }); card.append(button); }

document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => { if (button.dataset.list) activeList = button.dataset.list; showView(button.dataset.view); }));
document.querySelectorAll('[data-list-tab]').forEach((button) => button.addEventListener('click', () => { activeList = button.dataset.listTab; void renderTasks(); }));
document.querySelectorAll('[data-mood]').forEach((button) => button.addEventListener('click', () => setMood(button.dataset.mood)));
document.querySelector('#task-form').addEventListener('submit', async (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); await window.wth.addEvent({ title: data.get('name'), startsAt: `${data.get('date')}T${data.get('time')}`, luiVerdict: 'like' }); event.currentTarget.reset(); activeList = 'scheduled'; showView('tasks'); });
document.querySelector('#chat-form').addEventListener('submit', async (event) => { event.preventDefault(); const input = document.querySelector('#chat-input'); const text = input.value.trim(); if (!text) return; const messages = document.querySelector('#messages'); const user = document.createElement('article'); user.className = 'message user-message'; user.innerHTML = `<p>${text}</p>`; messages.append(user); input.value = ''; const verdict = await window.wth.askLui({ kind: 'chat', text }); const reply = document.createElement('article'); reply.className = 'message lui-message'; reply.innerHTML = `<span class="avatar">l</span><p>${verdict.line || 'I hear you. We can take it one small step at a time.'}</p>`; messages.append(reply); messages.scrollTop = messages.scrollHeight; });
window.wth.onState((state) => { document.querySelector('#connection').textContent = state.connection; document.querySelector('#connection').className = `connection ${state.connection}`; document.querySelector('#pet-line').textContent = state.petLine || 'Lui is here with you.'; document.querySelector('#mood').textContent = state.mood; });
window.wth.getState().then((state) => { document.querySelector('#connection').textContent = state.connection; document.querySelector('#mood').textContent = state.mood; });
