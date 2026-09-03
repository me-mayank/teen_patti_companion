const mongoose = require('mongoose');
const Round = require('./round.model');
const Game = require('../games/game.model');
const { recordTransaction } = require('../ledger/ledger.service');
const turnManager = require('./turnManager.service');
const { getIO } = require('../../shared/sockets');

const _emitUpdate = (gameId) => {
  getIO().to(`game:${gameId}`).emit('game:update', { gameId });
  getIO().to(`game:${gameId}`).emit('round:update', { gameId });
};

const startRound = async (gameId, userId) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const game = await Game.findById(gameId).session(session);
    if (!game) throw new Error('Game not found');

    if (game.status !== 'ACTIVE') {
      throw new Error('Game must be ACTIVE to start a round');
    }

    // Verify previous round is COMPLETED if it exists
    if (game.currentRoundNumber > 0) {
      const prevRound = await Round.findOne({ gameId, roundNumber: game.currentRoundNumber }).session(session);
      if (prevRound && prevRound.status !== 'COMPLETED') {
        throw new Error('Previous round is not completed');
      }
    }

    const roundNumber = game.currentRoundNumber + 1;
    const bootAmount = game.bootAmount;

    // Create Round players array from game.turnOrder
    const players = game.turnOrder.map(uId => ({
      userId: uId,
      status: 'ACTIVE',
      totalContribution: bootAmount,
      seenCards: false,
    }));

    const round = new Round({
      gameId,
      roundNumber,
      status: 'ACTIVE',
      potAmount: players.length * bootAmount,
      currentBet: bootAmount,
      startingBet: bootAmount,
      currentTurnIndex: 0,
      players,
      startedAt: new Date(),
    });

    await round.save({ session });

    // Deduct boot amount from each player using ledger service
    for (const player of players) {
      await recordTransaction(session, {
        userId: player.userId,
        gameId,
        roundId: round._id,
        type: 'BOOT',
        amount: -bootAmount,
      });
    }

    game.currentRoundNumber = roundNumber;
    await game.save({ session });

    await session.commitTransaction();
    _emitUpdate(gameId);
    return round;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const _validateAction = (round, game, userId) => {
  if (game.status !== 'ACTIVE') throw new Error('Game is not active');
  if (round.status !== 'ACTIVE' && round.status !== 'SIDE_SHOW_PENDING' && round.status !== 'SHOW_PENDING') {
    throw new Error('Round is not active');
  }
  
  const currentPlayer = round.players[round.currentTurnIndex];
  if (currentPlayer.userId.toString() !== userId.toString()) {
    throw new Error('It is not your turn');
  }
  if (currentPlayer.status !== 'ACTIVE') {
    throw new Error('You are not active in this round');
  }
  
  return currentPlayer;
};

const _completeRound = async (session, round, winnerId) => {
  round.status = 'COMPLETED';
  round.winnerId = winnerId;
  round.endedAt = new Date();

  const winnerPlayer = round.players.find(p => p.userId.toString() === winnerId.toString());
  if (winnerPlayer) winnerPlayer.status = 'WINNER';

  await round.save({ session });

  await recordTransaction(session, {
    userId: winnerId,
    gameId: round.gameId,
    roundId: round._id,
    type: 'ROUND_WIN',
    amount: round.potAmount,
  });

  const { getIO } = require('../../shared/sockets');
  getIO().to(`game:${round.gameId}`).emit('round:completed', { roundId: round._id });
};

const bet = async (roundId, userId) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const round = await Round.findById(roundId).session(session);
    if (!round) throw new Error('Round not found');
    const game = await Game.findById(round.gameId).session(session);

    const currentPlayer = _validateAction(round, game, userId);
    if (round.status !== 'ACTIVE') throw new Error('Round is not in ACTIVE state');

    const betAmount = round.currentBet;
    round.potAmount += betAmount;
    currentPlayer.totalContribution += betAmount;

    await recordTransaction(session, {
      userId,
      gameId: game._id,
      roundId: round._id,
      type: 'BET',
      amount: -betAmount,
    });

    const nextIndex = turnManager.getNextActivePlayerIndex(round.players, round.currentTurnIndex);
    if (nextIndex === null) throw new Error('No active players found');
    
    round.currentTurnIndex = nextIndex;
    await round.save({ session });
    
    await session.commitTransaction();
    _emitUpdate(game._id);
    return round;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const betTwice = async (roundId, userId) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const round = await Round.findById(roundId).session(session);
    if (!round) throw new Error('Round not found');
    const game = await Game.findById(round.gameId).session(session);

    const currentPlayer = _validateAction(round, game, userId);
    if (round.status !== 'ACTIVE') throw new Error('Round is not in ACTIVE state');

    const newBet = round.currentBet * 2;
    if (newBet > round.startingBet * game.maxBetMultiplier) {
      const err = new Error('Bet exceeds max bet limit');
      err.statusCode = 400;
      throw err;
    }

    round.currentBet = newBet;
    round.potAmount += newBet;
    currentPlayer.totalContribution += newBet;

    await recordTransaction(session, {
      userId,
      gameId: game._id,
      roundId: round._id,
      type: 'BET_TWICE',
      amount: -newBet,
    });

    const nextIndex = turnManager.getNextActivePlayerIndex(round.players, round.currentTurnIndex);
    round.currentTurnIndex = nextIndex;
    await round.save({ session });
    
    await session.commitTransaction();
    _emitUpdate(game._id);
    return round;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const pack = async (roundId, userId) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const round = await Round.findById(roundId).session(session);
    if (!round) throw new Error('Round not found');
    const game = await Game.findById(round.gameId).session(session);

    const currentPlayer = _validateAction(round, game, userId);
    if (round.status !== 'ACTIVE') throw new Error('Round is not in ACTIVE state');

    currentPlayer.status = 'PACKED';

    const winner = turnManager.checkOnePlayerRemaining(round.players);
    if (winner) {
      await _completeRound(session, round, winner.userId);
    } else {
      const nextIndex = turnManager.getNextActivePlayerIndex(round.players, round.currentTurnIndex);
      round.currentTurnIndex = nextIndex;
      await round.save({ session });
    }

    await session.commitTransaction();
    _emitUpdate(game._id);
    return round;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const requestSideShow = async (roundId, userId, targetUserId) => {
  const round = await Round.findById(roundId);
  const game = await Game.findById(round.gameId);
  _validateAction(round, game, userId);

  const activePlayers = round.players.filter(p => p.status === 'ACTIVE');
  if (activePlayers.length <= 2) {
    throw new Error('Side show requires more than 2 active players');
  }

  // Find previous active player to be the target
  // In a real game, the previous player is usually the one who bet before you.
  // For simplicity, verify the target is active.
  const target = round.players.find(p => p.userId.toString() === targetUserId.toString() && p.status === 'ACTIVE');
  if (!target) throw new Error('Target player is not active');

  round.status = 'SIDE_SHOW_PENDING';
  round.sideShowRequest = {
    requestedBy: userId,
    targetPlayer: targetUserId,
    result: 'PENDING'
  };
  await round.save();
  _emitUpdate(game._id);
  return round;
};

