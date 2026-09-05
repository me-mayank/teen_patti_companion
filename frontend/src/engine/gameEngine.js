/**
 * gameEngine.js — Authoritative Pure Game Engine
 *
 * Framework-agnostic. No imports from MongoDB, Express, or any server framework.
 * No async I/O — all operations are synchronous and pure.
 *
 * This engine is the source of truth for ALL Teen Patti rules.
 * It can run in:
 *   - The browser (Host Engine in Hybrid architecture)
 *   - Node.js (thin wrapper in current server architecture)
 *
 * Every exported function follows the same contract:
 *   applyXxx(state, action) → { newState, events[], error? }
 *
 * Never mutates input state. Always returns new state objects.
 * Events are plain objects describing what happened (for logging, UI, cloud backup).
 */

import {
  getNextActivePlayerIndex,
  getPreviousActivePlayerIndex,
  checkOnePlayerRemaining,
  countActivePlayers,
} from './turnManager.js';

import { incrementVersion, isDuplicate } from './stateVersioner.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Deep-clones the game state to ensure immutability.
 * Uses structured clone in browser, JSON parse/stringify as fallback.
 */
const clone = (state) => {
  if (typeof structuredClone === 'function') return structuredClone(state);
  return JSON.parse(JSON.stringify(state));
};

/**
 * Creates a standardized error result.
 */
const err = (code, message) => ({ newState: null, events: [], error: { code, message } });

/**
 * Validates the basic preconditions shared by all turn-based actions.
 * Returns { ok: true, currentPlayer } or { ok: false, error }
 */
const _validateTurn = (state, userId) => {
  if (state.status !== 'ACTIVE') {
    return { ok: false, error: { code: 'ROUND_NOT_ACTIVE', message: 'Round is not in ACTIVE state' } };
  }

  const currentPlayer = state.players[state.currentTurnIndex];
  if (!currentPlayer) {
    return { ok: false, error: { code: 'NO_CURRENT_PLAYER', message: 'No current player found' } };
  }

  if (currentPlayer.userId !== userId) {
    return { ok: false, error: { code: 'NOT_YOUR_TURN', message: 'It is not your turn' } };
  }

  if (currentPlayer.status !== 'ACTIVE') {
    return { ok: false, error: { code: 'PLAYER_PACKED', message: 'You are not active in this round' } };
  }

  return { ok: true, currentPlayer };
};

/**
 * Validates that a player has sufficient game balance for an action.
 */
const _validateBalance = (state, userId, amountRequired) => {
  const player = state.players.find(p => p.userId === userId);
  if (!player) return { ok: false, error: { code: 'PLAYER_NOT_FOUND', message: 'Player not found' } };

  if (player.gameBalance < amountRequired) {
    return {
      ok: false,
      error: {
        code: 'INSUFFICIENT_GAME_BALANCE',
        message: `Insufficient balance. Required: ₹${amountRequired}, Available: ₹${player.gameBalance}`,
      },
    };
  }

  return { ok: true };
};

/**
 * Internal: marks the round COMPLETED, credits winner, emits events.
 * Returns the updated state and events.
 */
const _completeRound = (state, winnerId) => {
  const newState = clone(state);

  const round = newState.round;
  round.status = 'COMPLETED';
  round.winnerId = winnerId;
  round.endedAt = new Date().toISOString();

  const roundWinner = round.players.find(p => p.userId === winnerId);
  if (roundWinner) {
    roundWinner.status = 'WINNER';
  }

  const gameWinner = newState.players.find(p => p.userId === winnerId);
  if (gameWinner) {
    gameWinner.gameBalance += round.potAmount;
  }

  const events = [
    {
      type: 'ROUND_WIN',
      userId: winnerId,
      amount: round.potAmount,
      stateVersion: newState.stateVersion,
    },
    {
      type: 'ROUND_COMPLETED',
      winnerId,
      potAmount: round.potAmount,
      stateVersion: newState.stateVersion,
    },
  ];

  return { newState, events };
};

// ---------------------------------------------------------------------------
// State Factory
// ---------------------------------------------------------------------------

/**
 * Creates the initial game state snapshot.
 * Called once when the game starts (after cloud financial checkpoint).
 *
 * @param {Object} config
 * @param {String} config.gameId
 * @param {String} config.sessionId
 * @param {Number} config.bootAmount
 * @param {Number} config.maxBetMultiplier
 * @param {Array}  config.orderedPlayers - [{ userId, name, username, profilePicture, startingBalance }]
 * @returns {Object} Initial game state
 */
