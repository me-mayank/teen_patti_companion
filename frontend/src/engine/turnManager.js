/**
 * turnManager.js — Pure Turn Management Logic
 *
 * Framework-agnostic. No imports. No I/O.
 * Runs identically in the browser (Host Engine) and Node.js (backend wrapper).
 *
 * All functions are pure: given the same inputs they always produce the same outputs.
 */

/**
 * Finds the index of the next ACTIVE player in the round (circular).
 * @param {Array} players - The round.players array
 * @param {Number} currentIndex - The current turn index
 * @returns {Number|null} The next active player index, or null if none found
 */
export const getNextActivePlayerIndex = (players, currentIndex) => {
  let nextIndex = (currentIndex + 1) % players.length;
  let loopCount = 0;

  while (loopCount < players.length) {
    if (players[nextIndex].status === 'ACTIVE') {
      return nextIndex;
    }
    nextIndex = (nextIndex + 1) % players.length;
    loopCount++;
  }

  return null;
};

/**
 * Finds the index of the PREVIOUS ACTIVE player in the round (circular).
 * Used for Side Show target determination.
 * @param {Array} players - The round.players array
 * @param {Number} currentIndex - The current turn index
 * @returns {Number|null} The previous active player index, or null if none found
 */
export const getPreviousActivePlayerIndex = (players, currentIndex) => {
  let prevIndex = (currentIndex - 1 + players.length) % players.length;
  let loopCount = 0;

  while (loopCount < players.length) {
    if (players[prevIndex].status === 'ACTIVE') {
      return prevIndex;
    }
    prevIndex = (prevIndex - 1 + players.length) % players.length;
    loopCount++;
  }

  return null;
};

/**
 * Checks if the round should auto-complete (only 1 ACTIVE player remaining).
 * @param {Array} players - The round.players array
 * @returns {Object|null} The winning player object if only 1 remains, else null
 */
export const checkOnePlayerRemaining = (players) => {
  const activePlayers = players.filter(p => p.status === 'ACTIVE');
  if (activePlayers.length === 1) {
    return activePlayers[0];
  }
  return null;
};

/**
 * Returns count of currently active players.
 * @param {Array} players
 * @returns {Number}
 */
export const countActivePlayers = (players) =>
  players.filter(p => p.status === 'ACTIVE').length;
