const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, '..', 'public')));

// Un solo proposito: relay de señales WebRTC entre 2 personas
io.on('connection', (socket) => {
  console.log('Conectado:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    socket.roomId = roomId;

    // Si ya hay alguien, avisarle que llegó alguien nuevo
    const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
    if (clients.length === 2) {
      socket.to(roomId).emit('user-connected', socket.id);
      // Decirle al nuevo quién es el otro
      const other = clients.find((id) => id !== socket.id);
      socket.emit('other-user', other);
    }
    console.log(`${socket.id} entró a sala ${roomId} (${clients.length} personas)`);
  });

  // Relay de señales WebRTC
  socket.on('offer', (data) => socket.to(data.target).emit('offer', { offer: data.offer, from: socket.id }));
  socket.on('answer', (data) => socket.to(data.target).emit('answer', { answer: data.answer, from: socket.id }));
  socket.on('ice-candidate', (data) => socket.to(data.target).emit('ice-candidate', { candidate: data.candidate, from: socket.id }));

  // Relay de transcripciones traducidas
  socket.on('translation', (data) => {
    socket.to(data.roomId).emit('translation', { text: data.text, lang: data.lang });
  });

  socket.on('disconnect', () => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit('user-disconnected', socket.id);
    }
    console.log('Desconectado:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`TalkTranslate corriendo en puerto ${PORT}`));