const respondSideShow = async (roundId, userId, accept) => {
  const round = await Round.findById(roundId);
  if (round.status !== 'SIDE_SHOW_PENDING') throw new Error('No side show pending');
  
  if (round.sideShowRequest.targetPlayer.toString() !== userId.toString()) {
    throw new Error('You are not the target of this side show');
  }

  if (!accept) {
    // Declined, turn advances
    round.status = 'ACTIVE';
    round.sideShowRequest = null;
    const nextIndex = turnManager.getNextActivePlayerIndex(round.players, round.currentTurnIndex);
    round.currentTurnIndex = nextIndex;
    await round.save();
    _emitUpdate(round.gameId);
    return round;
  }

  // Accepted, waiting for result to be posted
  await round.save();
  _emitUpdate(round.gameId);
  return round;
};

const submitSideShowResult = async (roundId, userId, loserUserId) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const round = await Round.findById(roundId).session(session);
    if (round.status !== 'SIDE_SHOW_PENDING') throw new Error('No side show pending');
    
    // Validate users involved
    const reqBy = round.sideShowRequest.requestedBy.toString();
    const tgt = round.sideShowRequest.targetPlayer.toString();
    
    if (loserUserId !== reqBy && loserUserId !== tgt) {
      throw new Error('Loser must be one of the players involved in the side show');
    }

    const loser = round.players.find(p => p.userId.toString() === loserUserId);
    loser.status = 'PACKED';

    round.status = 'ACTIVE';
    round.sideShowRequest.result = loserUserId === reqBy ? 'TARGET_WON' : 'REQUESTER_WON';

    const winner = turnManager.checkOnePlayerRemaining(round.players);
    if (winner) {
      await _completeRound(session, round, winner.userId);
    } else {
      const nextIndex = turnManager.getNextActivePlayerIndex(round.players, round.currentTurnIndex);
      round.currentTurnIndex = nextIndex;
      await round.save({ session });
    }

    await session.commitTransaction();
    _emitUpdate(round.gameId);
    return round;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const requestShow = async (roundId, userId) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const round = await Round.findById(roundId).session(session);
    if (!round) throw new Error('Round not found');
    const game = await Game.findById(round.gameId).session(session);

    const currentPlayer = _validateAction(round, game, userId);

    const activePlayers = round.players.filter(p => p.status === 'ACTIVE');
    if (activePlayers.length !== 2) {
      throw new Error('Show can only be requested when exactly 2 active players remain');
    }

    const betAmount = round.currentBet;
    round.potAmount += betAmount;
    currentPlayer.totalContribution += betAmount;

    await recordTransaction(session, {
      userId,
      gameId: game._id,
      roundId: round._id,
      type: 'SHOW_FEE',
      amount: -betAmount,
      description: `Paid ₹${betAmount} for Show`
    });

    round.status = 'SHOW_PENDING';
    await round.save({ session });
    
    await session.commitTransaction();
    session.endSession();
    
    _emitUpdate(game._id);
    return round;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

const submitShowResult = async (roundId, userId, winnerUserId) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const round = await Round.findById(roundId).session(session);
    if (round.status !== 'SHOW_PENDING') throw new Error('No show pending');
    
    const activePlayers = round.players.filter(p => p.status === 'ACTIVE');
    const isValidWinner = activePlayers.some(p => p.userId.toString() === winnerUserId);
    if (!isValidWinner) throw new Error('Winner must be an active player');

    // the loser gets packed (optional, since round ends anyway)
    activePlayers.forEach(p => {
      if (p.userId.toString() !== winnerUserId) p.status = 'PACKED';
    });

    await _completeRound(session, round, winnerUserId);
    
    await session.commitTransaction();
    _emitUpdate(round.gameId);
    return round;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const getRoundById = async (roundId) => {
  return await Round.findById(roundId)
    .populate('players.userId', 'name username')
    .populate('winnerId', 'name username');
};

module.exports = {
  startRound,
  bet,
  betTwice,
  pack,
  requestSideShow,
  respondSideShow,
  submitSideShowResult,
  requestShow,
  submitShowResult,
  getRoundById,
};
