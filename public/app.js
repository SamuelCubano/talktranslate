const LANGUAGES = [
  { code: 'es', name: 'Español' }, { code: 'en', name: 'English' },
  { code: 'pt', name: 'Português' }, { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' }, { code: 'ja', name: '日本語' }
];

let socket, roomId, myNick = 'Anon';

function escapeHtml(t) {
  const d = document.createElement('div');
  d.textContent = t; return d.innerHTML;
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function langName(code) {
  return LANGUAGES.find(l => l.code === code)?.name || code;
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2500);
}

function switchView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('view-' + id).classList.add('active');
  const btn = document.querySelector(`[data-view="${id}"]`);
  if (btn) btn.classList.add('active');
}

// ===== SETTINGS =====
function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem('tt-settings')) || {};
  } catch { return {}; }
}
function saveSettings() {
  const s = {
    myLang: document.getElementById('set-my-lang').value,
    targetLang: document.getElementById('set-target-lang').value,
    theme: document.documentElement.getAttribute('data-theme'),
    nickname: document.getElementById('set-nickname').value.trim()
  };
  localStorage.setItem('tt-settings', JSON.stringify(s));
  applySettings(s);
  toast('✅ Ajustes guardados');
}
function applySettings(s) {
  if (s.myLang) {
    document.getElementById('my-lang').value = s.myLang;
    document.getElementById('chat-my-lang').value = s.myLang;
    document.getElementById('set-my-lang').value = s.myLang;
  }
  if (s.targetLang) {
    document.getElementById('target-lang').value = s.targetLang;
    document.getElementById('chat-target-lang').value = s.targetLang;
    document.getElementById('set-target-lang').value = s.targetLang;
  }
  if (s.theme) {
    document.documentElement.setAttribute('data-theme', s.theme);
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === s.theme));
  }
  if (s.nickname) {
    document.getElementById('nickname').value = s.nickname;
    document.getElementById('set-nickname').value = s.nickname;
  }
}

// ===== POPULATE SELECTS =====
function populateSelects() {
  const opts = LANGUAGES.map(l => `<option value="${l.code}">${l.name}</option>`).join('');
  for (const id of ['my-lang','target-lang','chat-my-lang','chat-target-lang','set-my-lang','set-target-lang']) {
    const sel = document.getElementById(id);
    if (sel) sel.innerHTML = opts;
  }
  document.getElementById('target-lang').value = 'en';
  document.getElementById('chat-target-lang').value = 'en';
  document.getElementById('set-target-lang').value = 'en';
}
populateSelects();
applySettings(loadSettings());

// ===== LANGUAGE SYNC =====
document.getElementById('chat-my-lang')?.addEventListener('change', () => {
  document.getElementById('my-lang').value = document.getElementById('chat-my-lang').value;
});
document.getElementById('chat-target-lang')?.addEventListener('change', () => {
  document.getElementById('target-lang').value = document.getElementById('chat-target-lang').value;
});

// ===== TRANSLATE =====
async function translate(text, source, target) {
  if (!text || source === target) return text;
  try {
    const res = await fetch('/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text.slice(0, 500), source, target, format: 'text' })
    });
    const data = await res.json();
    return data.translatedText || text;
  } catch { return text; }
}

