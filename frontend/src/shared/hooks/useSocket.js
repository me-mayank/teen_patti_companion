/**
 * useSocket.js — Socket.IO Client Hook
 *
 * Connects to the backend Socket.IO server and passes the JWT token
 * in the handshake auth object so the signaling server can authenticate
 * the socket and map it to the userId for WebRTC targeted signal relay.
 */
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export const useSocket = () => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Read JWT from localStorage (same place the auth context stores it)
    const token = localStorage.getItem('token') || '';

    const socketInstance = io(
      import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000',
      {
        // Pass JWT in the handshake auth object — the signaling server reads it
        // at socket.handshake.auth.token to authenticate and register the socket
        auth: { token },
        // Reconnect automatically if the connection drops
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      }
    );

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return socket;
};