export const createGameState = ({ gameId, sessionId, bootAmount, maxBetMultiplier, orderedPlayers }) => ({
  gameId,
  sessionId,
  stateVersion: 0,
  actionHistory: [],       // Array of processed actionIds for deduplication
  status: 'WAITING',       // WAITING | ROUND_ACTIVE | ENDED
  bootAmount,
  maxBetMultiplier,
  currentRoundNumber: 0,
  round: null,             // Active round state, null between rounds
  players: orderedPlayers.map(p => ({
    userId: p.userId,
    name: p.name,
    username: p.username,
    profilePicture: p.profilePicture ?? null,
    gameBalance: p.startingBalance,
    totalDeposited: p.startingBalance,
    // Store globalBalance so mid-round re-syncs can always compute
    // gameBalance = inGameBal + globalBalance without needing the DB
    // participants.userId to be populated.
    globalBalance: p.globalBalance ?? 0,
  })),
  eventLog: [],            // Full audit log for cloud backup
  startedAt: new Date().toISOString(),
});

// ---------------------------------------------------------------------------
// Round Lifecycle
// ---------------------------------------------------------------------------

/**
 * Initializes a new round on the existing game state.
 * Deducts boot amount from each player and builds the round object.
 *
 * @param {Object} state - Current game state
 * @param {String} actionId - Unique ID for idempotency
 * @returns {{ newState, events, error? }}
 */
export const startRound = (state, { actionId }) => {
  if (isDuplicate(state.actionHistory, actionId)) {
    return err('DUPLICATE_ACTION', 'This action was already applied');
  }

  if (state.status !== 'WAITING') {
    return err('INVALID_STATE', 'A round is already active or the game has ended');
  }

  const bootAmount = state.bootAmount;

  // Verify all players have sufficient balance
  for (const player of state.players) {
    if (player.gameBalance < bootAmount) {
      return err(
        'INSUFFICIENT_GAME_BALANCE',
        `${player.name} has insufficient balance to pay boot (₹${bootAmount}). Available: ₹${player.gameBalance}`
      );
    }
  }

  const newState = clone(state);
  newState.actionHistory.push(actionId);
  newState.currentRoundNumber += 1;
  newState.status = 'ROUND_ACTIVE';

  const players = newState.players.map(p => ({
    userId: p.userId,
    status: 'ACTIVE',
    totalContribution: bootAmount,
    seenCards: false,
  }));

  const potAmount = players.length * bootAmount;

  // Deduct boot from each player's game balance
  for (const p of newState.players) {
    p.gameBalance -= bootAmount;
  }

  newState.round = {
    roundNumber: newState.currentRoundNumber,
    status: 'ACTIVE',
    potAmount,
    currentBet: bootAmount,
    startingBet: bootAmount,
    currentTurnIndex: 0,
    players,
    sideShowRequest: null,
    winnerId: null,
    startedAt: new Date().toISOString(),
    endedAt: null,
  };

  const updated = incrementVersion(newState);

  const events = updated.players.map(p => ({
    type: 'BOOT',
    userId: p.userId,
    amount: -bootAmount,
    roundNumber: updated.currentRoundNumber,
    stateVersion: updated.stateVersion,
  }));
  events.push({ type: 'ROUND_STARTED', roundNumber: updated.currentRoundNumber, stateVersion: updated.stateVersion });

  updated.eventLog.push(...events);

  return { newState: updated, events };
};

// ---------------------------------------------------------------------------
// Round Actions
// ---------------------------------------------------------------------------

/**
 * BET — Current player bets the current bet amount.
 */
export const applyBet = (state, { userId, actionId }) => {
  if (isDuplicate(state.actionHistory, actionId)) {
    return err('DUPLICATE_ACTION', 'This action was already applied');
  }

  const turnCheck = _validateTurn(state.round, userId);
  if (!turnCheck.ok) return err(turnCheck.error.code, turnCheck.error.message);

  const betAmount = state.round.currentBet;
  const balCheck = _validateBalance(state, userId, betAmount);
  if (!balCheck.ok) return err(balCheck.error.code, balCheck.error.message);

  const newState = clone(state);
  newState.actionHistory.push(actionId);

  const round = newState.round;
  const player = round.players[round.currentTurnIndex];
  const gamePlayer = newState.players.find(p => p.userId === userId);

  round.potAmount += betAmount;
  player.totalContribution += betAmount;
  gamePlayer.gameBalance -= betAmount;

  const nextIndex = getNextActivePlayerIndex(round.players, round.currentTurnIndex);
  if (nextIndex === null) return err('NO_ACTIVE_PLAYERS', 'No next active player found');
  round.currentTurnIndex = nextIndex;

  const updated = incrementVersion(newState);
  const event = { type: 'BET', userId, amount: -betAmount, stateVersion: updated.stateVersion };
  updated.eventLog.push(event);

  return { newState: updated, events: [event] };
};

