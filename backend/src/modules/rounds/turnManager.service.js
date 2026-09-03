/**
 * Finds the index of the next ACTIVE player in the round.
 * @param {Array} players - The Round.players array
 * @param {Number} currentIndex - The Round.currentTurnIndex
 * @returns {Number|null} - The index of the next active player, or null if no other active players exist
 */
const getNextActivePlayerIndex = (players, currentIndex) => {
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
 * Finds the index of the PREVIOUS ACTIVE player in the round.
 * @param {Array} players - The Round.players array
 * @param {Number} currentIndex - The Round.currentTurnIndex
 * @returns {Number|null} - The index of the previous active player, or null if no other active players exist
 */
const getPreviousActivePlayerIndex = (players, currentIndex) => {
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
 * Checks if the round should auto-complete (only 1 active player remaining).
 * @param {Array} players - The Round.players array
 * @returns {Object|null} - The winning player object if only 1 remains, else null
 */
const checkOnePlayerRemaining = (players) => {
  const activePlayers = players.filter(p => p.status === 'ACTIVE');
  if (activePlayers.length === 1) {
    return activePlayers[0];
  }
  return null;
};

module.exports = {
  getNextActivePlayerIndex,
  getPreviousActivePlayerIndex,
  checkOnePlayerRemaining,
};
