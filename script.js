const $ = (id) => document.getElementById(id);
const form = $('todo-form');
const input = $('todo-input');
const dateInput = $('date-input');
const timeInput = $('time-input');
const listEl = $('todo-list');
const grid = $('cal-grid');

const pad = (n) => String(n).padStart(2, '0');
const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtTime = (t) => {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
};

const ICON_CAL = '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>';

// Загружаем задачи; старые записи-строки превращаем в объекты
let todos = (JSON.parse(localStorage.getItem('todos')) || []).map((t, i) =>
  typeof t === 'string'
    ? { id: Date.now() + i, text: t, done: false, date: toKey(new Date()), time: '' }
    : t
);
let view = 'today';
const now = new Date();
let viewY = now.getFullYear();
let viewM = now.getMonth();

function saveTodos() {
  localStorage.setItem('todos', JSON.stringify(todos));
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function closeMenus() {
  document.querySelectorAll('.menu-pop').forEach((p) => (p.hidden = true));
}
document.addEventListener('click', closeMenus);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenus(); });

function dateLabel(t) {
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  let d = t.date === toKey(today) ? 'Today' : t.date === toKey(tomorrow) ? 'Tomorrow' : fmtDate(parseKey(t.date));
  return t.time ? `${d} · ${fmtTime(t.time)}` : d;
}

function taskEl(t, late) {
  const li = el('li', 'task' + (t.done ? ' done' : '') + (late ? ' late' : ''));

  const cb = el('input');
  cb.type = 'checkbox';
  cb.checked = t.done;
  cb.setAttribute('aria-label', 'Completed: ' + t.text);
  cb.onchange = () => { t.done = cb.checked; saveTodos(); render(); };

  const body = el('div', 'task-body');
  const meta = el('div', 'task-meta');
  meta.innerHTML = ICON_CAL;
  meta.append(dateLabel(t));
  body.append(el('div', 'task-title', t.text), meta);

  const menu = el('div', 'menu');
  const btn = el('button', 'menu-btn', '···');
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Task actions');
  const pop = el('div', 'menu-pop');
  pop.hidden = true;
  const del = el('button', '', 'Delete');
  del.type = 'button';
  del.onclick = () => { todos = todos.filter((x) => x.id !== t.id); saveTodos(); render(); };
  pop.append(del);
  btn.onclick = (e) => {
    e.stopPropagation();
    const wasHidden = pop.hidden;
    closeMenus();
    pop.hidden = !wasHidden;
  };
  menu.append(btn, pop);

  li.append(cb, body, menu);
  return li;
}

function addSection(title, sub, items, emptyText, late) {
  const head = el('div', 'group-head');
  head.append(el('h3', '', title));
  if (sub) head.append(el('span', '', sub));
  listEl.append(head);
  if (!items.length) {
    listEl.append(el('p', 'group-empty', emptyText));
    return;
  }
  const ul = el('ul', 'tasks');
  items.forEach((t) => ul.append(taskEl(t, late)));
  listEl.append(ul);
}

function render() {
  const todayKey = toKey(new Date());
  const sorted = [...todos].sort((a, b) =>
    (a.date + (a.time || '99:99')).localeCompare(b.date + (b.time || '99:99'))
  );
  const past = sorted.filter((t) => t.date < todayKey);
  const current = sorted.filter((t) => t.date === todayKey);
  const future = sorted.filter((t) => t.date > todayKey);

  listEl.innerHTML = '';
  const pastShown = view === 'all' ? past : past.filter((t) => !t.done);
  if (pastShown.length) addSection(view === 'all' ? 'Earlier' : 'Overdue', null, pastShown, '', true);
  addSection('Today', fmtDate(new Date()), current, 'No tasks for today.');
  if (future.length) addSection('Upcoming', null, future);

  const left = current.filter((t) => !t.done).length;
  $('sub').textContent = left ? `${left} left today` : 'Make today productive';
  renderCalendar();
}

function renderCalendar() {
  const first = new Date(viewY, viewM, 1);
  $('cal-title').textContent = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const start = first.getDay(); // неделя начинается с воскресенья, как на макете
  const total = Math.ceil((start + new Date(viewY, viewM + 1, 0).getDate()) / 7) * 7;
  const busy = new Set(todos.filter((t) => !t.done).map((t) => t.date));
  const todayKey = toKey(new Date());

  grid.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const d = new Date(viewY, viewM, 1 - start + i);
    const key = toKey(d);
    const b = el('button', 'day', String(d.getDate()));
    b.type = 'button';
    if (d.getMonth() !== viewM) b.classList.add('other');
    if (key === todayKey) b.classList.add('today');
    if (key === dateInput.value) b.classList.add('sel');
    if (busy.has(key)) b.classList.add('has');
    b.setAttribute('aria-label', fmtDate(d));
    b.onclick = () => { dateInput.value = key; renderCalendar(); input.focus(); };
    grid.append(b);
  }
}

function shiftMonth(delta) {
  const d = new Date(viewY, viewM + delta, 1);
  viewY = d.getFullYear();
  viewM = d.getMonth();
  renderCalendar();
}
$('prev').onclick = () => shiftMonth(-1);
$('next').onclick = () => shiftMonth(1);

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) { input.focus(); return; }
  todos.push({
    id: Date.now(),
    text,
    done: false,
    date: dateInput.value || toKey(new Date()),
    time: timeInput.value,
  });
  input.value = '';
  timeInput.value = '';
  saveTodos();
  render();
  input.focus();
});
dateInput.addEventListener('change', renderCalendar);

// Навигация
document.querySelectorAll('.nav[data-view]').forEach((b) => {
  b.onclick = () => {
    view = b.dataset.view;
    document.querySelectorAll('.nav[data-view]').forEach((n) => n.classList.toggle('active', n === b));
    render();
  };
});
$('nav-cal').onclick = () => $('calendar').scrollIntoView({ behavior: 'smooth', block: 'start' });
$('nav-settings').onclick = () => {
  if (todos.some((t) => t.done) && confirm('Delete all completed tasks?')) {
    todos = todos.filter((t) => !t.done);
    saveTodos();
    render();
  }
};

// Приветствие по времени суток
const h = new Date().getHours();
$('greeting').textContent = h < 5 ? 'Good night!' : h < 12 ? 'Good morning!' : h < 18 ? 'Good afternoon!' : 'Good evening!';

dateInput.value = toKey(new Date());
render();
