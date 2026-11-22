/* ============================================================
   Progress From Zero to Hero — script.js
   Vanilla JS (ES6+), No external dependencies
   ============================================================ */

'use strict';

// ============================================================
// NAVIGATION — View Switching
// ============================================================

/**
 * Show a named view and hide all others.
 * @param {string} viewName - 'home' | 'pomodoro' | 'todolist' | 'habit'
 */
function navigate(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById('view-' + viewName);
  if (target) {
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  // Refresh renders when entering a feature view
  if (viewName === 'todolist') renderTodos();
  if (viewName === 'habit')    renderHabits();
  if (viewName === 'pomodoro') updateSessionDisplay();
}

// ============================================================
// UTILITY — localStorage helpers
// ============================================================

function lsGet(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}

function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ============================================================
// WEB AUDIO — Notification beep (no external file needed)
// ============================================================

/**
 * Play a short beep sequence using the Web Audio API.
 * @param {'done'|'tick'} type
 */
function playSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    const beep = (freq, start, duration, vol = 0.35) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration + 0.05);
    };

    if (type === 'done') {
      // Three ascending tones — session complete
      beep(523, 0,    0.18);
      beep(659, 0.22, 0.18);
      beep(784, 0.44, 0.35);
    } else {
      // Single short tick
      beep(880, 0, 0.08, 0.15);
    }
  } catch (e) {
    // Web Audio not supported — silent fail
  }
}

// ============================================================
// POMODORO
// ============================================================

const MOTIVATIONAL_MSGS = [
  '🎉 Kerja bagus! Istirahat sebentar, kamu layak mendapatkannya.',
  '💪 Satu sesi lagi selesai. Kamu semakin dekat ke tujuanmu!',
  '🌟 Luar biasa! Konsistensi adalah kunci kesuksesan.',
  '🔥 Mantap! Setiap menit fokusmu membuahkan hasil.',
  '✨ Hebat! Otak yang beristirahat belajar lebih cepat.',
  '🚀 Kamu sedang terbang menuju versi terbaik dirimu!',
  '📚 Sesi fokus selesai! Semangat terus, Zero to Hero!',
];

let pomoTimer     = null;   // setInterval reference
let pomoSeconds   = 25 * 60;
let pomoTotal     = 25 * 60;
let pomoRunning   = false;
let pomoMode      = 'Fokus Belajar';

/** Retrieve today's session count from localStorage */
function getTodaySessions() {
  const today = new Date().toDateString();
  const data  = lsGet('pomo_sessions', { date: today, count: 0 });
  if (data.date !== today) {
    // New day — reset counter
    lsSet('pomo_sessions', { date: today, count: 0 });
    return 0;
  }
  return data.count;
}

/** Increment today's session count */
function incrementSessions() {
  const today = new Date().toDateString();
  const count = getTodaySessions() + 1;
  lsSet('pomo_sessions', { date: today, count });
  return count;
}

/** Update the session counter display */
function updateSessionDisplay() {
  document.getElementById('pomo-sessions').textContent = getTodaySessions();
}

