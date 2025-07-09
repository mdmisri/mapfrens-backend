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

io.on('connection', (socket) => {
  socket.on('location', (coords) => {
    users[socket.id] = { id: socket.id, coords };
    // Only send users within 2km of this user
    const filtered = Object.values(users).filter((u) => {
      if (!coords || !u.coords) return false;
      const dist = getDistance(coords, u.coords);
      return dist < 2000;
    });
    io.emit('users', filtered);
  });

  socket.on('disconnect', () => {
    delete users[socket.id];
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