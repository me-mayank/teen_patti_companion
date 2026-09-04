/**
 * stateVersioner.js — Monotonic State Versioning
 *
 * Framework-agnostic. No imports. No I/O.
 *
 * Every committed game state gets a monotonically increasing stateVersion.
 * This enables:
 *  - Detection of missed WebRTC updates
 *  - Duplicate action prevention
 *  - Stale client detection
 *  - Host migration (new host picks up at the last known version)
 */

/**
 * Increments the stateVersion on a game state snapshot.
 * Returns a NEW object — never mutates.
 *
 * @param {Object} state - Current game state containing { stateVersion, ...rest }
 * @returns {Object} New state with stateVersion incremented by 1
 */
export const incrementVersion = (state) => ({
  ...state,
  stateVersion: (state.stateVersion ?? 0) + 1,
});

/**
 * Checks whether an incoming state update is newer than what we currently hold.
 * Used by Peer clients to decide whether to apply an incoming broadcast.
 *
 * @param {Number} currentVersion - The local stateVersion
 * @param {Number} incomingVersion - The incoming stateVersion from the Host
 * @returns {Boolean} true if the incoming state is newer and should be applied
 */
export const isNewer = (currentVersion, incomingVersion) =>
  incomingVersion > currentVersion;

/**
 * Checks whether an actionId has already been processed.
 * The host maintains an actionHistory Set/Array for deduplication.
 *
 * @param {Set|Array} actionHistory - Set or array of already-processed actionIds
 * @param {String} actionId - The incoming actionId to check
 * @returns {Boolean} true if this action was already applied (duplicate)
 */
export const isDuplicate = (actionHistory, actionId) => {
  if (actionHistory instanceof Set) return actionHistory.has(actionId);
  return actionHistory.includes(actionId);
};