/** Format seconds to MM:SS */
function fmtTime(secs) {
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${m}:${s}`;
}

/** Update the SVG ring progress */
function updateRing(remaining, total) {
  const circumference = 339.29; // 2π × 54
  const offset = circumference * (1 - remaining / total);
  document.getElementById('ring-progress').style.strokeDashoffset = offset;
}

/** Switch Pomodoro mode (Fokus / Istirahat Singkat / Istirahat Panjang) */
function setMode(btn, minutes, label) {
  if (pomoRunning) return; // Don't switch while running
  // Clear active state from both button groups
  document.querySelectorAll('.pomo-mode-btn, .pomo-focus-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  pomoMode    = label;
  pomoSeconds = minutes * 60;
  pomoTotal   = minutes * 60;
  document.getElementById('pomo-label').textContent   = label;
  document.getElementById('pomo-display').textContent = fmtTime(pomoSeconds);
  updateRing(pomoSeconds, pomoTotal);
  hidePomodoroMessage();
}

/** Start or resume the timer */
function pomodoroStart() {
  if (pomoRunning) return;
  pomoRunning = true;
  document.getElementById('btn-start').disabled = true;
  document.getElementById('btn-pause').disabled = false;
  hidePomodoroMessage();

  pomoTimer = setInterval(() => {
    if (pomoSeconds <= 0) {
      clearInterval(pomoTimer);
      pomoRunning = false;
      pomodoroFinish();
      return;
    }
    pomoSeconds--;
    document.getElementById('pomo-display').textContent = fmtTime(pomoSeconds);
    updateRing(pomoSeconds, pomoTotal);
    // Tick sound in the last 5 seconds (focus mode only)
    if (pomoSeconds <= 5 && pomoMode === 'Fokus Belajar') playSound('tick');
  }, 1000);
}

/** Pause the timer */
function pomodoroPause() {
  clearInterval(pomoTimer);
  pomoRunning = false;
  document.getElementById('btn-start').disabled = false;
  document.getElementById('btn-pause').disabled = true;
}

/** Reset the timer to current mode's starting value */
function pomodoroReset() {
  clearInterval(pomoTimer);
  pomoRunning = false;
  document.getElementById('btn-start').disabled = false;
  document.getElementById('btn-pause').disabled = true;
  // Re-read total from whichever button group is currently active
  const activeBtn = document.querySelector('.pomo-mode-btn.active, .pomo-focus-btn.active');
  const mins = parseInt(activeBtn?.dataset.minutes || 25);
  pomoTotal   = mins * 60;
  pomoSeconds = pomoTotal;
  document.getElementById('pomo-display').textContent = fmtTime(pomoSeconds);
  updateRing(pomoSeconds, pomoTotal);
  hidePomodoroMessage();
}

/** Called when a Pomodoro session finishes */
function pomodoroFinish() {
  document.getElementById('btn-start').disabled = false;
  document.getElementById('btn-pause').disabled = true;
  document.getElementById('pomo-display').textContent = '00:00';
  updateRing(0, pomoTotal);
  playSound('done');

  if (pomoMode === 'Fokus Belajar') {
    const count = incrementSessions();
    updateSessionDisplay();
    const msg = MOTIVATIONAL_MSGS[Math.floor(Math.random() * MOTIVATIONAL_MSGS.length)];
    showPomodoroMessage(`${msg} (Sesi ke-${count} hari ini!)`);
  } else {
    showPomodoroMessage('⏰ Istirahat selesai! Yuk kembali fokus belajar.');
  }
}

function showPomodoroMessage(text) {
  const el = document.getElementById('pomo-message');
  el.textContent = text;
  el.classList.add('show');
}
function hidePomodoroMessage() {
  document.getElementById('pomo-message').classList.remove('show');
}

// ============================================================
// TODOLIST
// ============================================================

const STUDY_TIPS = [
  '💡 Pecah tugas besar menjadi langkah kecil — selesaikan satu per satu!',
  '🎯 Mulai dari tugas yang paling mudah untuk membangun momentum.',
  '⏰ Gunakan teknik "2-menit rule": jika bisa diselesaikan dalam 2 menit, kerjakan sekarang!',
  '📝 Tulis dulu outline-nya sebelum mulai mengerjakan tugas panjang.',
  '🧠 Hindari multitasking — fokus pada satu tugas hingga selesai.',
  '🌿 Jauhkan HP saat belajar, produktivitasmu bisa naik 40%!',
  '☕ Jadwalkan break singkat setelah 25-45 menit belajar intensif.',
  '📌 Prioritaskan tugas yang paling berpengaruh pada nilai akhirmu.',
  '🔁 Review materi kemarin selama 5 menit sebelum belajar hal baru.',
  '🎉 Reward dirimu setelah menyelesaikan tugas — kamu pantas mendapatkannya!',
];

let currentTodoFilter = 'all';

/** Load todos from localStorage */
function loadTodos() { return lsGet('todos', []); }

/** Save todos to localStorage */
function saveTodos(todos) { lsSet('todos', todos); }

/** Add a new todo item */
function addTodo() {
  const name     = document.getElementById('todo-name').value.trim();
  const subject  = document.getElementById('todo-subject').value.trim();
  const priority = document.getElementById('todo-priority').value;

  if (!name) {
    document.getElementById('todo-name').focus();
    document.getElementById('todo-name').style.borderColor = '#ef4444';
    setTimeout(() => document.getElementById('todo-name').style.borderColor = '', 1200);
    return;
  }

  const todos = loadTodos();
  todos.unshift({
    id:       Date.now(),
    name,
    subject:  subject || 'Umum',
    priority,
    done:     false,
    created:  new Date().toISOString(),
  });
  saveTodos(todos);

  // Clear inputs
  document.getElementById('todo-name').value    = '';
  document.getElementById('todo-subject').value = '';
  document.getElementById('todo-priority').value = 'sedang';

  renderTodos();
}

/** Toggle done state of a todo */
function toggleTodo(id) {
  const todos = loadTodos().map(t => t.id === id ? { ...t, done: !t.done } : t);
  saveTodos(todos);
  renderTodos();
}

/** Delete a todo */
function deleteTodo(id) {
  saveTodos(loadTodos().filter(t => t.id !== id));
  renderTodos();
}

/** Filter todos by state */
function filterTodos(filter, btn) {
  currentTodoFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTodos();
}

/** Render the todo list to the DOM */
function renderTodos() {
  const all   = loadTodos();
  const list  = document.getElementById('todo-list');
  const empty = document.getElementById('todo-empty');

  const filtered = all.filter(t => {
    if (currentTodoFilter === 'active') return !t.done;
    if (currentTodoFilter === 'done')   return t.done;
    return true;
  });

  if (filtered.length === 0) {
    list.innerHTML = '';
    empty.classList.add('show');
    return;
  }
  empty.classList.remove('show');

  const priorityLabel = { tinggi: '🔴 Tinggi', sedang: '🟡 Sedang', rendah: '🟢 Rendah' };

  list.innerHTML = filtered.map(t => `
    <li class="todo-item ${t.done ? 'done' : ''}" id="todo-${t.id}">
      <div class="todo-check ${t.done ? 'checked' : ''}"
           onclick="toggleTodo(${t.id})"
           role="checkbox" aria-checked="${t.done}" tabindex="0"
           onkeydown="if(event.key==='Enter'||event.key===' ')toggleTodo(${t.id})">
        ${t.done ? '✓' : ''}
      </div>
      <div class="todo-info">
        <div class="todo-name">${escHtml(t.name)}</div>
        <div class="todo-meta">
          <span class="todo-subject">${escHtml(t.subject)}</span>
          <span class="priority-badge priority-${t.priority}">${priorityLabel[t.priority]}</span>
        </div>
      </div>
      <button class="todo-delete" onclick="deleteTodo(${t.id})" title="Hapus tugas">🗑️</button>
    </li>
  `).join('');
}

/** Show a random Smart Study Tip */
function showStudyTip() {
  const box = document.getElementById('tip-box');
  const tip = STUDY_TIPS[Math.floor(Math.random() * STUDY_TIPS.length)];
  box.textContent = tip;
  box.style.display = 'block';
  // Auto-hide after 8 seconds
  clearTimeout(box._timeout);
  box._timeout = setTimeout(() => { box.style.display = 'none'; }, 8000);
}

// ============================================================
// HABIT TRACKER
// ============================================================

/* ---- Data model ----
   habits = [ { id, name, days: { "1": null|'done'|'pending'|'skip', ... } } ]
   days key = day number "1".."30", value = status string or null
*/

/** Load habits from localStorage */
function loadHabits() { return lsGet('habits3', []); }

/** Save habits to localStorage */
function saveHabits(h) { lsSet('habits3', h); }

/** Add a new habit */
function addHabit() {
  const name = document.getElementById('habit-name').value.trim();
  if (!name) {
    document.getElementById('habit-name').focus();
    document.getElementById('habit-name').style.borderColor = '#ef4444';
    setTimeout(() => document.getElementById('habit-name').style.borderColor = '', 1200);
    return;
  }
  const habits = loadHabits();
  habits.push({ id: Date.now(), name, days: {} });
  saveHabits(habits);
  document.getElementById('habit-name').value = '';
  renderHabits();
}

/** Delete a habit */
function deleteHabit(id) {
  closeStatusPicker();
  saveHabits(loadHabits().filter(h => h.id !== id));
  renderHabits();
}

/**
 * Count consecutive 'done' days from day 1 upward (streak).
 */
function computeStreak(habit) {
  let streak = 0;
  for (let d = 1; d <= 30; d++) {
    if (habit.days[String(d)] === 'done') streak++;
    else break;
  }
  return streak;
}

/** Count days marked 'done' (for progress bar). */
function computeProgress(habit) {
  let done = 0;
  for (let d = 1; d <= 30; d++) {
    if (habit.days[String(d)] === 'done') done++;
  }
  return done;
}

/** Render all habit cards */
function renderHabits() {
  const all   = loadHabits();
  const list  = document.getElementById('habit-list');
  const empty = document.getElementById('habit-empty');

  if (all.length === 0) {
    list.innerHTML = '';
    empty.classList.add('show');
    return;
  }
  empty.classList.remove('show');
  list.innerHTML = all.map(h => renderHabitCard(h)).join('');
}

/** Build HTML for a single habit card */
function renderHabitCard(h) {
  const streak   = computeStreak(h);
  const doneDays = computeProgress(h);
  const pct      = Math.round((doneDays / 30) * 100);
  const streakTxt = streak > 0
    ? `🔥 Streak <span class="streak-count">${streak} hari</span>`
    : '✨ Mulai streak-mu!';

  const statusIcon  = { done: '✅', pending: '🟠', skip: '❌' };
  const statusClass = { done: 'hd-done', pending: 'hd-pending', skip: 'hd-skip' };

  const cells = Array.from({ length: 30 }, (_, i) => {
    const day    = i + 1;
    const status = h.days[String(day)] || null;
    const cls    = status ? statusClass[status] : '';
    const icon   = status ? statusIcon[status] : day;
    const isOpen = (_pickerHabitId === h.id && _pickerDay === day);

    // Inline dropdown rendered directly inside the cell wrapper
    const dropdown = isOpen ? `
      <div class="day-dropdown" onclick="event.stopPropagation()">
        <button onclick="setDayStatus('done')">✅ Sudah dikerjakan</button>
        <button onclick="setDayStatus('pending')">🟠 Belum dikerjakan</button>
        <button onclick="setDayStatus('skip')">❌ Tidak dikerjakan</button>
        <button onclick="setDayStatus(null)">⬜ Hapus status</button>
      </div>` : '';

    return `
      <div class="habit-day-wrap${isOpen ? ' picker-open' : ''}">
        <button class="habit-day-cell ${cls}${isOpen ? ' hd-active' : ''}"
                onclick="openStatusPicker(event, ${h.id}, ${day})"
                title="Hari ${day}">${icon}</button>
        ${dropdown}
      </div>`;
  }).join('');

  return `
    <div class="habit-card" id="hcard-${h.id}">
      <div class="habit-card-header">
        <div class="habit-card-name">🌱 ${escHtml(h.name)}</div>
        <div class="habit-card-streak">${streakTxt}</div>
        <button class="habit-card-delete" onclick="deleteHabit(${h.id})" title="Hapus kebiasaan">🗑️</button>
      </div>
      <div class="habit-days-grid">${cells}</div>
      <div class="habit-card-progress">
        <div class="habit-card-progress-label">
          <span>Progress 30 Hari</span>
          <span>${doneDays}/30 hari selesai (${pct}%)</span>
        </div>
        <div class="progress-bar-track">
          <div class="progress-bar-fill" style="width:${pct}%"></div>
        </div>
      </div>
    </div>
  `;
}

// ---- Status Picker state ----
let _pickerHabitId = null;
let _pickerDay     = null;

/**
 * Open the inline dropdown for a day cell.
 * Sets state + re-renders only the one habit card so the dropdown appears inline.
 */
function openStatusPicker(e, habitId, day) {
  e.stopPropagation();
  // If clicking the already-open cell, close it
  if (_pickerHabitId === habitId && _pickerDay === day) {
    _pickerHabitId = null;
    _pickerDay     = null;
  } else {
    _pickerHabitId = habitId;
    _pickerDay     = day;
  }
  renderHabits();
}

/** Close the inline dropdown */
function closeStatusPicker() {
  _pickerHabitId = null;
  _pickerDay     = null;
  renderHabits();
}

/**
 * Apply chosen status to the current day cell.
 * @param {string|null} status - 'done' | 'pending' | 'skip' | null
 */
function setDayStatus(status) {
  if (_pickerHabitId === null) return;
  const habits = loadHabits();
  const habit  = habits.find(h => h.id === _pickerHabitId);
  if (!habit) return;

  if (status === null) {
    delete habit.days[String(_pickerDay)];
  } else {
    habit.days[String(_pickerDay)] = status;
  }

  saveHabits(habits);
  // Close then re-render to show updated cell colour
  _pickerHabitId = null;
  _pickerDay     = null;
  renderHabits();
}

// ============================================================
// UTILITY — Escape HTML to prevent XSS
// ============================================================
function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================
// INIT — Run on page load
// ============================================================
(function init() {
  // Ensure home view is active on load
  navigate('home');

  // Set initial pomodoro ring to full
  updateRing(pomoSeconds, pomoTotal);

  // Keyboard: allow Enter key to submit todo/habit forms
  document.getElementById('todo-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') addTodo();
  });
  document.getElementById('habit-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') addHabit();
  });
  // Close inline dropdown on Escape or click outside
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && _pickerHabitId !== null) closeStatusPicker();
  });
  document.addEventListener('click', () => {
    if (_pickerHabitId !== null) closeStatusPicker();
  });
})();
