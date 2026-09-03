const mongoose = require('mongoose');
const Transaction = require('./transaction.model');
const Game = require('../games/game.model');

const recordTransaction = async (session, { userId, gameId, roundId, type, amount }) => {
  // We accept an optional mongoose session to ensure atomicity with round updates
  const options = session ? { session } : {};
  
  // 1. Create the transaction record
  const [transaction] = await Transaction.create([{
    userId,
    gameId,
    roundId,
    type,
    amount
  }], options);

  // 2. Update the denormalized balance on the Game object
  if (gameId) {
    await Game.updateOne(
      { _id: gameId, 'participants.userId': userId },
      { $inc: { 'participants.$.balance': amount } },
      options
    );
  }

  return transaction;
};

const getGameTransactions = async (gameId) => {
  return await Transaction.find({ gameId })
    .populate('userId', 'name username')
    .sort('createdAt');
};

const getGameSummary = async (gameId) => {
  const game = await Game.findById(gameId).populate('participants.userId', 'name username');
  if (!game) throw new Error('Game not found');

  const balances = game.participants.map(p => ({
    user: p.userId,
    balance: p.balance
  }));

  const totalSum = balances.reduce((sum, p) => sum + p.balance, 0);
  const isZeroSum = Math.abs(totalSum) < 0.01; // floating point precision check

  return {
    gameId,
    status: game.status,
    isZeroSum,
    totalSum,
    balances
  };
};

module.exports = {
  recordTransaction,
  getGameTransactions,
  getGameSummary
};
