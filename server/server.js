const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.json());

app.post('/translate', async (req, res) => {
  const { q, source, target } = req.body;
  if (!q || !source || !target) return res.json({ translatedText: q });

  try {
    const resp = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(q.slice(0, 500))}&langpair=${source}|${target}`);
    if (resp.ok) {
      const data = await resp.json();
      if (data?.responseData?.translatedText) {
        return res.json({ translatedText: data.responseData.translatedText });
      }
    }
    console.log('MyMemory error:', resp.status);
  } catch (e) {
    console.log('MyMemory exception:', e.message);
  }

  res.json({ translatedText: q });
});

const rooms = {};

io.on('connection', (socket) => {
  console.log('Conectado:', socket.id);

  function leaveCurrentRoom() {
    if (!socket.roomData) return;
    const { roomId, nickname } = socket.roomData;
    socket.leave(roomId);
    if (rooms[roomId]) {
      rooms[roomId] = rooms[roomId].filter(p => p.id !== socket.id);
      if (rooms[roomId].length === 0) {
        delete rooms[roomId];
      } else {
        io.to(roomId).emit('room-participants', rooms[roomId]);
        io.to(roomId).emit('user-left', { nickname });
      }
    }
    socket.roomData = null;
  }

  socket.on('join-room', ({ roomId, nickname }) => {
    leaveCurrentRoom();
    socket.join(roomId);
    socket.roomData = { roomId, nickname };

    if (!rooms[roomId]) rooms[roomId] = [];
    rooms[roomId].push({ id: socket.id, nickname });

    io.to(roomId).emit('room-participants', rooms[roomId]);
    socket.to(roomId).emit('user-joined', { nickname });

    console.log(`${nickname} (${socket.id}) entró a sala ${roomId} (${rooms[roomId].length} personas)`);

    if (roomId !== 'general' && rooms[roomId].length === 2) {
      io.to(roomId).emit('room-full');
    }
  });

  socket.on('leave-room', () => {
    leaveCurrentRoom();
  });

  socket.on('chat-message', (data) => {
    const roomId = data.roomId || socket.roomData?.roomId;
    if (!roomId) return;
    socket.to(roomId).emit('chat-message', {
      nickname: socket.roomData?.nickname || 'Anon',
      original: data.original,
      translated: data.translated,
      targetLang: data.targetLang,
      sourceLang: data.sourceLang,
      time: Date.now()
    });
  });

  socket.on('disconnect', () => {
    leaveCurrentRoom();
    console.log('Desconectado:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`TalkTranslate corriendo en puerto ${PORT}`));
