const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// In-memory user location storage
const users = {};
const socketToUserId = {};
const userIdToSocket = {};

io.on('connection', (socket) => {
  socket.on('location', (data) => {
    // data: { id, latitude, longitude }
    if (!data || typeof data.latitude !== 'number' || typeof data.longitude !== 'number' || !data.id) return;
    users[data.id] = { id: data.id, coords: { latitude: data.latitude, longitude: data.longitude } };
    socketToUserId[socket.id] = data.id;
    userIdToSocket[data.id] = socket.id;
    console.log('userIdToSocket after location:', userIdToSocket);
    // Only send users within 2km of this user
    const currentUser = users[data.id];
    const filtered = Object.values(users).filter((u) => {
      if (!currentUser || !u.coords) return false;
      const dist = getDistance(currentUser.coords, u.coords);
      return dist < 2000;
    });
    io.to(socket.id).emit('users', filtered);
  });

  // Handle wave events
  socket.on('wave', ({ from, to }) => {
    console.log(`Received wave from ${from} to ${to}`);
    console.log('userIdToSocket at wave:', userIdToSocket);
    if (userIdToSocket[to]) {
      const targetSocketId = userIdToSocket[to];
      console.log(`Sending wave_notification to socket ${targetSocketId} for user ${to}`);
      io.to(targetSocketId).emit('wave_notification', { from });
    } else {
      console.log(`No socket found for user ${to}`);
    }
  });

  socket.on('disconnect', () => {
    const userId = socketToUserId[socket.id];
    if (userId) {
      delete users[userId];
      delete socketToUserId[socket.id];
      delete userIdToSocket[userId];
    }
    io.emit('users', Object.values(users));
  });
});

app.get('/', (req, res) => res.send('MapFrens Lite backend running!'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

// Haversine formula for distance in meters
function getDistance(a, b) {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371e3;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const aVal =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
}