/**
 * BET_TWICE — Current player doubles the current bet.
 */
export const applyBetTwice = (state, { userId, actionId }) => {
  if (isDuplicate(state.actionHistory, actionId)) {
    return err('DUPLICATE_ACTION', 'This action was already applied');
  }

  const turnCheck = _validateTurn(state.round, userId);
  if (!turnCheck.ok) return err(turnCheck.error.code, turnCheck.error.message);

  const newBet = state.round.currentBet * 2;
  const maxAllowed = state.round.startingBet * state.maxBetMultiplier;

  if (newBet > maxAllowed) {
    return err('BET_EXCEEDS_MAX', `Bet ₹${newBet} exceeds max allowed ₹${maxAllowed}`);
  }

  const balCheck = _validateBalance(state, userId, newBet);
  if (!balCheck.ok) return err(balCheck.error.code, balCheck.error.message);

  const newState = clone(state);
  newState.actionHistory.push(actionId);

  const round = newState.round;
  const player = round.players[round.currentTurnIndex];
  const gamePlayer = newState.players.find(p => p.userId === userId);

  round.currentBet = newBet;
  round.potAmount += newBet;
  player.totalContribution += newBet;
  gamePlayer.gameBalance -= newBet;

  const nextIndex = getNextActivePlayerIndex(round.players, round.currentTurnIndex);
  if (nextIndex === null) return err('NO_ACTIVE_PLAYERS', 'No next active player found');
  round.currentTurnIndex = nextIndex;

  const updated = incrementVersion(newState);
  const event = { type: 'BET_TWICE', userId, amount: -newBet, newCurrentBet: newBet, stateVersion: updated.stateVersion };
  updated.eventLog.push(event);

  return { newState: updated, events: [event] };
};

/**
 * PACK — Current player folds. Auto-completes round if only 1 player remains.
 */
export const applyPack = (state, { userId, actionId }) => {
  if (isDuplicate(state.actionHistory, actionId)) {
    return err('DUPLICATE_ACTION', 'This action was already applied');
  }

  const turnCheck = _validateTurn(state.round, userId);
  if (!turnCheck.ok) return err(turnCheck.error.code, turnCheck.error.message);

  const newState = clone(state);
  newState.actionHistory.push(actionId);

  const round = newState.round;
  const player = round.players[round.currentTurnIndex];
  player.status = 'PACKED';

  let events = [{ type: 'PACK', userId, stateVersion: newState.stateVersion }];

  const winner = checkOnePlayerRemaining(round.players);
  if (winner) {
    const { newState: completedState, events: completionEvents } = _completeRound(newState, winner.userId);
    completedState.status = 'WAITING';
    const updated = incrementVersion(completedState);
    updated.eventLog.push(...events, ...completionEvents);
    return { newState: updated, events: [...events, ...completionEvents] };
  }

  const nextIndex = getNextActivePlayerIndex(round.players, round.currentTurnIndex);
  if (nextIndex === null) return err('NO_ACTIVE_PLAYERS', 'No next active player found');
  round.currentTurnIndex = nextIndex;

  const updated = incrementVersion(newState);
  updated.eventLog.push(...events);

  return { newState: updated, events };
};

/**
 * SIDE_SHOW_REQUEST — Request side show with the previous active player.
 * Pays current bet as the side show fee. Requires >2 active players.
 */
export const applySideShowRequest = (state, { userId, actionId }) => {
  if (isDuplicate(state.actionHistory, actionId)) {
    return err('DUPLICATE_ACTION', 'This action was already applied');
  }

  const turnCheck = _validateTurn(state.round, userId);
  if (!turnCheck.ok) return err(turnCheck.error.code, turnCheck.error.message);

  if (countActivePlayers(state.round.players) <= 2) {
    return err('SIDE_SHOW_NOT_ALLOWED', 'Side show requires more than 2 active players');
  }

  const betAmount = state.round.currentBet;
  const balCheck = _validateBalance(state, userId, betAmount);
  if (!balCheck.ok) return err(balCheck.error.code, balCheck.error.message);

  const prevIndex = getPreviousActivePlayerIndex(state.round.players, state.round.currentTurnIndex);
  if (prevIndex === null) return err('NO_PREV_PLAYER', 'Could not find previous active player');

  const targetUserId = state.round.players[prevIndex].userId;

  const newState = clone(state);
  newState.actionHistory.push(actionId);

  const round = newState.round;
  const gamePlayer = newState.players.find(p => p.userId === userId);

  // Pay side show fee into pot
  round.potAmount += betAmount;
  round.players[round.currentTurnIndex].totalContribution += betAmount;
  gamePlayer.gameBalance -= betAmount;

  round.status = 'SIDE_SHOW_PENDING';
  round.sideShowRequest = {
    requestedBy: userId,
    targetPlayer: targetUserId,
    result: 'PENDING',
  };

  const updated = incrementVersion(newState);
  const event = { type: 'SIDE_SHOW_REQUEST', userId, targetUserId, betAmount, stateVersion: updated.stateVersion };
  updated.eventLog.push(event);

  return { newState: updated, events: [event] };
};

