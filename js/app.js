/* ============================================================
   app.js  —  My Dashboard
   Vanilla JS, no frameworks, localStorage only.
   ============================================================ */

'use strict';

/* ============================================================
   STORAGE MANAGER
   Wraps localStorage with safe get/set helpers.
   ============================================================ */
const StorageManager = (function () {
  function isAvailable() {
    try {
      const k = '__test__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch (_) { return false; }
  }

  function get(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? null : JSON.parse(raw);
    } catch (_) { return null; }
  }

  function set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) { return false; }
  }

  function remove(key) {
    try { localStorage.removeItem(key); return true; }
    catch (_) { return false; }
  }

  return { isAvailable, get, set, remove };
})();

/* ============================================================
   THEME MANAGER
   Persists and toggles light / dark theme.
   ============================================================ */
const ThemeManager = (function () {
  const KEY   = 'tdb_theme';
  const root  = document.documentElement;
  const btn   = document.getElementById('theme-toggle');

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }

  function toggle() {
    const current = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    apply(current);
    StorageManager.set(KEY, current);
  }

  function init() {
    const saved = StorageManager.get(KEY);
    apply(saved === 'dark' ? 'dark' : 'light');
    btn.addEventListener('click', toggle);
  }

  return { init };
})();

/* ============================================================
   GREETING WIDGET
   Clock, date, time-of-day salutation, editable name.
   ============================================================ */
const GreetingWidget = (function () {
  const KEY_NAME = 'tdb_userName';

  const elSalutation = document.getElementById('greeting-salutation');
  const elName       = document.getElementById('greeting-name');
  const elTime       = document.getElementById('greeting-time');
  const elDate       = document.getElementById('greeting-date');
  const elForm       = document.getElementById('name-form');
  const elInput      = document.getElementById('name-input');
  const elError      = document.getElementById('name-error');

  /* Pure helpers */
  function getSalutation(hour) {
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    if (hour < 21) return 'Good evening';
    return 'Good night';
  }

  function formatDate(date) {
    return date.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function tick() {
    const now = new Date();
    const h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
    elTime.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;
    elDate.textContent = formatDate(now);
    elSalutation.textContent = getSalutation(h);
  }

  function renderName() {
    const saved = StorageManager.get(KEY_NAME);
    elName.textContent = (typeof saved === 'string' && saved.trim()) ? saved.trim() : 'Friend';
  }

  function setName(raw) {
    const trimmed = (raw || '').trim();
    if (!trimmed) {
      elError.textContent = 'Name cannot be empty.';
      return false;
    }
    if (trimmed.length > 40) {
      elError.textContent = 'Name must be 40 characters or fewer.';
      return false;
    }
    elError.textContent = '';
    StorageManager.set(KEY_NAME, trimmed);
    renderName();
    return true;
  }

  function init() {
    renderName();
    tick();
    setInterval(tick, 1000);

    elForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (setName(elInput.value)) elInput.value = '';
    });
  }

  return { init };
})();

/* ============================================================
   TIMER WIDGET
   Pomodoro-style countdown with AudioContext beep.
   ============================================================ */
const TimerWidget = (function () {
  const KEY_DUR = 'tdb_pomodoroDuration';
  const DEFAULT_MIN = 25;

  const elDisplay  = document.getElementById('timer-display');
  const elMessage  = document.getElementById('timer-message');
  const elBtnStart = document.getElementById('timer-start');
  const elBtnStop  = document.getElementById('timer-stop');
  const elBtnReset = document.getElementById('timer-reset');
  const elDurForm  = document.getElementById('timer-duration-form');
  const elDurInput = document.getElementById('duration-input');
  const elDurError = document.getElementById('duration-error');

  let _interval        = null;
  let pomodoroDuration = DEFAULT_MIN * 60;   // seconds
  let remaining        = pomodoroDuration;

  /* ---- Pure helper ---- */
  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  /* ---- Render ---- */
  function render() {
    elDisplay.textContent = formatTime(remaining);
  }

  /* ---- Beep ---- */
  function playBeep() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx  = new Ctx();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.6, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
      osc.onended = function () { ctx.close(); };
    } catch (_) { /* AudioContext unavailable — silent fail */ }
  }

  /* ---- Core timer actions ---- */
  function tick() {
    if (remaining > 0) {
      remaining -= 1;
      render();
    }
    if (remaining === 0) {
      onComplete();
    }
  }

  function onComplete() {
    clearInterval(_interval);
    _interval = null;
    playBeep();
    elMessage.classList.remove('hidden');
  }

  function start() {
    if (_interval) return;          // already running
    if (remaining === 0) return;    // already finished
    elMessage.classList.add('hidden');
    _interval = setInterval(tick, 1000);
  }

  function stop() {
    clearInterval(_interval);
    _interval = null;
  }

  function reset() {
    stop();
    remaining = pomodoroDuration;
    elMessage.classList.add('hidden');
    render();
  }

  /* ---- Set duration ---- */
  function setDuration(raw) {
    const val = String(raw).trim();
    if (!val) {
      elDurError.textContent = 'Please enter a whole-number value between 1 and 120.';
      return false;
    }
    const parsed = Number(val);
    if (!Number.isInteger(parsed) || isNaN(parsed)) {
      elDurError.textContent = 'Please enter a whole-number value between 1 and 120.';
      return false;
    }
    if (parsed < 1 || parsed > 120) {
      elDurError.textContent = 'Duration must be between 1 and 120 minutes.';
      return false;
    }
    const ok = StorageManager.set(KEY_DUR, parsed);
    if (!ok) {
      elDurError.textContent = 'Could not save — storage may be full.';
      return false;
    }
    elDurError.textContent = '';
    pomodoroDuration = parsed * 60;
    if (!_interval) {
      reset();   // apply immediately when not running
    }
    return true;
  }

  /* ---- Init ---- */
  function init() {
    const saved = StorageManager.get(KEY_DUR);
    if (Number.isInteger(saved) && saved >= 1 && saved <= 120) {
      pomodoroDuration = saved * 60;
    }
    remaining = pomodoroDuration;
    render();

    elBtnStart.addEventListener('click', start);
    elBtnStop.addEventListener('click', stop);
    elBtnReset.addEventListener('click', reset);

    elDurForm.addEventListener('submit', function (e) {
      e.preventDefault();
      setDuration(elDurInput.value);
    });
  }

  return { init };
})();

