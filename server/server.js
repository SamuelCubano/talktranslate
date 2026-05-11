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
  const { body } = req;
  for (const url of ['https://libretranslate.com/translate', 'https://translate.argosopentech.com/translate']) {
    try {
      const resp = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: body.q, source: body.source, target: body.target, format: 'text' })
      });
      if (!resp.ok) throw new Error('fail');
      return res.json(await resp.json());
    } catch {}
  }
  res.json({ translatedText: body.q });
});

const rooms = {};

io.on('connection', (socket) => {
  console.log('Conectado:', socket.id);

  socket.on('join-room', ({ roomId, nickname }) => {
    socket.join(roomId);
    socket.roomData = { roomId, nickname };

    if (!rooms[roomId]) rooms[roomId] = [];
    rooms[roomId].push({ id: socket.id, nickname });

    io.to(roomId).emit('room-participants', rooms[roomId]);

    console.log(`${nickname} (${socket.id}) entró a sala ${roomId} (${rooms[roomId].length} personas)`);

    if (rooms[roomId].length === 2) {
      socket.to(roomId).emit('user-connected', socket.id);
    }
  });

  socket.on('offer', (data) => socket.to(data.target).emit('offer', { offer: data.offer, from: socket.id }));
  socket.on('answer', (data) => socket.to(data.target).emit('answer', { answer: data.answer, from: socket.id }));
  socket.on('ice-candidate', (data) => socket.to(data.target).emit('ice-candidate', { candidate: data.candidate, from: socket.id }));

  socket.on('translation', (data) => {
    socket.to(data.roomId).emit('translation', { text: data.text, lang: data.lang });
  });

  socket.on('chat-message', (data) => {
    socket.to(data.roomId).emit('chat-message', {
      nickname: socket.roomData?.nickname || 'Anon',
      original: data.original,
      translated: data.translated,
      lang: data.lang
    });
  });

  socket.on('disconnect', () => {
    if (socket.roomData) {
      const { roomId, nickname } = socket.roomData;
      if (rooms[roomId]) {
        rooms[roomId] = rooms[roomId].filter(p => p.id !== socket.id);
        if (rooms[roomId].length === 0) {
          delete rooms[roomId];
        } else {
          io.to(roomId).emit('room-participants', rooms[roomId]);
          io.to(roomId).emit('user-disconnected', socket.id);
        }
      }
    }
    console.log('Desconectado:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`TalkTranslate corriendo en puerto ${PORT}`));
