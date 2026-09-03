const Game = require('./game.model');

const createGame = async (gameData) => {
  const game = await Game.create(gameData);
  return game;
};

const getActiveGamesForUser = async (userId) => {
  return await Game.find({
    $or: [{ createdBy: userId }, { 'participants.userId': userId }],
    status: { $nin: ['ENDED', 'ARCHIVED'] },
  })
    .populate('createdBy', 'name username')
    .sort('-createdAt');
};

const getGameHistoryForUser = async (userId) => {
  return await Game.find({
    $or: [{ createdBy: userId }, { 'participants.userId': userId }],
    status: { $in: ['ENDED', 'ARCHIVED'] },
  })
    .populate('createdBy', 'name username')
    .sort('-createdAt');
};

const getGameById = async (gameId) => {
  const game = await Game.findById(gameId)
    .populate('createdBy', 'name username')
    .populate('participants.userId', 'name username')
    .populate('turnOrder', 'name username');

  if (!game) {
    throw new Error('Game not found');
  }

  return game;
};

const getCurrentRoundForGame = async (gameId) => {
  const game = await Game.findById(gameId);
  if (!game) throw new Error('Game not found');

  if (game.currentRoundNumber === 0) return null;

  const Round = require('../rounds/round.model');
  const round = await Round.findOne({ gameId, roundNumber: game.currentRoundNumber })
    .populate('players.userId', 'name username')
    .populate('winnerId', 'name username');
    
  return round;
};

const finalizePlayers = async (gameId, userId) => {
  const game = await Game.findById(gameId);
  if (!game) throw new Error('Game not found');
  
  if (game.createdBy.toString() !== userId.toString()) {
    throw new Error('Only the creator can finalize players');
  }

  if (game.participants.length < 2) {
    throw new Error('Need at least 2 accepted players to finalize (including creator)');
  }

  game.status = 'TURN_ORDER_SETUP';
  await game.save();
  
  const { getIO } = require('../../shared/sockets');
  getIO().to(`game:${gameId}`).emit('game:update', { gameId });
  
  return game;
};

const setTurnOrder = async (gameId, orderedUserIds, userId) => {
  const game = await Game.findById(gameId);
  if (!game) throw new Error('Game not found');
  
  if (game.createdBy.toString() !== userId.toString()) {
    throw new Error('Only the creator can set turn order');
  }

  if (game.status !== 'TURN_ORDER_SETUP') {
    throw new Error('Game is not in TURN_ORDER_SETUP state');
  }

  // Ensure all orderedUserIds are in the participants list
  const participantIds = game.participants.map(p => p.userId.toString());
  const allValid = orderedUserIds.every(id => participantIds.includes(id));
  
  if (!allValid || orderedUserIds.length !== participantIds.length) {
    throw new Error('Turn order must contain exactly the finalized participants');
  }

  game.turnOrder = orderedUserIds;
  await game.save();
  
  const { getIO } = require('../../shared/sockets');
  getIO().to(`game:${gameId}`).emit('game:update', { gameId });
  
  return game;
};

const startGame = async (gameId, userId) => {
  const game = await Game.findById(gameId);
  if (!game) throw new Error('Game not found');
  
  if (game.createdBy.toString() !== userId.toString()) {
    throw new Error('Only the creator can start the game');
  }

  if (game.status !== 'TURN_ORDER_SETUP') {
    throw new Error('Game is not ready to be started (must be in TURN_ORDER_SETUP)');
  }

  if (game.turnOrder.length !== game.participants.length) {
    throw new Error('Turn order is not properly set');
  }

  game.status = 'ACTIVE';
  game.startedAt = new Date();
  await game.save();
  
  const { getIO } = require('../../shared/sockets');
  getIO().to(`game:${gameId}`).emit('game:update', { gameId });
  
  return game;
};

const endGame = async (gameId, userId) => {
  const game = await Game.findById(gameId);
  if (!game) throw new Error('Game not found');

  if (game.createdBy.toString() !== userId.toString()) {
    throw new Error('Only the creator can end the game');
  }

  // Can only end if active
  if (game.status !== 'ACTIVE') {
    throw new Error('Game is not active');
  }

  // Verify there's no round in progress (optional depending on exact rules, but good practice)
  const Round = require('../rounds/round.model');
  const activeRound = await Round.findOne({ gameId, status: { $nin: ['COMPLETED'] } });
  if (activeRound) {
    throw new Error('Cannot end game while a round is in progress');
  }

  game.status = 'ENDED';
  game.endedAt = new Date();
  await game.save();

  const { getIO } = require('../../shared/sockets');
  getIO().to(`game:${gameId}`).emit('game:update', { gameId });

  return game;
};

module.exports = {
  createGame,
  getActiveGamesForUser,
  getGameHistoryForUser,
  getGameById,
  getCurrentRoundForGame,
  finalizePlayers,
  setTurnOrder,
  startGame,
  endGame,
};