/* ============================================================
   TODO WIDGET
   Add / edit / complete / delete tasks, persisted to storage.
   ============================================================ */
const TodoWidget = (function () {
  const KEY = 'tdb_tasks';

  const elForm    = document.getElementById('task-form');
  const elInput   = document.getElementById('task-input');
  const elError   = document.getElementById('task-error');
  const elList    = document.getElementById('task-list');

  let _tasks = [];

  /* ---- Storage ---- */
  function load() {
    const data = StorageManager.get(KEY);
    _tasks = Array.isArray(data) ? data : [];
  }

  function save() {
    return StorageManager.set(KEY, _tasks);
  }

  /* ---- Render all tasks ---- */
  function renderAll() {
    elList.innerHTML = '';
    _tasks.forEach(function (task) { elList.appendChild(renderTask(task)); });
  }

  /* ---- Build one task element ---- */
  function renderTask(task) {
    const li = document.createElement('li');
    li.className = 'task-item';
    li.dataset.id = task.id;

    // Checkbox
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'task-checkbox';
    cb.checked = task.done;
    cb.setAttribute('aria-label', 'Mark done');
    cb.addEventListener('change', function () { toggleComplete(task.id); });

    // Label
    const label = document.createElement('span');
    label.className = 'task-label' + (task.done ? ' task-label--done' : '');
    label.textContent = task.title;
    label.addEventListener('dblclick', function () { startEdit(task.id); });

    // Actions
    const actions = document.createElement('div');
    actions.className = 'task-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn--small btn--outline';
    editBtn.textContent = '✏️';
    editBtn.setAttribute('aria-label', 'Edit task');
    editBtn.addEventListener('click', function () { startEdit(task.id); });

    const delBtn = document.createElement('button');
    delBtn.className = 'btn--danger';
    delBtn.textContent = '🗑';
    delBtn.setAttribute('aria-label', 'Delete task');
    delBtn.addEventListener('click', function () { deleteTask(task.id); });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    li.appendChild(cb);
    li.appendChild(label);
    li.appendChild(actions);
    return li;
  }

  /* ---- Add task ---- */
  function addTask(title) {
    const trimmed = (title || '').trim();
    if (!trimmed) {
      elError.textContent = 'Task cannot be empty.';
      return false;
    }
    elError.textContent = '';
    const task = { id: Date.now().toString(36) + Math.random().toString(36).slice(2), title: trimmed, done: false };
    _tasks.push(task);
    if (!save()) {
      _tasks.pop();
      elError.textContent = 'Could not save — storage may be full.';
      return false;
    }
    renderAll();
    return true;
  }

  /* ---- Toggle complete ---- */
  function toggleComplete(id) {
    const task = _tasks.find(function (t) { return t.id === id; });
    if (!task) return;
    const prev = task.done;
    task.done = !prev;
    if (!save()) {
      task.done = prev;
      elError.textContent = 'Could not save.';
    }
    renderAll();
  }

  /* ---- Delete task ---- */
  function deleteTask(id) {
    const idx = _tasks.findIndex(function (t) { return t.id === id; });
    if (idx === -1) return;
    const removed = _tasks.splice(idx, 1)[0];
    if (!save()) {
      _tasks.splice(idx, 0, removed);
      elError.textContent = 'Could not save.';
    }
    renderAll();
  }

  /* ---- Inline edit ---- */
  function startEdit(id) {
    const task = _tasks.find(function (t) { return t.id === id; });
    if (!task) return;

    const li = elList.querySelector('[data-id="' + id + '"]');
    if (!li) return;

    // Replace label with input
    const label = li.querySelector('.task-label');
    const actions = li.querySelector('.task-actions');

    const editInput = document.createElement('input');
    editInput.type = 'text';
    editInput.className = 'task-edit-input';
    editInput.value = task.title;
    editInput.maxLength = 200;

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn btn--small';
    confirmBtn.textContent = '✔';
    confirmBtn.setAttribute('aria-label', 'Confirm edit');

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn--small btn--outline';
    cancelBtn.textContent = '✖';
    cancelBtn.setAttribute('aria-label', 'Cancel edit');

    label.replaceWith(editInput);
    actions.innerHTML = '';
    actions.appendChild(confirmBtn);
    actions.appendChild(cancelBtn);
    editInput.focus();
    editInput.select();

    function confirm() {
      const newTitle = editInput.value.trim();
      if (!newTitle) { editInput.focus(); return; }
      confirmEdit(id, newTitle);
    }

    confirmBtn.addEventListener('click', confirm);
    cancelBtn.addEventListener('click', function () { cancelEdit(id); });
    editInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter')  { e.preventDefault(); confirm(); }
      if (e.key === 'Escape') { cancelEdit(id); }
    });
  }

  function confirmEdit(id, newTitle) {
    const task = _tasks.find(function (t) { return t.id === id; });
    if (!task) return;
    const oldTitle = task.title;
    task.title = newTitle;
    if (!save()) {
      task.title = oldTitle;
      elError.textContent = 'Could not save.';
    }
    renderAll();
  }

  function cancelEdit(id) {
    renderAll();   // just re-render to discard unsaved edit UI
  }

  /* ---- Init ---- */
  function init() {
    load();
    renderAll();

    elForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (addTask(elInput.value)) elInput.value = '';
    });
  }

  return { init };
})();

