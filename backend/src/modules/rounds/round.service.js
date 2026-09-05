const mongoose = require('mongoose');
const Round = require('./round.model');
const Game = require('../games/game.model');
const { recordTransaction } = require('../ledger/ledger.service');
const turnManager = require('./turnManager.service');
const { getIO } = require('../../shared/sockets');

const _emitUpdate = async (gameId) => {
  try {
    const game = await Game.findById(gameId)
      .populate('createdBy', 'name username profilePicture')
      .populate('participants.userId', 'name username profilePicture')
      .populate('turnOrder', 'name username profilePicture');

    let round = null;
    if (game && game.currentRoundNumber > 0) {
      round = await Round.findOne({ gameId, roundNumber: game.currentRoundNumber })
        .populate('players.userId', 'name username profilePicture')
        .populate('winnerId', 'name username profilePicture');
    }

    const payload = { gameId, game, round };
    getIO().to(`game:${gameId}`).emit('game:update', payload);
    getIO().to(`game:${gameId}`).emit('round:update', payload);
  } catch (err) {
    console.error('Error emitting populated update:', err);
    getIO().to(`game:${gameId}`).emit('game:update', { gameId });
    getIO().to(`game:${gameId}`).emit('round:update', { gameId });
  }
};

const User = require('../users/user.model');

const _checkBalance = async (game, userId, amountRequired, session) => {
  const participant = game.participants.find(p => p.userId.toString() === userId.toString());
  if (!participant) throw new Error('Participant not found');

  const user = await User.findById(userId).session(session);
  if (!user) throw new Error('User not found');

  // Effective balance = in-game running balance + global wallet.
  // participant.balance tracks winnings/losses within the game session.
  // If it goes negative (player lost their deposit), they can still bet
  // as long as their global wallet covers it — settled at game end.
  const availableBalance = participant.balance + user.globalBalance;
  if (availableBalance < amountRequired) {
    const err = new Error(`Insufficient balance. Required: ₹${amountRequired}, Available: ₹${availableBalance}`);
    err.statusCode = 400;
    throw err;
  }
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

    // Check balance for all players
    for (const uId of game.turnOrder) {
      await _checkBalance(game, uId, bootAmount, session);
    }

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
    await _checkBalance(game, userId, betAmount, session);
    
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
    
    await _checkBalance(game, userId, newBet, session);

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

const requestSideShow = async (roundId, userId) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const round = await Round.findById(roundId).session(session);
    const game = await Game.findById(round.gameId).session(session);
    _validateAction(round, game, userId);

    const activePlayers = round.players.filter(p => p.status === 'ACTIVE');
    if (activePlayers.length <= 2) {
      throw new Error('Side show requires more than 2 active players');
    }

    const prevIndex = turnManager.getPreviousActivePlayerIndex(round.players, round.currentTurnIndex);
    if (prevIndex === null) throw new Error('Could not find previous active player');
    const targetUserId = round.players[prevIndex].userId;

    const betAmount = round.currentBet;

    // Record side show fee
    await recordTransaction(session, {
      userId,
      gameId: game._id,
      roundId: round._id,
      type: 'BET',
      amount: -betAmount,
    });

    await _checkBalance(game, userId, betAmount, session);
    round.potAmount += betAmount;
    
    // Enter pending state, DO NOT advance turn yet
    round.status = 'SIDE_SHOW_PENDING';
    round.sideShowRequest = {
      requestedBy: userId,
      targetPlayer: targetUserId,
      result: 'PENDING'
    };
    
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

const respondSideShow = async (roundId, userId, accept) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const round = await Round.findById(roundId).session(session);
    if (round.status !== 'SIDE_SHOW_PENDING') throw new Error('No side show pending');
    
    const request = round.sideShowRequest;
    if (request.targetPlayer.toString() !== userId.toString()) {
      throw new Error('You are not the target of this side show');
    }

    if (!accept) {
      // Declined, turn advances
      round.status = 'ACTIVE';
      round.sideShowRequest = null;
      const nextIndex = turnManager.getNextActivePlayerIndex(round.players, round.currentTurnIndex);
      round.currentTurnIndex = nextIndex;
      await round.save({ session });
      await session.commitTransaction();
      _emitUpdate(round.gameId);
      return round;
    }

    // Accepted, waiting for result to be posted
    request.result = 'ACCEPTED';
    await round.save({ session });
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

const submitSideShowResult = async (roundId, userId, loserUserId) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const round = await Round.findById(roundId).session(session);
    if (round.status !== 'SIDE_SHOW_PENDING' || round.sideShowRequest?.result !== 'ACCEPTED') {
      throw new Error('Invalid side show state');
    }

    const request = round.sideShowRequest;
    const reqBy = request.requestedBy.toString();
    const tgt = request.targetPlayer.toString();
    
    if (userId.toString() !== reqBy && userId.toString() !== tgt) {
      throw new Error('Only participants can submit result');
    }
    
    if (loserUserId.toString() !== reqBy && loserUserId.toString() !== tgt) {
      throw new Error('Loser must be one of the players involved in the side show');
    }

    const loser = round.players.find(p => p.userId.toString() === loserUserId.toString());
    if (!loser) throw new Error('Loser not found');

    loser.status = 'PACKED';
    round.status = 'ACTIVE';
    round.sideShowRequest = null;

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
    await _checkBalance(game, userId, betAmount, session);
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
    .populate('players.userId', 'name username profilePicture')
    .populate('winnerId', 'name username profilePicture');
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
