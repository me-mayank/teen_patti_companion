const express = require('express');
const router = express.Router();
const {
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
} = require('./game.controller');
const { getGameTransactions, getGameSummary } = require('../ledger/ledger.controller');
const { startRound } = require('../rounds/round.controller');
const { protect } = require('../../shared/middleware/auth.middleware');
const { validate } = require('../../shared/middleware/validate.middleware');
const { createGameSchema, turnOrderSchema } = require('./game.validation');
const { invitePlayersSchema } = require('../invitations/invitation.validation');
const { invitePlayers, getGameInvitations } = require('../invitations/invitation.controller');

router
  .route('/')
  .post(protect, validate(createGameSchema), createGame)
  .get(protect, getGames);

router.route('/history').get(protect, getGameHistory);
router.route('/:id').get(protect, getGameById);
router.route('/:id/rounds/current').get(protect, getCurrentRound);
router.route('/:id/finalize-players').patch(protect, finalizePlayers);
router.route('/:id/turn-order').patch(protect, validate(turnOrderSchema), setTurnOrder);
router.route('/:id/start').patch(protect, startGame);
router.route('/:id/end').patch(protect, endGame);
router.route('/:id/rounds').post(protect, startRound);
router.route('/:id/transactions').get(protect, getGameTransactions);
router.route('/:id/summary').get(protect, getGameSummary);
router.route('/:id/snapshot').post(protect, postSnapshot);               // Hybrid: async cloud backup
router.route('/:id/settle').post(protect, settleGameHandler);             // Hybrid: final settlement
router.route('/:id/settlement-preview').get(protect, getSettlementPreviewHandler); // Hybrid: preview

router
  .route('/:id/invitations')
  .post(protect, validate(invitePlayersSchema), invitePlayers)
  .get(protect, getGameInvitations);

module.exports = router;