/* ============================================================
   QUICK LINKS WIDGET
   Add / delete bookmarks, persisted to storage.
   ============================================================ */
const QuickLinksWidget = (function () {
  const KEY = 'tdb_links';

  const elForm      = document.getElementById('link-form');
  const elNameInput = document.getElementById('link-name-input');
  const elUrlInput  = document.getElementById('link-url-input');
  const elError     = document.getElementById('link-error');
  const elList      = document.getElementById('link-list');

  let _links = [];

  /* ---- Storage ---- */
  function load() {
    const data = StorageManager.get(KEY);
    _links = Array.isArray(data) ? data : [];
  }

  function save() {
    return StorageManager.set(KEY, _links);
  }

  /* ---- Validate ---- */
  function validate(name, url) {
    if (!name.trim()) return 'Label cannot be empty.';
    if (name.trim().length > 40) return 'Label must be 40 characters or fewer.';
    if (!url.trim()) return 'URL cannot be empty.';
    try {
      const u = new URL(url.trim());
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return 'URL must start with http:// or https://.';
    } catch (_) {
      return 'Please enter a valid URL (e.g. https://example.com).';
    }
    return null;   // valid
  }

  /* ---- Render ---- */
  function renderAll() {
    elList.innerHTML = '';
    _links.forEach(function (link) { elList.appendChild(renderLink(link)); });
  }

  function renderLink(link) {
    const chip = document.createElement('span');
    chip.className = 'link-chip';

    const a = document.createElement('a');
    a.href = link.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = link.name;
    a.title = link.url;

    const del = document.createElement('button');
    del.className = 'link-chip-delete';
    del.textContent = '×';
    del.setAttribute('aria-label', 'Delete ' + link.name);
    del.addEventListener('click', function () { deleteLink(link.name, link.url); });

    chip.appendChild(a);
    chip.appendChild(del);
    return chip;
  }

  /* ---- Add link ---- */
  function addLink(name, url) {
    const err = validate(name, url);
    if (err) { elError.textContent = err; return false; }
    elError.textContent = '';

    const link = { name: name.trim(), url: url.trim() };
    _links.push(link);
    if (!save()) {
      _links.pop();
      elError.textContent = 'Could not save — storage may be full.';
      return false;
    }
    renderAll();
    return true;
  }

  /* ---- Delete link ---- */
  function deleteLink(name, url) {
    const idx = _links.findIndex(function (l) { return l.name === name && l.url === url; });
    if (idx === -1) return;
    const removed = _links.splice(idx, 1)[0];
    if (!save()) {
      _links.splice(idx, 0, removed);
      elError.textContent = 'Could not save.';
    }
    renderAll();
  }

  /* ---- Init ---- */
  function init() {
    load();
    renderAll();

    elForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (addLink(elNameInput.value, elUrlInput.value)) {
        elNameInput.value = '';
        elUrlInput.value  = '';
      }
    });
  }

  return { init };
})();

/* ============================================================
   APP INIT
   ============================================================ */
(function () {
  // Warn if localStorage unavailable
  if (!StorageManager.isAvailable()) {
    const banner = document.createElement('div');
    banner.style.cssText = 'background:#ef4444;color:#fff;text-align:center;padding:0.5rem;font-size:0.85rem;';
    banner.textContent = '⚠️ Local Storage is not available. Your data will not be saved between sessions.';
    document.body.prepend(banner);
  }

  ThemeManager.init();
  GreetingWidget.init();
  TimerWidget.init();
  TodoWidget.init();
  QuickLinksWidget.init();
})();
