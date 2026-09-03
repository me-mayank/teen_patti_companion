const asyncHandler = require('../../shared/utils/asyncHandler');
const ledgerService = require('./ledger.service');

// @desc    Get transactions for a game
// @route   GET /api/games/:id/transactions
// @access  Private
const getGameTransactions = asyncHandler(async (req, res) => {
  // Ideally verify user is part of the game
  const transactions = await ledgerService.getGameTransactions(req.params.id);
  res.json(transactions);
});

// @desc    Get final summary for a game
// @route   GET /api/games/:id/summary
// @access  Private
const getGameSummary = asyncHandler(async (req, res) => {
  const summary = await ledgerService.getGameSummary(req.params.id);
  res.json(summary);
});

module.exports = {
  getGameTransactions,
  getGameSummary
};