// ===== CHAT MESSAGE =====
function addMessage(nickname, original, translated, sourceLang, targetLang, time, isOwn) {
  const container = document.getElementById('chat-msgs');
  const ph = document.getElementById('msg-placeholder');
  if (ph) ph.remove();

  const div = document.createElement('div');
  div.className = `msg ${isOwn ? 'own' : 'other'}`;
  const sn = langName(sourceLang), tn = langName(targetLang);

  div.innerHTML = `
    <div class="msg-header">
      <span class="msg-name">${escapeHtml(nickname)}</span>
      <span class="msg-lang">${sn} → ${tn}</span>
      <span class="msg-time">${fmtTime(time)}</span>
    </div>
    <div class="msg-translated">${escapeHtml(translated)}</div>
    ${original !== translated ? `<div class="msg-original">${escapeHtml(original)}</div>` : ''}
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// ===== SOCKET =====
function connectSocket(cb) {
  if (socket?.connected) { cb?.(); return; }
  socket = io();

  socket.on('connect', () => cb?.());

  socket.on('room-participants', (participants) => {
    const el = document.getElementById('participants-msg');
    if (!participants.length) { el.textContent = ''; return; }
    const names = participants.map(p => p.nickname).join(', ');
    el.textContent = `👤 ${participants.length} conectado${participants.length !== 1 ? 's' : ''}: ${names}`;
  });

  socket.on('room-full', () => {
    document.getElementById('msg-placeholder')?.remove();
    const el = document.getElementById('chat-msgs');
    const d = document.createElement('div');
    d.className = 'msg other';
    d.innerHTML = `<div class="msg-header"><span class="msg-name">⚡ Sistema</span></div>
      <div class="msg-translated" style="color:var(--text-secondary);font-size:13px">Ambos conectados — empiecen a chatear</div>`;
    el.appendChild(d);
    el.scrollTop = el.scrollHeight;
    toast('🔗 Alguien se conectó');
  });

  socket.on('user-disconnected', () => {
    const el = document.getElementById('chat-msgs');
    const d = document.createElement('div');
    d.className = 'msg other';
    d.innerHTML = `<div class="msg-header"><span class="msg-name">⚡ Sistema</span></div>
      <div class="msg-translated" style="color:var(--danger);font-size:13px">Alguien se desconectó</div>`;
    el.appendChild(d);
    el.scrollTop = el.scrollHeight;
  });

  socket.on('chat-message', ({ nickname, original, translated, sourceLang, targetLang, time }) => {
    addMessage(nickname, original, translated, sourceLang, targetLang, time, false);
  });
}

// ===== SIDEBAR TOGGLE (mobile) =====
function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('show');
  document.getElementById('hamburger').classList.toggle('open');
}
function closeSidebar() {
  document.querySelector('.sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('show');
  document.getElementById('hamburger').classList.remove('open');
}

document.getElementById('hamburger')?.addEventListener('click', toggleSidebar);
document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebar);

// ===== NAVIGATION =====
document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
  btn.addEventListener('click', () => {
    switchView(btn.dataset.view);
    closeSidebar();
  });
});

document.getElementById('theme-toggle')?.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === next));
  closeSidebar();
});

document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.documentElement.setAttribute('data-theme', btn.dataset.theme);
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === btn.dataset.theme));
  });
});

// ===== CREATE ROOM =====
function createRoom() {
  myNick = document.getElementById('nickname').value.trim() || 'Anon';
  switchView('room');

  connectSocket(() => {
    roomId = Math.random().toString(36).substring(2, 8);
    socket.emit('join-room', { roomId, nickname: myNick });
    document.getElementById('room-id-display').textContent = '#' + roomId;
    toast('📋 Sala creada: ' + roomId);
  });
}

function joinRoom() {
  const input = document.getElementById('room-input').value.trim();
  if (!input) { toast('⚠️ Escribe un ID de sala'); return; }
  myNick = document.getElementById('nickname').value.trim() || 'Anon';
  switchView('room');

  connectSocket(() => {
    roomId = input;
    socket.emit('join-room', { roomId, nickname: myNick });
    document.getElementById('room-id-display').textContent = '#' + roomId;
  });
}

function leaveRoom() {
  if (socket) { socket.disconnect(); socket = null; }
  document.getElementById('chat-msgs').innerHTML =
    `<div class="msg-placeholder" id="msg-placeholder">
      <div class="ph-icon">💬</div>
      <p>Conéctate con alguien para empezar a chatear</p>
    </div>`;
  switchView('home');
  toast('👋 Has salido de la sala');
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text || !socket?.connected) return;
  input.value = '';

  const sourceLang = document.getElementById('chat-my-lang').value;
  const targetLang = document.getElementById('chat-target-lang').value;
  const translated = await translate(text, sourceLang, targetLang);

  addMessage(myNick, text, translated, sourceLang, targetLang, Date.now(), true);
  socket.emit('chat-message', { roomId, original: text, translated, sourceLang, targetLang });
}

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    if (document.getElementById('view-room').classList.contains('active')) {
      sendChat(); return;
    }
    if (document.activeElement === document.getElementById('room-input')) { joinRoom(); return; }
    if (document.activeElement === document.getElementById('nickname')) { createRoom(); }
  }
  if (e.key === 'Escape') {
    if (document.getElementById('view-room').classList.contains('active')) leaveRoom();
    else if (document.getElementById('view-settings').classList.contains('active')) switchView('home');
  }
});

// ===== CHAT INPUT ENTER =====
document.getElementById('chat-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendChat();
});
