let ioInstance;

module.exports = {
  init: (io) => {
    ioInstance = io;
    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);
      
      socket.on('joinGame', (gameId) => {
        socket.join(`game:${gameId}`);
        console.log(`Socket ${socket.id} joined game:${gameId}`);
      });
      
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });
  },
  getIO: () => {
    if (!ioInstance) {
      throw new Error('Socket.io not initialized!');
    }
    return ioInstance;
  }
};
