/**
 * backend/src/shared/sockets/index.js
 *
 * Dual-purpose Socket.IO server:
 *
 * 1. GAME EVENTS (existing, unchanged — backward compatible fallback)
 *    - game:update / round:update   → real-time state broadcast
 *    - round:completed              → round ended notification
 *
 * 2. WEBRTC SIGNALING (new — Phase 1 of Hybrid architecture)
 *    - webrtc:offer      → relay SDP offer from Host to a specific Peer
 *    - webrtc:answer     → relay SDP answer from Peer back to Host
 *    - webrtc:ice        → relay ICE candidates between any two peers
 *    - webrtc:host-ready → Host announces it is ready; Peers begin connecting
 *    - webrtc:peer-joined→ Peer announces presence; Host initiates offer
 *
 * Security:
 *   Sockets authenticate by passing JWT in handshake auth ({ auth: { token } })
 *   or as a query param (?token=...).
 *   Unauthenticated sockets can receive broadcast events but cannot send signals.
 */

const jwt = require('jsonwebtoken');

let ioInstance;

// ---------------------------------------------------------------------------
// userId ↔ socketId registry
// ---------------------------------------------------------------------------
const userSockets = new Map();  // userId → Set<socketId>
const socketUsers = new Map();  // socketId → userId

const _registerSocket = (userId, socketId) => {
  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId).add(socketId);
  socketUsers.set(socketId, userId);
};

const _unregisterSocket = (socketId) => {
  const userId = socketUsers.get(socketId);
  if (userId) {
    const sockets = userSockets.get(userId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) userSockets.delete(userId);
    }
    socketUsers.delete(socketId);
  }
};

/**
 * Relay a signal event to the first active socket of a target user.
 * Returns true if delivered, false if the target is offline.
 */
const _relayToUser = (targetUserId, event, payload) => {
  const sockets = userSockets.get(String(targetUserId));
  if (!sockets || sockets.size === 0) return false;
  const [firstSocketId] = sockets;
  ioInstance.to(firstSocketId).emit(event, payload);
  return true;
};

// ---------------------------------------------------------------------------
// JWT authentication helper for sockets
// ---------------------------------------------------------------------------
const _authenticate = (socket) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token;
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    return decoded.id ? String(decoded.id) : null;
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------
module.exports = {
  init: (io) => {
    ioInstance = io;

    io.on('connection', (socket) => {
      // Attempt JWT auth on every connection
      const userId = _authenticate(socket);
      if (userId) {
        _registerSocket(userId, socket.id);
        socket.emit('socket:authenticated', { userId });
      }

      console.log(`[socket] connected: ${socket.id}${userId ? ` (user: ${userId})` : ' (guest)'}`);

      // ----------------------------------------------------------------
      // Existing game room subscription — UNCHANGED, backward compatible
      // ----------------------------------------------------------------
      socket.on('joinGame', (gameId) => {
        socket.join(`game:${gameId}`);
        console.log(`[socket] ${socket.id} joined game:${gameId}`);
      });

      // ----------------------------------------------------------------
      // WebRTC Signaling
      // All payloads carry gameId for future participant validation.
      // ----------------------------------------------------------------

      /**
       * HOST → specific PEER
       * Host sends its SDP offer after creating RTCPeerConnection.
       * Payload: { gameId, targetUserId, sdp }
       */
      socket.on('webrtc:offer', ({ gameId, targetUserId, sdp }) => {
        if (!userId) return;
        const delivered = _relayToUser(targetUserId, 'webrtc:offer', {
          gameId,
          fromUserId: userId,
          sdp,
        });
        if (!delivered) socket.emit('webrtc:peer-offline', { targetUserId });
        console.log(`[webrtc] offer: ${userId} → ${targetUserId} (game: ${gameId})`);
      });

      /**
       * PEER → HOST
       * Peer sends SDP answer in response to an offer.
       * Payload: { gameId, targetUserId (the host), sdp }
       */
      socket.on('webrtc:answer', ({ gameId, targetUserId, sdp }) => {
        if (!userId) return;
        _relayToUser(targetUserId, 'webrtc:answer', {
          gameId,
          fromUserId: userId,
          sdp,
        });
        console.log(`[webrtc] answer: ${userId} → ${targetUserId} (game: ${gameId})`);
      });

      /**
       * EITHER SIDE → other side
       * Trickle ICE candidate relay.
       * Payload: { gameId, targetUserId, candidate }
       */
      socket.on('webrtc:ice', ({ gameId, targetUserId, candidate }) => {
        if (!userId) return;
        _relayToUser(targetUserId, 'webrtc:ice', {
          gameId,
          fromUserId: userId,
          candidate,
        });
      });

      /**
       * HOST → all peers in the game room
       * Host is initialized and ready for incoming WebRTC connections.
       * Peers should respond with webrtc:peer-joined.
       * Payload: { gameId }
       */
      socket.on('webrtc:host-ready', ({ gameId }) => {
        if (!userId) return;
        socket.to(`game:${gameId}`).emit('webrtc:host-ready', {
          gameId,
          hostUserId: userId,
        });
        console.log(`[webrtc] host-ready: ${userId} is hosting game ${gameId}`);
      });

      /**
       * PEER → game room
       * Peer announces it has joined and is ready to connect.
       * Host should react by sending a webrtc:offer to this peer.
       * Payload: { gameId }
       */
      socket.on('webrtc:peer-joined', ({ gameId }) => {
        if (!userId) return;
        socket.to(`game:${gameId}`).emit('webrtc:peer-joined', {
          gameId,
          peerUserId: userId,
        });
        console.log(`[webrtc] peer-joined: ${userId} in game ${gameId}`);
      });

      // ----------------------------------------------------------------
      // Disconnect cleanup
      // ----------------------------------------------------------------
      socket.on('disconnect', () => {
        _unregisterSocket(socket.id);
        console.log(`[socket] disconnected: ${socket.id}${userId ? ` (user: ${userId})` : ''}`);
      });
    });
  },

  getIO: () => {
    if (!ioInstance) throw new Error('Socket.IO not initialized!');
    return ioInstance;
  },

  // Exposed utilities for use by other modules
  relayToUser: _relayToUser,
  getUserSockets: (uid) => userSockets.get(String(uid)) ?? new Set(),
};
