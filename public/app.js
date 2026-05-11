const LANGUAGES = [
  { code: 'es', name: 'Español' }, { code: 'en', name: 'English' },
  { code: 'pt', name: 'Português' }, { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' }, { code: 'ja', name: '日本語' }
];

let socket, roomId, myNick = 'Anon';

function escapeHtml(t) {
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}

function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function langName(code) {
  return LANGUAGES.find(l => l.code === code)?.name || code;
}

function populateSelects() {
  for (const id of ['my-lang', 'target-lang', 'chat-my-lang', 'chat-target-lang']) {
    const sel = document.getElementById(id);
    if (!sel) continue;
    sel.innerHTML = LANGUAGES.map(l => `<option value="${l.code}">${l.name}</option>`).join('');
  }
  document.getElementById('target-lang').value = 'en';
  document.getElementById('chat-target-lang').value = 'en';
}
populateSelects();

function syncLangSelects() {
  const from = document.getElementById('my-lang');
  const to = document.getElementById('target-lang');
  const cfrom = document.getElementById('chat-my-lang');
  const cto = document.getElementById('chat-target-lang');
  if (from && cfrom) cfrom.value = from.value;
  if (to && cto) cto.value = to.value;
}

document.getElementById('chat-my-lang')?.addEventListener('change', () => {
  document.getElementById('my-lang').value = document.getElementById('chat-my-lang').value;
});
document.getElementById('chat-target-lang')?.addEventListener('change', () => {
  document.getElementById('target-lang').value = document.getElementById('chat-target-lang').value;
});

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
  } catch {
    return text;
  }
}

function addMessage(nickname, original, translated, sourceLang, targetLang, time, isOwn) {
  const container = document.getElementById('chat-msgs');
  const ph = document.getElementById('msg-placeholder');
  if (ph) ph.remove();

  const div = document.createElement('div');
  div.className = `msg ${isOwn ? 'own' : 'other'}`;

  const sn = langName(sourceLang);
  const tn = langName(targetLang);

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

// SOCKET
function connectSocket(cb) {
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
    d.innerHTML = `<div class="msg-header"><span class="msg-name">Sistema</span></div>
      <div class="msg-translated" style="color:#888;font-size:13px">Ambos conectados — empiecen a chatear</div>`;
    el.appendChild(d);
    el.scrollTop = el.scrollHeight;
  });

  socket.on('user-disconnected', () => {
    const el = document.getElementById('chat-msgs');
    const d = document.createElement('div');
    d.className = 'msg other';
    d.innerHTML = `<div class="msg-header"><span class="msg-name">Sistema</span></div>
      <div class="msg-translated" style="color:#ff6b6b;font-size:13px">Alguien se desconectó</div>`;
    el.appendChild(d);
    el.scrollTop = el.scrollHeight;
  });

  socket.on('chat-message', ({ nickname, original, translated, sourceLang, targetLang, time }) => {
    addMessage(nickname, original, translated, sourceLang, targetLang, time, false);
  });
}

// UI
function createRoom() {
  myNick = document.getElementById('nickname').value.trim() || 'Anon';

  document.getElementById('lobby').classList.add('hidden');
  document.getElementById('room').classList.remove('hidden');
  syncLangSelects();

  connectSocket(() => {
    roomId = Math.random().toString(36).substring(2, 8);
    socket.emit('join-room', { roomId, nickname: myNick });
    document.getElementById('room-id-display').textContent = '#' + roomId;
  });
}

function joinRoom() {
  const input = document.getElementById('room-input').value.trim();
  if (!input) return;
  myNick = document.getElementById('nickname').value.trim() || 'Anon';

  document.getElementById('lobby').classList.add('hidden');
  document.getElementById('room').classList.remove('hidden');
  syncLangSelects();

  connectSocket(() => {
    roomId = input;
    socket.emit('join-room', { roomId, nickname: myNick });
    document.getElementById('room-id-display').textContent = '#' + roomId;
  });
}

function leaveRoom() {
  if (socket) { socket.disconnect(); socket = null; }
  document.getElementById('room').classList.add('hidden');
  document.getElementById('lobby').classList.remove('hidden');
  document.getElementById('chat-msgs').innerHTML = `<div class="msg-placeholder" id="msg-placeholder">
    <p>Conéctate con alguien para empezar a chatear</p></div>`;
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';

  const sourceLang = document.getElementById('chat-my-lang').value;
  const targetLang = document.getElementById('chat-target-lang').value;

  const translated = await translate(text, sourceLang, targetLang);

  addMessage(myNick, text, translated, sourceLang, targetLang, Date.now(), true);

  if (socket?.connected) {
    socket.emit('chat-message', {
      roomId, original: text, translated, sourceLang, targetLang
    });
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !document.getElementById('lobby').classList.contains('hidden')) {
    const roomInput = document.getElementById('room-input');
    if (document.activeElement === roomInput) { joinRoom(); return; }
    const nick = document.getElementById('nickname');
    if (document.activeElement === nick) { createRoom(); return; }
  }
});
