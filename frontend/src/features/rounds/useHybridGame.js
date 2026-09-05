/**
 * useHybridGame.js — Hybrid Game State Manager
 *
 * This hook is the Phase 3 bridge between the existing server-based architecture
 * and the new Hybrid WebRTC architecture.
 *
 * It provides a unified interface to GameBoard.jsx regardless of which transport
 * is currently active:
 *
 *   MODE A — WebRTC (Host):
 *     - Applies actions via the local pure game engine (zero latency)
 *     - Broadcasts new state to all peers via WebRTC DataChannel
 *     - Sends async cloud snapshots in the background
 *
 *   MODE B — WebRTC (Peer):
 *     - Sends action to host via DataChannel
 *     - Receives new state directly from host via DataChannel
 *
 *   MODE C — Server Fallback (if WebRTC fails or browser unsupported):
 *     - All actions go through the existing REST API + Socket.IO flow
 *     - Identical to the pre-hybrid behaviour — ZERO regression risk
 *
 * Usage:
 *   const {
 *     game, round,           // current game and round state (same shape as before)
 *     loading, processing,
 *     isHybridActive,        // true when WebRTC DataChannels are connected
 *     handleAction,          // BET | BET_TWICE | PACK | SHOW_REQUEST | SIDE_SHOW_REQUEST
 *     handleStartRound,
 *     handleEndGame,
 *     handleSideShowRespond,
 *     handleSideShowResult,
 *     handleShowResult,
 *   } = useHybridGame({ gameId, user, socket });
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import * as gamesApi from '../games/games.api';
import * as roundApi from './round.api';
import { settleGame } from '../games/games.api';
import useWebRTC from '../../shared/hooks/useWebRTC';
import {
  createGameState,
  startRound as engineStartRound,
  applyBet,
  applyBetTwice,
  applyPack,
  applySideShowRequest,
  applySideShowRespond,
  applySideShowResult,
  applyShowRequest,
  applyShowResult,
  applyEndGame,
  verifyZeroSum,
} from '../../engine/index.js';

// ---------------------------------------------------------------------------
// Cloud snapshot — async background POST, non-blocking
// ---------------------------------------------------------------------------
const _sendCloudSnapshot = (gameId, engineState) => {
  // Fire-and-forget: snapshot the engine state to the cloud
  // This keeps the cloud in sync for recovery purposes
  import('../games/games.api').then(({ postSnapshot }) => {
    if (postSnapshot) {
      postSnapshot(gameId, {
        stateVersion: engineState.stateVersion,
        gameState: engineState,
        actionHistory: engineState.actionHistory,
      }).catch(err => console.warn('[hybrid] snapshot failed (non-critical):', err));
    }
  });
};

// How often to take a cloud snapshot (every N state versions)
const SNAPSHOT_INTERVAL = 10;

// ---------------------------------------------------------------------------
// Normalize DB game+round into engine state format
// ---------------------------------------------------------------------------
const _buildEngineStateFromDB = (dbGame, dbRound) => {
  if (!dbGame) return null;

  const orderedPlayers = (dbGame.turnOrder || dbGame.participants.map(p => p.userId))
    .map(userRef => {
      const u = userRef?._id ? userRef : { _id: userRef };
      const participant = dbGame.participants.find(
        p => p.userId?._id?.toString() === u._id?.toString()
      );
      return {
        userId: u._id?.toString(),
        name: userRef?.name || userRef?.username || '?',
        username: userRef?.username || '',
        profilePicture: userRef?.profilePicture || null,
        startingBalance: (participant?.balance ?? 0) + (userRef?.globalBalance ?? 0),
      };
    });

  const state = createGameState({
    gameId: dbGame._id?.toString(),
    sessionId: dbGame._id?.toString(),
    bootAmount: dbGame.bootAmount,
    maxBetMultiplier: dbGame.maxBetMultiplier || 5,
    orderedPlayers,
  });

  // Sync current round number
  state.currentRoundNumber = dbGame.currentRoundNumber || 0;
  state.status = dbGame.currentRoundNumber > 0 && dbRound?.status === 'ACTIVE'
    ? 'ROUND_ACTIVE'
    : 'WAITING';

  // If there's an active round, sync round state
  if (dbRound && dbRound.status !== 'COMPLETED') {
    state.round = {
      roundNumber: dbRound.roundNumber,
      status: dbRound.status,
      potAmount: dbRound.potAmount,
      currentBet: dbRound.currentBet,
      startingBet: dbRound.startingBet,
      currentTurnIndex: dbRound.currentTurnIndex,
      players: dbRound.players.map(p => ({
        userId: p.userId?._id?.toString() || p.userId?.toString(),
        status: p.status,
        totalContribution: p.totalContribution,
        seenCards: p.seenCards || false,
      })),
      sideShowRequest: dbRound.sideShowRequest ? {
        requestedBy: dbRound.sideShowRequest.requestedBy?.toString(),
        targetPlayer: dbRound.sideShowRequest.targetPlayer?.toString(),
        result: dbRound.sideShowRequest.result,
      } : null,
      winnerId: dbRound.winnerId?.toString() || null,
      startedAt: dbRound.startedAt,
      endedAt: dbRound.endedAt,
    };

    // Sync player game balances from DB participants
    state.players = state.players.map(p => {
      const dbParticipant = dbGame.participants.find(
        gp => gp.userId?._id?.toString() === p.userId
      );
      const globalBal  = dbParticipant?.userId?.globalBalance ?? 0;
      const inGameBal  = dbParticipant?.balance ?? 0;
      return {
        ...p,
        // inGameBalance: what's shown in the UI (net result within this game)
        inGameBalance: inGameBal,
        // gameBalance: used for bankruptcy check — covers in-game losses from wallet
        gameBalance: inGameBal + globalBal,
      };
    });
  }

  return state;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
const useHybridGame = ({ gameId, user, socket }) => {
  // -- Server-side state (source of truth for UI rendering) ----------------
  const [game, setGame] = useState(null);
  const [round, setRound] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [syncing, setSyncing] = useState(false); // cloud sync in progress

  // -- Hybrid engine state (host only) -------------------------------------
  const engineState = useRef(null);      // In-memory game state for host engine
  const snapshotCounter = useRef(0);     // Counts commits since last cloud snapshot

  // -- Stable host determination -------------------------------------------
  // isHost MUST be known before WebRTC signaling starts. We derive it once
  // inside fetchGameState (when we first receive the game object) and store
  // it in a ref so it never flips mid-session and never stales in closures.
  const isHostRef = useRef(false);
  const [isHostKnown, setIsHostKnown] = useState(false); // gate for WebRTC

  // Stable derived value — components read this
  const isHost = isHostRef.current;

  // -- WebRTC ---------------------------------------------------------------
  const peerActionHandlerRef = useRef(null);

  const {
    isWebRTCReady,
    broadcastState,
    broadcastEvents,
    sendAction: sendWebRTCAction,
  } = useWebRTC({
    socket,
    gameId,
    userId: user?._id,
    isHost,            // stable ref value — correct by the time enabled flips
    enabled: isHostKnown, // only start signaling once we know host vs peer
    onStateUpdate: useCallback((incomingEngineState) => {
      // PEER: received new authoritative state from host
      // Convert back to DB-shape for the existing UI
      _applyEngineStateToUI(incomingEngineState, setGame, setRound);
    }, []),
    onEvent: useCallback((events) => {
      // Handle specific events (e.g. ROUND_WIN toast notification)
      const winEvent = events.find(e => e.type === 'ROUND_WIN');
      if (winEvent) {
        console.log('[hybrid] ROUND_WIN event received:', winEvent);
      }
    }, []),
    onAction: useCallback((msg) => {
      if (peerActionHandlerRef.current) {
        peerActionHandlerRef.current(msg);
      }
    }, []),
  });

  const isHybridActive = isWebRTCReady;

  // Keep a ref for isWebRTCReady so socket closures always read current value
  // without needing to be re-registered when it changes.
  const isWebRTCReadyRef = useRef(false);
  useEffect(() => { isWebRTCReadyRef.current = isWebRTCReady; }, [isWebRTCReady]);

  // -------------------------------------------------------------------------
  // Fetch initial game state from server
  // -------------------------------------------------------------------------
  const fetchGameState = useCallback(async () => {
    try {
      const g = await gamesApi.getGameById(gameId);
      const r = await gamesApi.getCurrentRound(gameId);
      setGame(g);
      setRound(r);

      // Determine host status ONCE — stored in a ref so it's stable
      // This must happen before WebRTC signaling (gated by isHostKnown).
      const hostCheck =
        g?.createdBy?._id?.toString() === user?._id?.toString() ||
        g?.createdBy?.toString() === user?._id?.toString();
      isHostRef.current = hostCheck;
      setIsHostKnown(true); // ← unblocks WebRTC signaling with correct role

      // HOST: Initialize the local engine state from DB data
      if (hostCheck) {
        const builtState = _buildEngineStateFromDB(g, r);
        if (builtState) {
          engineState.current = builtState;
          console.log('[hybrid] engine state initialized from DB (host)');
        }
      }
    } catch (err) {
      console.error('[hybrid] fetchGameState error:', err);
    } finally {
      setLoading(false);
    }
  }, [gameId, user]);

  useEffect(() => {
    fetchGameState();
  }, [fetchGameState]);

  // -------------------------------------------------------------------------
  // Socket.IO fallback listeners (unchanged from old architecture)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!socket) return;
    socket.emit('joinGame', gameId);

    const handleUpdate = (payload) => {
      const updatedGame  = payload?.game  || null;
      const updatedRound = payload?.round || null;

      if (updatedGame)  setGame(updatedGame);
      if (updatedRound) setRound(updatedRound);
      if (!updatedGame) { fetchGameState(); return; }

      if (isHostRef.current && updatedGame) {
        const rebuilt = _buildEngineStateFromDB(updatedGame, updatedRound);
        if (rebuilt) {
          // KEY RULE: When WebRTC is active, the local engine is the
          // source of truth for mid-round state. Only re-sync from server
          // when a NEW round starts (engine needs initialization) or when
          // WebRTC is inactive (fallback mode). Never overwrite the engine
          // with stale server state mid-round.
          const engineRoundNum  = engineState.current?.currentRoundNumber ?? -1;
          const serverRoundNum  = rebuilt.currentRoundNumber ?? 0;
          const isNewRound      = serverRoundNum !== engineRoundNum;
          const isHybridOn      = isWebRTCReadyRef.current;

          if (!isHybridOn || isNewRound || !engineState.current?.round) {
            engineState.current = rebuilt;
            console.log(`[hybrid] engine synced from server (round ${serverRoundNum}, hybrid=${isHybridOn})`);
          }

          // Always broadcast current engine state to peers when hybrid is active
          if (isHybridOn && engineState.current) {
            broadcastState(engineState.current);
          }
        }
      }
    };

    socket.on('round:update',    handleUpdate);
    socket.on('game:update',     handleUpdate);
    socket.on('round:completed', handleUpdate);

    return () => {
      socket.off('round:update',    handleUpdate);
      socket.off('game:update',     handleUpdate);
      socket.off('round:completed', handleUpdate);
    };
  }, [socket, gameId, fetchGameState, broadcastState]);


  // -------------------------------------------------------------------------
  // Core: apply engine action (HOST only)
  // Returns { newState, events } or throws on error
  // -------------------------------------------------------------------------
  const _applyEngineAction = useCallback((applyFn, actionPayload) => {
    if (!engineState.current) throw new Error('Engine not initialized');

    const actionId = uuidv4();
    const result = applyFn(engineState.current, { ...actionPayload, actionId });

    if (result.error) {
      throw new Error(result.error.message);
    }

    engineState.current = result.newState;

    // Verify zero-sum invariant after every commit
    const integrity = verifyZeroSum(result.newState);
    if (!integrity.valid) {
      console.error('[hybrid] ZERO-SUM VIOLATION DETECTED!', integrity);
    }

    // Broadcast new state to all peers
    broadcastState(result.newState);
    broadcastEvents(result.events);

    // Sync UI from engine state
    _applyEngineStateToUI(result.newState, setGame, setRound);

    // Periodic cloud snapshot
    snapshotCounter.current += 1;
    if (snapshotCounter.current >= SNAPSHOT_INTERVAL) {
      snapshotCounter.current = 0;
      _sendCloudSnapshot(gameId, result.newState);
    }

    return result;
  }, [broadcastState, broadcastEvents, gameId]);

  // -------------------------------------------------------------------------
  // Handle incoming peer actions (HOST only)
  // -------------------------------------------------------------------------
  useEffect(() => {
    peerActionHandlerRef.current = (msg) => {
      const { actionType, payload } = msg;

      const engineFnMap = {
        BET:              (s, p) => applyBet(s, p),
        BET_TWICE:        (s, p) => applyBetTwice(s, p),
        PACK:             (s, p) => applyPack(s, p),
        SHOW_REQUEST:     (s, p) => applyShowRequest(s, p),
        SIDE_SHOW_REQUEST:(s, p) => applySideShowRequest(s, p),
      };

      const fn = engineFnMap[actionType];
      if (fn) {
        try {
          _applyEngineAction(fn, payload);
        } catch (err) {
          console.error('[hybrid] host failed to apply peer action:', err);
        }
      } else {
        console.warn('[hybrid] host received unknown action type:', actionType);
      }
    };
  }, [_applyEngineAction]);

  // -------------------------------------------------------------------------
  // handleAction
  // When WebRTC is active:
  //   HOST  → local engine (zero server round-trip)
  //   PEER  → DataChannel to Host engine (LAN latency only)
  // Fallback (WebRTC not ready):
  //   ALL   → REST API + engine re-sync from response
  // -------------------------------------------------------------------------
  const handleAction = useCallback(async (action) => {
    setProcessing(true);
    try {
      if (isHybridActive && isHost) {
        // === HOST: run engine locally, broadcast to peers ===
        const engineFnMap = {
          BET:              (s, p) => applyBet(s, p),
          BET_TWICE:        (s, p) => applyBetTwice(s, p),
          PACK:             (s, p) => applyPack(s, p),
          SHOW_REQUEST:     (s, p) => applyShowRequest(s, p),
          SIDE_SHOW_REQUEST:(s, p) => applySideShowRequest(s, p),
        };
        const fn = engineFnMap[action];
        if (!fn) throw new Error(`Unknown action: ${action}`);
        _applyEngineAction(fn, { userId: user._id });

      } else if (isHybridActive && !isHost) {
        // === PEER: send to host via DataChannel — no server call ===
        sendWebRTCAction({
          actionType: action,
          payload: { userId: user._id },
        });
        // setProcessing will be cleared when state arrives back from host
        // (via onStateUpdate). Clear it here too so UI isn't permanently stuck.
        setProcessing(false);
        return;

      } else {
        // === FALLBACK: REST API (WebRTC not established yet) ===
        let updatedRound;
        switch (action) {
          case 'BET':               updatedRound = await roundApi.bet(round._id); break;
          case 'BET_TWICE':         updatedRound = await roundApi.betTwice(round._id); break;
          case 'PACK':              updatedRound = await roundApi.pack(round._id); break;
          case 'SHOW_REQUEST':      updatedRound = await roundApi.requestShow(round._id); break;
          case 'SIDE_SHOW_REQUEST': updatedRound = await roundApi.requestSideShow(round._id); break;
          default: throw new Error(`Unknown action: ${action}`);
        }
        if (updatedRound) {
          setRound(updatedRound);
          // Host: re-sync engine from server response (fallback mode)
          if (isHostRef.current && game) {
            const rebuilt = _buildEngineStateFromDB(game, updatedRound);
            if (rebuilt) engineState.current = rebuilt;
          }
        }
      }
    } catch (err) {
      console.error('[hybrid] handleAction error:', err);
      throw err;
    } finally {
      setProcessing(false);
    }
  }, [isHybridActive, isHost, _applyEngineAction, sendWebRTCAction, round, user, game]);

  // -------------------------------------------------------------------------
  // handleStartRound
  // When hybrid is active: HOST must first settle the completed round to
  // the cloud (so server knows it's done), then start the next round.
  // Shows a "Syncing to cloud..." state while the settle call is in flight.
  // -------------------------------------------------------------------------
  const handleStartRound = useCallback(async () => {
    setProcessing(true);
    try {
      // If WebRTC is active and there's a completed round in the engine,
      // settle it to the server before starting the next round.
      if (isHybridActive && isHost && engineState.current?.round) {
        const engineRound = engineState.current.round;
        const enginePlayers = engineState.current.players;

        // Only settle if the engine says the round is completed
        if (engineRound.status === 'COMPLETED' && engineRound.winnerId && round?._id) {
          setSyncing(true);
          setProcessing(false); // Let syncing state drive the loading UI
          try {
            // Build player contribution list from engine round state
            const playerContributions = engineRound.players.map(rp => ({
              userId: rp.userId,
              totalContribution: rp.totalContribution || 0,
            }));

            await roundApi.settleRound(round._id, {
              winnerId: engineRound.winnerId,
              potAmount: engineRound.potAmount,
              playerContributions,
            });
          } finally {
            setSyncing(false);
          }
          setProcessing(true);
        }
      }

      await roundApi.startRound(gameId);
    } catch (err) {
      console.error('[hybrid] handleStartRound error:', err);
      throw err;
    } finally {
      setProcessing(false);
    }
  }, [isHybridActive, isHost, round, gameId]);

  // -------------------------------------------------------------------------
  // handleEndGame
  // -------------------------------------------------------------------------
  const handleEndGame = useCallback(async () => {
    setProcessing(true);
    try {
      if (isHybridActive && isHost && engineState.current) {
        // Apply end-game to local engine state
        _applyEngineAction(applyEndGame, {});

        // Send final snapshot to cloud
        _sendCloudSnapshot(gameId, engineState.current);

        // === PHASE 4: Final Settlement ===
        // Send the authoritative final engine state to the cloud.
        // The server verifies zero-sum, reconciles DB balances, and updates wallets.
        await settleGame(gameId, engineState.current);

      } else {
        // Fallback: use existing endGame REST API
        await gamesApi.endGame(gameId);
      }
    } catch (err) {
      console.error('[hybrid] handleEndGame error:', err);
      throw err;
    } finally {
      setProcessing(false);
    }
  }, [isHybridActive, isHost, _applyEngineAction, gameId]);

  // -------------------------------------------------------------------------
  // Side show and show handlers (always server-side for result submission)
  // -------------------------------------------------------------------------
  const handleSideShowRespond = useCallback(async (accept) => {
    setProcessing(true);
    try {
      if (isHybridActive && isHost) {
        _applyEngineAction(applySideShowRespond, { userId: user._id, accept });
      } else {
        const updated = await roundApi.respondSideShow(round._id, accept);
        setRound(updated);
      }
    } catch (err) { throw err; }
    finally { setProcessing(false); }
  }, [isHybridActive, isHost, _applyEngineAction, round, user]);

  const handleSideShowResult = useCallback(async (loserUserId) => {
    setProcessing(true);
    try {
      if (isHybridActive && isHost) {
        _applyEngineAction(applySideShowResult, { userId: user._id, loserUserId });
      } else {
        const updated = await roundApi.submitSideShowResult(round._id, loserUserId);
        setRound(updated);
      }
    } catch (err) { throw err; }
    finally { setProcessing(false); }
  }, [isHybridActive, isHost, _applyEngineAction, round, user]);

  const handleShowResult = useCallback(async (winnerUserId) => {
    setProcessing(true);
    try {
      if (isHybridActive && isHost) {
        _applyEngineAction(applyShowResult, { userId: user._id, winnerUserId });
        // Always finalize show result via REST for DB persistence
        await roundApi.submitShowResult(round._id, winnerUserId);
      } else {
        const updated = await roundApi.submitShowResult(round._id, winnerUserId);
        setRound(updated);
      }
    } catch (err) { throw err; }
    finally { setProcessing(false); }
  }, [isHybridActive, isHost, _applyEngineAction, round, user]);

  return {
    game,
    round,
    loading,
    processing,
    syncing,
    isHybridActive,
    isHost,
    handleAction,
    handleStartRound,
    handleEndGame,
    handleSideShowRespond,
    handleSideShowResult,
    handleShowResult,
  };
};

// ---------------------------------------------------------------------------
// Utility: Convert engine state → DB-shaped game+round for UI
// ---------------------------------------------------------------------------
const _applyEngineStateToUI = (engineState, setGame, setRound) => {
  if (!engineState) return;

  // Build a DB-like game object from engine state
  setGame(prev => {
    if (!prev) return prev;
    return {
      ...prev,
      currentRoundNumber: engineState.currentRoundNumber,
      status: engineState.status === 'ENDED' ? 'ENDED' : prev.status,
      participants: prev.participants?.map(gp => {
        const ep = engineState.players.find(
          p => p.userId === gp.userId?._id?.toString()
        );
        // Show only in-game balance (not global wallet) to the player.
        // Global wallet is only used for bankruptcy check (gameBalance).
        return ep ? { ...gp, balance: ep.inGameBalance ?? ep.gameBalance } : gp;
      }),
    };
  });

  // Build a DB-like round object from engine state
  if (engineState.round) {
    const r = engineState.round;

    if (r.status === 'COMPLETED' || engineState.status === 'WAITING') {
      // Round just ended (pack win, show win, etc.).
      // Push the final completed round state (so winnerId shows in UI)
      // then clear it so the action panel disappears.
      setRound(prev => ({
        ...(prev || {}),
        _id: prev?._id,
        roundNumber: r.roundNumber,
        status: 'COMPLETED',
        potAmount: r.potAmount,
        currentBet: r.currentBet,
        currentTurnIndex: r.currentTurnIndex,
        players: r.players.map(rp => ({
          ...(prev?.players?.find(pp => pp.userId?._id?.toString() === rp.userId) || {}),
          status: rp.status,
          totalContribution: rp.totalContribution,
        })),
        winnerId: r.winnerId ? { _id: r.winnerId } : null,
      }));
    } else {
      setRound(prev => ({
        ...(prev || {}),
        _id: prev?._id,
        roundNumber: r.roundNumber,
        status: r.status,
        potAmount: r.potAmount,
        currentBet: r.currentBet,
        startingBet: r.startingBet,
        currentTurnIndex: r.currentTurnIndex,
        players: r.players.map(rp => ({
          ...(prev?.players?.find(pp => pp.userId?._id?.toString() === rp.userId) || {}),
          status: rp.status,
          totalContribution: rp.totalContribution,
        })),
        sideShowRequest: r.sideShowRequest,
        winnerId: r.winnerId ? { _id: r.winnerId } : null,
      }));
    }
  } else if (engineState.status === 'WAITING') {
    setRound(null);
  }
};

export default useHybridGame;
