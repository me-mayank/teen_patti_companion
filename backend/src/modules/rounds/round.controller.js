const asyncHandler = require('../../shared/utils/asyncHandler');
const roundService = require('./round.service');

// @desc    Start a new round
// @route   POST /api/games/:gameId/rounds
// @access  Private
const startRound = asyncHandler(async (req, res) => {
  const round = await roundService.startRound(req.params.id, req.user._id);
  res.status(201).json(round);
});

// @desc    Bet
// @route   POST /api/rounds/:id/bet
// @access  Private
const bet = asyncHandler(async (req, res) => {
  const round = await roundService.bet(req.params.id, req.user._id);
  res.json(round);
});

// @desc    Bet twice
// @route   POST /api/rounds/:id/bet-twice
// @access  Private
const betTwice = asyncHandler(async (req, res) => {
  const round = await roundService.betTwice(req.params.id, req.user._id);
  res.json(round);
});

// @desc    Pack
// @route   POST /api/rounds/:id/pack
// @access  Private
const pack = asyncHandler(async (req, res) => {
  const round = await roundService.pack(req.params.id, req.user._id);
  res.json(round);
});

// @desc    Request Side Show
// @route   POST /api/rounds/:id/side-show/request
// @access  Private
const requestSideShow = asyncHandler(async (req, res) => {
  const round = await roundService.requestSideShow(req.params.id, req.user._id);
  res.json(round);
});

// @desc    Respond Side Show
// @route   POST /api/rounds/:id/side-show/respond
// @access  Private
const respondSideShow = asyncHandler(async (req, res) => {
  const round = await roundService.respondSideShow(req.params.id, req.user._id, req.body.accept);
  res.json(round);
});

// @desc    Submit Side Show Result
// @route   POST /api/rounds/:id/side-show/result
// @access  Private
const submitSideShowResult = asyncHandler(async (req, res) => {
  const round = await roundService.submitSideShowResult(req.params.id, req.user._id, req.body.loserUserId);
  res.json(round);
});

// @desc    Request Show
// @route   POST /api/rounds/:id/show/request
// @access  Private
const requestShow = asyncHandler(async (req, res) => {
  const round = await roundService.requestShow(req.params.id, req.user._id);
  res.json(round);
});

// @desc    Submit Show Result
// @route   POST /api/rounds/:id/show/result
// @access  Private
const submitShowResult = asyncHandler(async (req, res) => {
  const round = await roundService.submitShowResult(req.params.id, req.user._id, req.body.winnerUserId);
  res.json(round);
});

// @desc    Get Round by ID
// @route   GET /api/rounds/:id
// @access  Private
const getRound = asyncHandler(async (req, res) => {
  const round = await roundService.getRoundById(req.params.id);
  res.json(round);
});

// @desc    Settle a round (host-only, called after local engine completes round)
// @route   POST /api/rounds/:id/settle
// @access  Private
const settleRound = asyncHandler(async (req, res) => {
  const { winnerId, potAmount, playerContributions } = req.body;
  const round = await roundService.settleRound(
    req.params.id,
    { winnerId, potAmount, playerContributions },
    req.user._id
  );
  res.json(round);
});

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
  getRound,
  settleRound,
};
