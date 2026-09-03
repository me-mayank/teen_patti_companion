require('dotenv').config();
const http = require('http');
const app = require('./app');
const { Server } = require('socket.io');
const connectDB = require('./src/shared/config/db');

// Connect to database
connectDB();

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"]
  }
});

const { init } = require('./src/shared/sockets');
init(io);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
