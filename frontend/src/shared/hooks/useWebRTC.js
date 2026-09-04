/**
 * useWebRTC.js — WebRTC Peer Connection Manager
 *
 * Manages the entire WebRTC lifecycle for one player in a Teen Patti game.
 * Uses the existing Socket.IO connection (from useSocket) for signaling.
 *
 * Exposes two modes:
 *   - HOST: creates offers for each joining peer, runs the authoritative game engine
 *   - PEER: responds to offers from the host, sends actions over DataChannel
 *
 * DataChannel message format (JSON):
 *   From PEER → HOST:  { type: 'ACTION', actionId, actionType, payload }
 *   From HOST → PEER:  { type: 'STATE', stateVersion, gameState }
 *   From HOST → PEER:  { type: 'EVENT', events: [...] }
 *   From HOST → PEER:  { type: 'ERROR', code, message }
 *
 * Fallback behaviour:
 *   If WebRTC fails to establish within CONNECT_TIMEOUT_MS,
 *   the hook sets isWebRTCReady=false and the component can fall back
 *   to the existing Socket.IO game:update / round:update flow.
 *
 * Usage:
 *   const { isHost, isWebRTCReady, sendAction, connectedPeers } = useWebRTC({
 *     socket,        // Socket.IO socket from useSocket()
 *     gameId,
 *     userId,
 *     isHost,        // boolean — is this user the game creator / host?
 *     onStateUpdate, // (gameState) => void — called whenever host broadcasts new state
 *     onEvent,       // (events[]) => void — called for important game events (win, etc.)
 *   });
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const CONNECT_TIMEOUT_MS = 8000;   // Give up on WebRTC after 8 seconds

/**
 * Public STUN servers — helps establish connections through most NATs.
 * For production, add a TURN server as fallback for symmetric NATs.
 */
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // Add a TURN server here when you have one:
  // { urls: 'turn:your.turn.server:3478', username: '...', credential: '...' }
];

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
const useWebRTC = ({
  socket,
  gameId,
  userId,
  isHost: isHostProp,
  onStateUpdate,
  onEvent,
  onAction,
}) => {
  // Map of peerUserId → RTCPeerConnection
  const peerConnections = useRef(new Map());
  // Map of peerUserId → RTCDataChannel
  const dataChannels = useRef(new Map());

  const [connectedPeers, setConnectedPeers] = useState([]);
  const [isWebRTCReady, setIsWebRTCReady] = useState(false);

  const fallbackTimer = useRef(null);

  // Use a ref for callbacks so DataChannel handlers never need to re-bind
  const callbacksRef = useRef({ onStateUpdate, onEvent, onAction });
  useEffect(() => {
    callbacksRef.current = { onStateUpdate, onEvent, onAction };
  }, [onStateUpdate, onEvent, onAction]);

  // ---------------------------------------------------------------------------
  // DataChannel message handler (called by host AND peer sides)
  // ---------------------------------------------------------------------------
  const _handleDataChannelMessage = useCallback((rawData, fromUserId) => {
    try {
      const msg = JSON.parse(rawData);
      const { onStateUpdate, onEvent, onAction } = callbacksRef.current;

      if (msg.type === 'STATE' && onStateUpdate) {
        onStateUpdate(msg.gameState);
      } else if (msg.type === 'EVENT' && onEvent) {
        onEvent(msg.events);
      } else if (msg.type === 'ACTION') {
        if (isHostProp && onAction) {
          onAction(msg, fromUserId);
        } else {
          console.warn('[webrtc] received ACTION on peer — ignoring', msg);
        }
      }
    } catch (e) {
      console.error('[webrtc] failed to parse DataChannel message', e);
    }
  }, [isHostProp]);

  // ---------------------------------------------------------------------------
  // Create RTCPeerConnection for a given peer
  // ---------------------------------------------------------------------------
  const _createPeerConnection = useCallback((peerUserId) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc:ice', {
          gameId,
          targetUserId: peerUserId,
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[webrtc] ${userId}↔${peerUserId} state: ${pc.connectionState}`);
      if (pc.connectionState === 'connected') {
        clearTimeout(fallbackTimer.current);
        setIsWebRTCReady(true);
        setConnectedPeers(prev =>
          prev.includes(peerUserId) ? prev : [...prev, peerUserId]
        );
      } else if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        setConnectedPeers(prev => prev.filter(id => id !== peerUserId));
      }
    };

    return pc;
  }, [socket, gameId, userId]);

  // ---------------------------------------------------------------------------
  // HOST: Create offer for a specific peer
  // ---------------------------------------------------------------------------
  const _createOffer = useCallback(async (peerUserId) => {
    const pc = _createPeerConnection(peerUserId);
    peerConnections.current.set(peerUserId, pc);

    // Host creates the DataChannel
    const dc = pc.createDataChannel('game', { ordered: true });
    dataChannels.current.set(peerUserId, dc);

    dc.onopen = () => {
      console.log(`[webrtc] DataChannel open: host ↔ ${peerUserId}`);
    };
    dc.onmessage = (e) => _handleDataChannelMessage(e.data, peerUserId);
    dc.onerror = (e) => console.error(`[webrtc] DC error (${peerUserId}):`, e);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit('webrtc:offer', {
      gameId,
      targetUserId: peerUserId,
      sdp: pc.localDescription,
    });

    console.log(`[webrtc] offer sent: host → ${peerUserId}`);
  }, [_createPeerConnection, _handleDataChannelMessage, socket, gameId]);

  // ---------------------------------------------------------------------------
  // PEER: Handle incoming offer, send answer
  // ---------------------------------------------------------------------------
  const _handleOffer = useCallback(async ({ fromUserId, sdp }) => {
    const pc = _createPeerConnection(fromUserId);
    peerConnections.current.set(fromUserId, pc);

    // Peer receives the DataChannel created by the host
    pc.ondatachannel = (event) => {
      const dc = event.channel;
      dataChannels.current.set(fromUserId, dc);
      dc.onopen = () => {
        console.log(`[webrtc] DataChannel open: peer ↔ host`);
        clearTimeout(fallbackTimer.current);
        setIsWebRTCReady(true);
      };
      dc.onmessage = (e) => _handleDataChannelMessage(e.data, fromUserId);
      dc.onerror = (e) => console.error('[webrtc] DC error (peer):', e);
    };

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit('webrtc:answer', {
      gameId,
      targetUserId: fromUserId,
      sdp: pc.localDescription,
    });

    console.log(`[webrtc] answer sent: peer → ${fromUserId}`);
  }, [_createPeerConnection, _handleDataChannelMessage, socket, gameId]);

  // ---------------------------------------------------------------------------
  // HOST: Handle answer from a peer
  // ---------------------------------------------------------------------------
  const _handleAnswer = useCallback(async ({ fromUserId, sdp }) => {
    const pc = peerConnections.current.get(fromUserId);
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    console.log(`[webrtc] answer received from ${fromUserId}`);
  }, []);

  // ---------------------------------------------------------------------------
  // EITHER SIDE: Handle incoming ICE candidate
  // ---------------------------------------------------------------------------
  const _handleIce = useCallback(async ({ fromUserId, candidate }) => {
    const pc = peerConnections.current.get(fromUserId);
    if (!pc || !candidate) return;
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.warn('[webrtc] failed to add ICE candidate', e);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Socket.IO signaling event subscriptions
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!socket || !gameId || !userId) return;

    // Register for the game room (existing functionality)
    socket.emit('joinGame', gameId);

    if (isHostProp) {
      // HOST: announce readiness, wait for peers to join
      socket.emit('webrtc:host-ready', { gameId });

      socket.on('webrtc:peer-joined', ({ peerUserId }) => {
        if (peerUserId !== userId) {
          console.log(`[webrtc] peer joined: ${peerUserId} — creating offer`);
          _createOffer(peerUserId);
        }
      });

      socket.on('webrtc:answer', _handleAnswer);

    } else {
      // PEER: announce presence when host is ready (or immediately if already ready)
      const _announcePeer = () => {
        socket.emit('webrtc:peer-joined', { gameId });
      };

      socket.on('webrtc:host-ready', ({ hostUserId }) => {
        if (hostUserId !== userId) _announcePeer();
      });

      // Also announce immediately in case host is already ready
      _announcePeer();

      socket.on('webrtc:offer', (payload) => {
        if (payload.fromUserId !== userId) _handleOffer(payload);
      });
    }

    // ICE is symmetric — both sides listen
    socket.on('webrtc:ice', _handleIce);

    // Fallback timer — if WebRTC doesn't connect in time, signal caller
    fallbackTimer.current = setTimeout(() => {
      console.warn('[webrtc] connection timeout — falling back to Socket.IO');
      setIsWebRTCReady(false);
    }, CONNECT_TIMEOUT_MS);

    return () => {
      socket.off('webrtc:peer-joined');
      socket.off('webrtc:host-ready');
      socket.off('webrtc:offer');
      socket.off('webrtc:answer');
      socket.off('webrtc:ice');
      clearTimeout(fallbackTimer.current);
    };
  }, [socket, gameId, userId, isHostProp, _createOffer, _handleOffer, _handleAnswer, _handleIce]);

  // ---------------------------------------------------------------------------
  // Cleanup all peer connections on unmount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      peerConnections.current.forEach(pc => pc.close());
      peerConnections.current.clear();
      dataChannels.current.clear();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * HOST only: Broadcast the current game state to all connected peers.
   * Called by the host after applying any game action.
   *
   * @param {Object} gameState - The new complete game state
   */
  const broadcastState = useCallback((gameState) => {
    const msg = JSON.stringify({ type: 'STATE', stateVersion: gameState.stateVersion, gameState });
    dataChannels.current.forEach((dc, peerId) => {
      if (dc.readyState === 'open') {
        dc.send(msg);
      } else {
        console.warn(`[webrtc] DC to ${peerId} not open (state: ${dc.readyState})`);
      }
    });
  }, []);

  /**
   * HOST only: Broadcast events (e.g. ROUND_WIN) to all peers.
   *
   * @param {Array} events - Array of event objects
   */
  const broadcastEvents = useCallback((events) => {
    const msg = JSON.stringify({ type: 'EVENT', events });
    dataChannels.current.forEach((dc) => {
      if (dc.readyState === 'open') dc.send(msg);
    });
  }, []);

  /**
   * PEER only: Send an action to the host via DataChannel.
   * The host validates and applies the action, then broadcasts the new state.
   *
   * @param {Object} action - { actionId, actionType, payload }
   */
  const sendAction = useCallback((action) => {
    // Peers send to the first (and only) DataChannel they have (to host)
    const [dc] = dataChannels.current.values();
    if (dc && dc.readyState === 'open') {
      dc.send(JSON.stringify({ type: 'ACTION', ...action }));
    } else {
      console.warn('[webrtc] cannot sendAction — no open DataChannel');
    }
  }, []);

  return {
    isWebRTCReady,
    connectedPeers,
    broadcastState,    // HOST: push state to all peers
    broadcastEvents,   // HOST: push events to all peers
    sendAction,        // PEER: send action to host
  };
};

export default useWebRTC;