/**
 * SIDE_SHOW_RESPOND — Target player accepts or declines.
 * If declined: turn advances normally.
 * If accepted: waiting for result submission.
 */
export const applySideShowRespond = (state, { userId, accept, actionId }) => {
  if (isDuplicate(state.actionHistory, actionId)) {
    return err('DUPLICATE_ACTION', 'This action was already applied');
  }

  const round = state.round;
  if (round.status !== 'SIDE_SHOW_PENDING') {
    return err('NO_SIDE_SHOW_PENDING', 'No side show is pending');
  }

  if (round.sideShowRequest.targetPlayer !== userId) {
    return err('NOT_SIDE_SHOW_TARGET', 'You are not the target of this side show');
  }

  const newState = clone(state);
  newState.actionHistory.push(actionId);
  const r = newState.round;

  if (!accept) {
    // Declined — turn advances from requester's position
    r.status = 'ACTIVE';
    r.sideShowRequest = null;

    const nextIndex = getNextActivePlayerIndex(r.players, r.currentTurnIndex);
    if (nextIndex === null) return err('NO_ACTIVE_PLAYERS', 'No next active player found');
    r.currentTurnIndex = nextIndex;

    const updated = incrementVersion(newState);
    const event = { type: 'SIDE_SHOW_DECLINED', userId, stateVersion: updated.stateVersion };
    updated.eventLog.push(event);
    return { newState: updated, events: [event] };
  }

  // Accepted — waiting for result
  r.sideShowRequest.result = 'ACCEPTED';

  const updated = incrementVersion(newState);
  const event = { type: 'SIDE_SHOW_ACCEPTED', userId, stateVersion: updated.stateVersion };
  updated.eventLog.push(event);
  return { newState: updated, events: [event] };
};

/**
 * SIDE_SHOW_RESULT — One of the two participants submits who lost.
 * Loser gets packed. Auto-completes round if only 1 player remains.
 */
export const applySideShowResult = (state, { userId, loserUserId, actionId }) => {
  if (isDuplicate(state.actionHistory, actionId)) {
    return err('DUPLICATE_ACTION', 'This action was already applied');
  }

  const round = state.round;
  if (round.status !== 'SIDE_SHOW_PENDING' || round.sideShowRequest?.result !== 'ACCEPTED') {
    return err('INVALID_SIDE_SHOW_STATE', 'Side show is not in accepted state');
  }

  const { requestedBy, targetPlayer } = round.sideShowRequest;
  if (userId !== requestedBy && userId !== targetPlayer) {
    return err('NOT_PARTICIPANT', 'Only side show participants can submit the result');
  }

  if (loserUserId !== requestedBy && loserUserId !== targetPlayer) {
    return err('INVALID_LOSER', 'Loser must be one of the side show participants');
  }

  const newState = clone(state);
  newState.actionHistory.push(actionId);

  const r = newState.round;
  const loser = r.players.find(p => p.userId === loserUserId);
  if (!loser) return err('PLAYER_NOT_FOUND', 'Loser not found in round');

  loser.status = 'PACKED';
  r.status = 'ACTIVE';
  r.sideShowRequest = null;

  let events = [{ type: 'SIDE_SHOW_RESULT', loserUserId, stateVersion: newState.stateVersion }];

  const winner = checkOnePlayerRemaining(r.players);
  if (winner) {
    const { newState: completedState, events: completionEvents } = _completeRound(newState, winner.userId);
    completedState.status = 'WAITING';
    const updated = incrementVersion(completedState);
    updated.eventLog.push(...events, ...completionEvents);
    return { newState: updated, events: [...events, ...completionEvents] };
  }

  const nextIndex = getNextActivePlayerIndex(r.players, r.currentTurnIndex);
  if (nextIndex === null) return err('NO_ACTIVE_PLAYERS', 'No next active player found');
  r.currentTurnIndex = nextIndex;

  const updated = incrementVersion(newState);
  updated.eventLog.push(...events);
  return { newState: updated, events };
};

