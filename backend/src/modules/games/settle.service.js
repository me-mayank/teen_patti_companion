/**
 * settle.service.js — Hybrid Architecture: Final Game Settlement
 *
 * Phase 4 of the Hybrid architecture.
 *
 * When a game played in Hybrid mode ends, the Host engine holds the authoritative
 * final state. This service receives that final state from the Host, verifies it,
 * and reconciles the cloud database before triggering wallet settlement.
 *
 * Flow:
 *   1. Host calls POST /api/games/:id/settle with { finalEngineState }
 *   2. This service validates the zero-sum invariant
 *   3. Reconciles DB participant.balance to match engine final balances
 *   4. Calls the existing endGame flow to finalize and settle wallets
 *
 * Zero-sum rule:
 *   Σ(engine player.gameBalance) must equal Σ(engine player.totalDeposited)
 *   Any violation is a critical error — settlement is blocked.
 */

const mongoose = require('mongoose');
const Game = require('../games/game.model');
const Transaction = require('../ledger/transaction.model');
const User = require('../users/user.model');

/**
 * Verifies the zero-sum invariant on the engine's final state.
 * The pot must be zero (fully distributed) when the game ends.
 *
 * @param {Object} engineState - Final engine state from the Host
 * @returns {{ valid: Boolean, sum: Number, expected: Number, diff: Number }}
 */
const _verifyFinalZeroSum = (engineState) => {
  const expected = engineState.players.reduce((acc, p) => acc + p.totalDeposited, 0);
  const actual   = engineState.players.reduce((acc, p) => acc + p.gameBalance, 0);
  const pot      = engineState.round?.potAmount ?? 0;   // should be 0 at game end
  const total    = actual + pot;

  return {
    valid: Math.abs(total - expected) < 0.01,
    sum: total,
    expected,
    pot,
    diff: total - expected,
  };
};

/**
 * settleGame — Main settlement function
 *
 * Reconciles DB state to match the Host engine's final authoritative state,
 * then triggers global wallet updates for all participants.
 *
 * @param {String} gameId
 * @param {String} requestingUserId - Must be the game creator (host)
 * @param {Object} finalEngineState - Final engine state from useHybridGame
 * @returns {Object} Settled game document
 */
const settleGame = async (gameId, requestingUserId, finalEngineState) => {
  const game = await Game.findById(gameId);
  if (!game) throw new Error('Game not found');

  if (game.createdBy.toString() !== requestingUserId.toString()) {
    throw new Error('Only the game creator (host) can settle the game');
  }

  if (game.status === 'ENDED') {
    // Already settled — idempotent, just return
    return game;
  }

  if (game.status !== 'ACTIVE') {
    throw new Error('Game must be ACTIVE to settle');
  }

  // -------------------------------------------------------------------------
  // Step 1: Verify zero-sum integrity
  // -------------------------------------------------------------------------
  const integrity = _verifyFinalZeroSum(finalEngineState);
  if (!integrity.valid) {
    throw Object.assign(
      new Error(
        `Zero-sum violation: engine total=${integrity.sum} expected=${integrity.expected} diff=${integrity.diff}. Settlement blocked.`
      ),
      { statusCode: 422 }
    );
  }

  // -------------------------------------------------------------------------
  // Step 2: Reconcile DB participant balances from engine state
  //
  // The engine state is the source of truth for the final P&L.
  // We calculate the net delta for each player:
  //   delta = engine.gameBalance - engine.totalDeposited
  //   (positive = won money, negative = lost money)
  // Then we update the DB participant.balance to match.
  // -------------------------------------------------------------------------
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Reconcile each participant's in-game balance to the engine's authoritative value
    for (const enginePlayer of finalEngineState.players) {
      const netDelta = enginePlayer.gameBalance - enginePlayer.totalDeposited;

      // Update game participant.balance to the engine's net P&L
      await Game.updateOne(
        { _id: gameId, 'participants.userId': enginePlayer.userId },
        { $set: { 'participants.$.balance': netDelta } },
        { session }
      );

      // Record a SETTLEMENT transaction for the delta (audit trail)
      if (Math.abs(netDelta) > 0.001) {
        await Transaction.create([{
          userId: enginePlayer.userId,
          gameId,
          roundId: null,
          type: 'SETTLEMENT',
          amount: netDelta,
        }], { session });
      }
    }

    // -------------------------------------------------------------------------
    // Step 3: Mark game ENDED and update global wallet balances
    // -------------------------------------------------------------------------
    game.status = 'ENDED';
    game.endedAt = new Date();
    await game.save({ session });

    // Apply net P&L from game into each player's persistent global wallet
    for (const enginePlayer of finalEngineState.players) {
      const netDelta = enginePlayer.gameBalance - enginePlayer.totalDeposited;
      if (Math.abs(netDelta) > 0.001) {
        await User.findByIdAndUpdate(
          enginePlayer.userId,
          { $inc: { globalBalance: netDelta } },
          { session }
        );
      }
    }

    await session.commitTransaction();

  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }

  // -------------------------------------------------------------------------
  // Step 4: Emit final update to all clients in the game room
  // -------------------------------------------------------------------------
  const { _emitUpdate } = require('./game.service');
  if (_emitUpdate) _emitUpdate(gameId);

  console.log(`[settle] game ${gameId} settled successfully. Zero-sum verified: ${integrity.sum}`);

  return game;
};

/**
 * getSettlementPreview — Read-only preview of what settlement would look like.
 * Useful for the "End Game" confirmation dialog.
 *
 * @param {String} gameId
 * @returns {Object} { players: [{ name, username, netDelta, finalBalance }], isZeroSum }
 */
const getSettlementPreview = async (gameId) => {
  const game = await Game.findById(gameId)
    .populate('participants.userId', 'name username globalBalance');

  if (!game) throw new Error('Game not found');

  const players = game.participants.map(p => ({
    userId: p.userId._id,
    name: p.userId.name,
    username: p.userId.username,
    gamePnl: p.balance,                             // in-game net P&L
    currentGlobalBalance: p.userId.globalBalance,
    projectedGlobalBalance: p.userId.globalBalance + p.balance,
  }));

  const totalSum = players.reduce((acc, p) => acc + p.gamePnl, 0);

  return {
    gameId,
    players,
    isZeroSum: Math.abs(totalSum) < 0.01,
    totalSum,
  };
};

module.exports = { settleGame, getSettlementPreview };
