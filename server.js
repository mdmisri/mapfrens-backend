const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:8081',
      'https://6294adb6-1642-465d-9d35-7acae29ad1df-00-2rb2oswxv5lzd.janeway.replit.dev',
      /^https:\/\/.*\.replit\.dev$/
    ],
    methods: ['GET', 'POST']
  }
});

// Store connected users and their locations in memory
const connectedUsers = new Map();

app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:", "ws:", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:8081',
    'https://6294adb6-1642-465d-9d35-7acae29ad1df-00-2rb2oswxv5lzd.janeway.replit.dev',
    /^https:\/\/.*\.replit\.dev$/
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    connectedUsers: connectedUsers.size
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'MapFrens Lite - Real-time Location Sharing',
    version: '2.0.0',
    connectedUsers: connectedUsers.size,
    endpoints: {
      health: '/health',
      socketio: '/socket.io'
    }
  });
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  socket.join(socket.id);
  const shortId = socket.id.substring(0, 8);
  connectedUsers.set(socket.id, {
    id: socket.id,
    shortId: shortId,
    name: `User ${shortId}`,
    latitude: null,
    longitude: null,
    lastUpdate: new Date()
  });

  // Send current users to the new connection
  const allUsers = Array.from(connectedUsers.values())
    .filter(user => user.latitude !== null && user.longitude !== null);
  socket.emit('users_update', allUsers);

  // Handle location updates
  socket.on('location_update', (data) => {
    const { latitude, longitude } = data;
    console.log(`[location_update] from ${socket.id}:`, data);
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      const user = connectedUsers.get(socket.id);
      if (user) {
        user.latitude = latitude;
        user.longitude = longitude;
        user.lastUpdate = new Date();
        console.log(`[location_update] updated user:`, user);
        // Broadcast updated locations to all clients
        const allUsers = Array.from(connectedUsers.values())
          .filter(user => user.latitude !== null && user.longitude !== null);
        console.log(`[users_update] broadcasting:`, allUsers);
        io.emit('users_update', allUsers);
      } else {
        console.warn(`[location_update] No user found for socket.id: ${socket.id}`);
      }
    } else {
      console.warn(`[location_update] Invalid lat/lng from ${socket.id}:`, data);
    }
  });

  // Handle wave events
  socket.on('wave', ({ from, to }) => {
    // Use a short, friendly label for the wave popup
    const friendlyNames = ['A Friend', '👾', '🚀', '🌟', '🎉', '🦄', '😎', '🤖', '🧑‍💻', '🎈'];
    const randomName = friendlyNames[Math.floor(Math.random() * friendlyNames.length)];
    io.to(to).emit('wave_notification', { from: randomName });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      console.log(`User disconnected: ${user.name}`);
      connectedUsers.delete(socket.id);
      const allUsers = Array.from(connectedUsers.values())
        .filter(user => user.latitude !== null && user.longitude !== null);
      io.emit('users_update', allUsers);
    }
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

server.listen(PORT, HOST, () => {
  console.log(`🚀 MapFrens Lite server running on ${HOST}:${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('🔌 Socket.IO enabled for real-time location sharing');
});