/**
 * SHOW_REQUEST — Current player pays to request a show (requires exactly 2 active players).
 * Sets round to SHOW_PENDING state.
 */
export const applyShowRequest = (state, { userId, actionId }) => {
  if (isDuplicate(state.actionHistory, actionId)) {
    return err('DUPLICATE_ACTION', 'This action was already applied');
  }

  const turnCheck = _validateTurn(state.round, userId);
  if (!turnCheck.ok) return err(turnCheck.error.code, turnCheck.error.message);

  if (countActivePlayers(state.round.players) !== 2) {
    return err('SHOW_NOT_ALLOWED', 'Show can only be requested when exactly 2 active players remain');
  }

  const betAmount = state.round.currentBet;
  const balCheck = _validateBalance(state, userId, betAmount);
  if (!balCheck.ok) return err(balCheck.error.code, balCheck.error.message);

  const newState = clone(state);
  newState.actionHistory.push(actionId);

  const round = newState.round;
  const player = round.players[round.currentTurnIndex];
  const gamePlayer = newState.players.find(p => p.userId === userId);

  round.potAmount += betAmount;
  player.totalContribution += betAmount;
  gamePlayer.gameBalance -= betAmount;
  round.status = 'SHOW_PENDING';

  const updated = incrementVersion(newState);
  const event = { type: 'SHOW_FEE', userId, amount: -betAmount, stateVersion: updated.stateVersion };
  updated.eventLog.push(event);

  return { newState: updated, events: [event] };
};

/**
 * SHOW_RESULT — Submit who won the show. Completes the round.
 */
export const applyShowResult = (state, { userId, winnerUserId, actionId }) => {
  if (isDuplicate(state.actionHistory, actionId)) {
    return err('DUPLICATE_ACTION', 'This action was already applied');
  }

  const round = state.round;
  if (round.status !== 'SHOW_PENDING') {
    return err('NO_SHOW_PENDING', 'No show is pending');
  }

  const activePlayers = round.players.filter(p => p.status === 'ACTIVE');
  const isValidWinner = activePlayers.some(p => p.userId === winnerUserId);
  if (!isValidWinner) return err('INVALID_WINNER', 'Winner must be an active player');

  const newState = clone(state);
  newState.actionHistory.push(actionId);

  // Pack the loser
  newState.round.players.forEach(p => {
    if (p.status === 'ACTIVE' && p.userId !== winnerUserId) p.status = 'PACKED';
  });

  const { newState: completedState, events: completionEvents } = _completeRound(newState, winnerUserId);
  completedState.status = 'WAITING';

  const updated = incrementVersion(completedState);
  updated.eventLog.push(...completionEvents);

  return { newState: updated, events: completionEvents };
};

/**
 * END_GAME — Marks the game as ENDED for final cloud settlement.
 */
export const applyEndGame = (state, { actionId }) => {
  if (isDuplicate(state.actionHistory, actionId)) {
    return err('DUPLICATE_ACTION', 'This action was already applied');
  }

  if (state.status !== 'WAITING') {
    return err('ROUND_IN_PROGRESS', 'Cannot end game while a round is in progress');
  }

  const newState = clone(state);
  newState.actionHistory.push(actionId);
  newState.status = 'ENDED';
  newState.endedAt = new Date().toISOString();

  const updated = incrementVersion(newState);
  const event = { type: 'GAME_ENDED', stateVersion: updated.stateVersion };
  updated.eventLog.push(event);

  return { newState: updated, events: [event] };
};

// ---------------------------------------------------------------------------
// Integrity Check
// ---------------------------------------------------------------------------

/**
 * Verifies the zero-sum invariant:
 *   Σ(player game balances) + pot = Σ(player starting balances)
 *
 * @param {Object} state - Current game state
 * @returns {{ valid: Boolean, sum: Number, expected: Number }}
 */
export const verifyZeroSum = (state) => {
  const expected = state.players.reduce((acc, p) => acc + p.totalDeposited, 0);
  const playerSum = state.players.reduce((acc, p) => acc + p.gameBalance, 0);
  const pot = state.round?.potAmount ?? 0;
  const sum = playerSum + pot;

  return {
    valid: Math.abs(sum - expected) < 0.001,   // floating-point tolerance
    sum,
    expected,
  };
};
