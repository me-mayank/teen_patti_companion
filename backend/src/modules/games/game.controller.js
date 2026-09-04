const asyncHandler = require('../../shared/utils/asyncHandler');
const gameService = require('./game.service');
const { settleGame, getSettlementPreview } = require('./settle.service');

// @desc    Create a new game
// @route   POST /api/games
// @access  Private
const createGame = asyncHandler(async (req, res) => {
  if (req.user.globalBalance < req.body.bootAmount) {
    res.status(400);
    throw new Error(`Insufficient wallet balance to create game. Required: ₹${req.body.bootAmount}`);
  }

  const gameData = {
    ...req.body,
    createdBy: req.user._id,
    participants: [{ userId: req.user._id, balance: 0 }],
  };
  const game = await gameService.createGame(gameData);
  res.status(201).json(game);
});

// @desc    Get active games for user
// @route   GET /api/games
// @access  Private
const getGames = asyncHandler(async (req, res) => {
  const games = await gameService.getActiveGamesForUser(req.user._id);
  res.json(games);
});

// @desc    Get game history for user
// @route   GET /api/games/history
// @access  Private
const getGameHistory = asyncHandler(async (req, res) => {
  const games = await gameService.getGameHistoryForUser(req.user._id);
  res.json(games);
});

// @desc    Get game by ID
// @route   GET /api/games/:id
// @access  Private
const getGameById = asyncHandler(async (req, res) => {
  const game = await gameService.getGameById(req.params.id);
  // Optional: Add check to ensure user is part of the game or creator or invited
  res.json(game);
});

// @desc    Get current round for game
// @route   GET /api/games/:id/rounds/current
// @access  Private
const getCurrentRound = asyncHandler(async (req, res) => {
  const round = await gameService.getCurrentRoundForGame(req.params.id);
  if (!round) {
    return res.status(404).json({ message: 'No active round found' });
  }
  res.json(round);
});

// @desc    Finalize players
// @route   PATCH /api/games/:id/finalize-players
// @access  Private
const finalizePlayers = asyncHandler(async (req, res) => {
  const game = await gameService.finalizePlayers(req.params.id, req.user._id);
  res.json(game);
});

// @desc    Set turn order
// @route   PATCH /api/games/:id/turn-order
// @access  Private
const setTurnOrder = asyncHandler(async (req, res) => {
  const game = await gameService.setTurnOrder(req.params.id, req.body.orderedUserIds, req.user._id);
  res.json(game);
});

// @desc    Start game
// @route   PATCH /api/games/:id/start
// @access  Private
const startGame = asyncHandler(async (req, res) => {
  const game = await gameService.startGame(req.params.id, req.user._id);
  res.json(game);
});

// @desc    End game
// @route   PATCH /api/games/:id/end
// @access  Private
const endGame = asyncHandler(async (req, res) => {
  const game = await gameService.endGame(req.params.id, req.user._id);
  res.json(game);
});


/**
 * POST /api/games/:id/snapshot
 * Receives a periodic state snapshot from the hybrid Host engine.
 */
function postSnapshot(req, res) {
  const { id: gameId } = req.params;
  const { stateVersion } = req.body;
  console.log(`[hybrid] snapshot received: game=${gameId} v${stateVersion}`);
  res.status(200).json({ ok: true, stateVersion });
}

/**
 * POST /api/games/:id/settle
 * Final hybrid settlement: receives engine final state, verifies zero-sum,
 * reconciles DB, updates global wallets.
 */
const settleGameHandler = asyncHandler(async (req, res) => {
  const { id: gameId } = req.params;
  const { finalEngineState } = req.body;

  if (!finalEngineState) {
    res.status(400);
    throw new Error('finalEngineState is required');
  }

  const game = await settleGame(gameId, req.user._id, finalEngineState);
  res.status(200).json({ ok: true, game });
});

/**
 * GET /api/games/:id/settlement-preview
 * Read-only preview of final P&L before confirming settlement.
 */
const getSettlementPreviewHandler = asyncHandler(async (req, res) => {
  const { id: gameId } = req.params;
  const preview = await getSettlementPreview(gameId);
  res.status(200).json(preview);
});

module.exports = {
  createGame,
  getGames,
  getGameHistory,
  getGameById,
  getCurrentRound,
  finalizePlayers,
  setTurnOrder,
  startGame,
  endGame,
  postSnapshot,
  settleGameHandler,
  getSettlementPreviewHandler,
};
