/**
 * engine/index.js — Barrel Export
 *
 * Import everything you need from the engine from this single entry point.
 *
 * Usage (browser or Node.js with ESM):
 *   import { applyBet, applyPack, verifyZeroSum, createGameState } from '@/engine';
 *
 * Usage (Node.js CommonJS via dynamic import):
 *   const engine = await import('../engine/index.js');
 */

export {
  // State factory
  createGameState,

  // Round lifecycle
  startRound,

  // Round actions
  applyBet,
  applyBetTwice,
  applyPack,
  applySideShowRequest,
  applySideShowRespond,
  applySideShowResult,
  applyShowRequest,
  applyShowResult,

  // Game lifecycle
  applyEndGame,

  // Integrity
  verifyZeroSum,
} from './gameEngine.js';

export {
  getNextActivePlayerIndex,
  getPreviousActivePlayerIndex,
  checkOnePlayerRemaining,
  countActivePlayers,
} from './turnManager.js';

export {
  incrementVersion,
  isNewer,
  isDuplicate,
} from './stateVersioner.js';
